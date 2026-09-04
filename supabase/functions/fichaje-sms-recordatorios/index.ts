// Edge Function: SMS recordatorios + cierre automático de salida olvidada.
// Invocada por pg_cron cada ~5 min. No requiere Kronos abierto.
// Secrets: FIRMA_SMS_API_BASE, FIRMA_SMS_API_SECRET
//
// Salida: a hora_salida+tolerancia → SMS (la persona puede cerrar ella).
//         a hora_salida+tolerancia+GRACIA_CIERRE_MIN → cierre auto (hora = ese instante de gracia).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/** Minutos extra tras el SMS antes de cerrar solo (ej. 17:15 SMS → 17:20 cierre). */
const GRACIA_CIERRE_MIN = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type HorarioRow = {
  id: string;
  empleado_id: string;
  nombre: string | null;
  telefono: string;
  hora_entrada: string;
  hora_salida: string;
  tolerancia_minutos: number;
  dias_semana: number[];
  timezone: string;
  activo: boolean;
};

type TipoAviso = 'entrada_olvidada' | 'salida_olvidada';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isoWeekdayInTz(date: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const map: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return map[wd] ?? 0;
}

function dateKeyInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function minutesNowInTz(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  if (hour === 24) hour = 0;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function parseTimeToMinutes(t: string): number {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatHmFromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** 'YYYY-MM-DD HH:MM:00' wall clock Madrid for RPC */
function localSalidaWall(fecha: string, horaSalida: string): string {
  const mins = parseTimeToMinutes(horaSalida);
  return `${fecha} ${formatHmFromMinutes(mins)}:00`;
}

function normalizePhone(phone: string): string {
  const raw = String(phone || '').trim().replace(/\s+/g, '');
  if (!raw || raw.startsWith('PENDIENTE')) return '';
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('00')) return `+${raw.slice(2)}`;
  if (/^\d{9}$/.test(raw)) return `+34${raw}`;
  return raw;
}

async function sendSms(to: string, body: string): Promise<{ ok: boolean; delivery?: string; error?: string }> {
  const base = String(Deno.env.get('FIRMA_SMS_API_BASE') || '').trim().replace(/\/$/, '');
  const secret = String(Deno.env.get('FIRMA_SMS_API_SECRET') || '').trim();
  if (!base || !secret) {
    return { ok: false, error: 'Faltan FIRMA_SMS_API_BASE o FIRMA_SMS_API_SECRET' };
  }
  const res = await fetch(`${base}/api/firma/sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ to, body }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.ok) {
    return { ok: false, error: payload?.error || `SMS HTTP ${res.status}` };
  }
  return { ok: true, delivery: payload.delivery || 'sms' };
}

function buildMessage(tipo: TipoAviso, nombre: string | null, _horaSalidaHm?: string): string {
  const quien = nombre ? String(nombre).trim().split(/\s+/)[0] : '';
  if (tipo === 'entrada_olvidada') {
    return quien
      ? `Kronos: Hola ${quien}, no consta tu fichaje de entrada. Entra en la app y ficha cuando puedas.`
      : 'Kronos: no consta tu fichaje de entrada. Entra en la app y ficha cuando puedas.';
  }
  return quien
    ? `Kronos: Hola ${quien}, recuerda fichar la salida. Si no lo haces, cerraremos la jornada automáticamente en unos minutos.`
    : 'Kronos: recuerda fichar la salida. Si no lo haces, cerraremos la jornada automáticamente en unos minutos.';
}

async function cerrarAuto(
  supabase: ReturnType<typeof createClient>,
  fichajeId: string,
  motivo: string,
  horaSalidaLocal: string | null
) {
  const args: Record<string, unknown> = {
    p_fichaje_id: fichajeId,
    p_motivo: motivo,
  };
  if (horaSalidaLocal) args.p_hora_salida_local = horaSalidaLocal;

  const { data, error } = await supabase.rpc('cerrar_fichaje_automaticamente', args);
  if (error) {
    // Fallback 2-arg signature if migration not applied yet
    const fb = await supabase.rpc('cerrar_fichaje_automaticamente', {
      p_fichaje_id: fichajeId,
      p_motivo: motivo,
    });
    if (fb.error) throw fb.error;
    return fb.data;
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const results: Array<Record<string, unknown>> = [];

  try {
    const { data: horarios, error: horErr } = await supabase
      .from('fichajes_sms_horarios')
      .select('*')
      .eq('activo', true);

    if (horErr) throw horErr;
    if (!horarios?.length) {
      return json({ ok: true, checked: 0, sent: 0, closed: 0, message: 'Sin horarios activos' });
    }

    let sent = 0;
    let closed = 0;

    for (const row of horarios as HorarioRow[]) {
      const tz = row.timezone || 'Europe/Madrid';
      const empleadoId = String(row.empleado_id || '').trim();
      const telefono = normalizePhone(row.telefono);
      const fecha = dateKeyInTz(now, tz);
      const tol = Number(row.tolerancia_minutos) || 15;
      const horaSalidaHm = formatHmFromMinutes(parseTimeToMinutes(row.hora_salida));

      if (!empleadoId || empleadoId.startsWith('PENDIENTE')) {
        results.push({ empleado_id: empleadoId, skip: 'id_invalido' });
        continue;
      }

      // --- 1) Cerrar fichajes abiertos de días ANTERIORES (sin depender de Kronos) ---
      const { data: viejos } = await supabase
        .from('fichajes')
        .select('id, fecha, hora_entrada, hora_salida')
        .eq('empleado_id', empleadoId)
        .is('hora_salida', null)
        .lt('fecha', fecha);

      for (const v of viejos || []) {
        try {
          const wall = localSalidaWall(String(v.fecha), row.hora_salida);
          await cerrarAuto(
            supabase,
            v.id,
            `Cerrado automáticamente (Supabase): salida no registrada el ${v.fecha}. Aplicada hora fin de jornada ${horaSalidaHm}.`,
            wall
          );
          closed += 1;
          results.push({ empleado_id: empleadoId, closed_prev: true, fecha: v.fecha, hora: wall });
        } catch (e) {
          results.push({
            empleado_id: empleadoId,
            closed_prev: false,
            fecha: v.fecha,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      const weekday = isoWeekdayInTz(now, tz);
      const dias = Array.isArray(row.dias_semana) ? row.dias_semana.map(Number) : [1, 2, 3, 4, 5];
      if (!dias.includes(weekday)) {
        results.push({ empleado_id: empleadoId, skip: 'fuera_dias_semana', weekday });
        continue;
      }

      if (!telefono) {
        results.push({ empleado_id: empleadoId, skip: 'telefono_invalido' });
        continue;
      }

      const minsNow = minutesNowInTz(now, tz);
      const entradaLimit = parseTimeToMinutes(row.hora_entrada) + tol;
      const salidaLimit = parseTimeToMinutes(row.hora_salida) + tol;

      const { data: vac } = await supabase
        .from('vacaciones')
        .select('id')
        .eq('empleado_id', empleadoId)
        .eq('fecha', fecha)
        .maybeSingle();
      if (vac?.id) {
        results.push({ empleado_id: empleadoId, skip: 'vacaciones', fecha });
        continue;
      }

      const { data: baja } = await supabase
        .from('bajas')
        .select('id')
        .eq('empleado_id', empleadoId)
        .lte('fecha_inicio', fecha)
        .gte('fecha_fin', fecha)
        .limit(1)
        .maybeSingle();
      if (baja?.id) {
        results.push({ empleado_id: empleadoId, skip: 'baja', fecha });
        continue;
      }

      const { data: fichaje } = await supabase
        .from('fichajes')
        .select('id, hora_entrada, hora_salida')
        .eq('empleado_id', empleadoId)
        .eq('fecha', fecha)
        .maybeSingle();

      // Entrada olvidada → solo SMS
      if (minsNow >= entradaLimit && !fichaje?.hora_entrada) {
        const tipo: TipoAviso = 'entrada_olvidada';
        const { data: ya } = await supabase
          .from('fichajes_sms_envios')
          .select('id')
          .eq('empleado_id', empleadoId)
          .eq('fecha', fecha)
          .eq('tipo', tipo)
          .maybeSingle();

        if (ya?.id) {
          results.push({ empleado_id: empleadoId, tipo, skip: 'ya_enviado' });
        } else {
          const cuerpo = buildMessage(tipo, row.nombre);
          const sms = await sendSms(telefono, cuerpo);
          const { error: insErr } = await supabase.from('fichajes_sms_envios').insert({
            empleado_id: empleadoId,
            fecha,
            tipo,
            telefono,
            cuerpo,
            delivery: sms.ok ? sms.delivery || 'sms' : 'error',
            error_message: sms.ok ? null : sms.error || 'error',
          });
          if (insErr) {
            results.push({ empleado_id: empleadoId, tipo, skip: 'insert_conflicto', error: insErr.message });
          } else {
            if (sms.ok) sent += 1;
            results.push({ empleado_id: empleadoId, tipo, sent: sms.ok, delivery: sms.delivery, error: sms.error });
          }
        }
      }

      // Salida olvidada:
      // 1) SMS a hora_salida + tolerancia (ej. 17:15) — tiempo para que cierre la persona
      // 2) Cierre auto a hora_salida + tolerancia + GRACIA (ej. 17:20), hora registrada = 17:20
      if (fichaje?.hora_entrada && !fichaje?.hora_salida) {
        const cierreLimit = salidaLimit + GRACIA_CIERRE_MIN;

        if (minsNow >= salidaLimit && minsNow < cierreLimit) {
          const tipo: TipoAviso = 'salida_olvidada';
          const { data: ya } = await supabase
            .from('fichajes_sms_envios')
            .select('id')
            .eq('empleado_id', empleadoId)
            .eq('fecha', fecha)
            .eq('tipo', tipo)
            .maybeSingle();

          if (!ya?.id) {
            const cuerpo = buildMessage(tipo, row.nombre, horaSalidaHm);
            const sms = await sendSms(telefono, cuerpo);
            const { error: insErr } = await supabase.from('fichajes_sms_envios').insert({
              empleado_id: empleadoId,
              fecha,
              tipo,
              telefono,
              cuerpo,
              delivery: sms.ok ? sms.delivery || 'sms' : 'error',
              error_message: sms.ok ? null : sms.error || 'error',
            });
            if (!insErr && sms.ok) sent += 1;
            results.push({
              empleado_id: empleadoId,
              tipo,
              phase: 'aviso_sms',
              sent: !insErr && sms.ok,
              delivery: sms.delivery,
              error: insErr?.message || sms.error,
            });
          } else {
            results.push({ empleado_id: empleadoId, tipo, phase: 'aviso_sms', skip: 'ya_enviado' });
          }
        }

        if (minsNow >= cierreLimit) {
          // Asegurar SMS si el cron saltó la ventana 17:15–17:20
          const tipo: TipoAviso = 'salida_olvidada';
          const { data: ya } = await supabase
            .from('fichajes_sms_envios')
            .select('id')
            .eq('empleado_id', empleadoId)
            .eq('fecha', fecha)
            .eq('tipo', tipo)
            .maybeSingle();

          if (!ya?.id) {
            const cuerpo = buildMessage(tipo, row.nombre, horaSalidaHm);
            const sms = await sendSms(telefono, cuerpo);
            await supabase.from('fichajes_sms_envios').insert({
              empleado_id: empleadoId,
              fecha,
              tipo,
              telefono,
              cuerpo,
              delivery: sms.ok ? sms.delivery || 'sms' : 'error',
              error_message: sms.ok ? null : sms.error || 'error',
            });
            if (sms.ok) sent += 1;
            results.push({ empleado_id: empleadoId, tipo, phase: 'sms_tardio', sent: sms.ok });
          }

          try {
            const cierreHm = formatHmFromMinutes(parseTimeToMinutes(row.hora_salida) + tol + GRACIA_CIERRE_MIN);
            const wall = localSalidaWall(fecha, cierreHm);
            await cerrarAuto(
              supabase,
              fichaje.id,
              `Cerrado automáticamente (Supabase): sin salida tras aviso SMS. Hora aplicada ${cierreHm} (fin jornada ${horaSalidaHm} + ${tol + GRACIA_CIERRE_MIN} min).`,
              wall
            );
            closed += 1;
            results.push({ empleado_id: empleadoId, closed_today: true, hora: wall, phase: 'cierre_auto' });
          } catch (e) {
            results.push({
              empleado_id: empleadoId,
              closed_today: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }
    }

    return json({
      ok: true,
      checked: horarios.length,
      sent,
      closed,
      at: now.toISOString(),
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[fichaje-sms-recordatorios]', message);
    return json({ ok: false, error: message }, 500);
  }
});
