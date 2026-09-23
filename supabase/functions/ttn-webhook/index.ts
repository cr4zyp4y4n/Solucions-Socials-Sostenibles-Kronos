// Edge Function: recepció d'uplinks TTN v3 (Milesight EM320-TH).
// Secrets:
//   TTN_WEBHOOK_SECRET — capçalera X-Webhook-Secret o Authorization: Bearer …
//   OBRADOR_NOTIFY_* / TELEGRAM_BOT_TOKEN — veure _shared/notify.ts
//
// verify_jwt=false: TTN no envia JWT de Supabase; autentiquem amb el secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { notify } from '../_shared/notify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

type SensorRow = {
  id: string;
  dev_eui: string;
  nom: string;
  ubicacio: string;
  tipus_lectura: string;
  llindar_min: number | null;
  llindar_max: number | null;
  minuts_tolerancia: number | null;
  actiu: boolean;
  ultima_lectura_at: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeDevEui(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/[^a-fA-F0-9]/g, '')
    .toUpperCase();
}

function extractSecret(req: Request): string {
  const headerSecret = req.headers.get('x-webhook-secret') || '';
  if (headerSecret) return headerSecret.trim();
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return null;
}

function parseMesuraAt(decoded: Record<string, unknown>, uplink: Record<string, unknown>): Date {
  const candidates = [
    decoded.timestamp,
    decoded.time,
    decoded.datetime,
    uplink.received_at,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' || typeof c === 'number') {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

function isOutOfRange(valor: number, min: number | null, max: number | null): boolean {
  if (min == null && max == null) return false;
  if (min != null && valor < min) return true;
  if (max != null && valor > max) return true;
  return false;
}

function extremeOf(a: number | null | undefined, b: number, min: number | null, max: number | null): number {
  if (a == null || Number.isNaN(a)) return b;
  // Guarda el més extrem respecte al rang (més lluny del centre / dels límits)
  if (min != null && b < min) return Math.min(a, b);
  if (max != null && b > max) return Math.max(a, b);
  return Math.abs(b) > Math.abs(a) ? b : a;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const expected = Deno.env.get('TTN_WEBHOOK_SECRET') || '';
  if (!expected) {
    console.error('[ttn-webhook] Falta secret TTN_WEBHOOK_SECRET');
    return json({ ok: false, error: 'Server misconfigured' }, 500);
  }
  if (extractSecret(req) !== expected) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Missing Supabase env' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const endDeviceIds = (body.end_device_ids || {}) as Record<string, unknown>;
  const uplink = (body.uplink_message || {}) as Record<string, unknown>;
  const decoded = (uplink.decoded_payload || {}) as Record<string, unknown>;

  const devEui = normalizeDevEui(endDeviceIds.dev_eui);
  if (!devEui) {
    console.warn('[ttn-webhook] uplink sense dev_eui');
    return json({ ok: true, skipped: 'no_dev_eui' });
  }

  const temperature = pickNumber(decoded, [
    'temperature',
    'Temperature',
    'temp',
    'temperature_1',
  ]);
  const humidity = pickNumber(decoded, [
    'humidity',
    'Humidity',
    'humi',
    'humidity_1',
  ]);

  if (temperature == null) {
    console.warn('[ttn-webhook] sense temperatura', { devEui, decoded });
    return json({ ok: true, skipped: 'no_temperature' });
  }

  const mesuraAt = parseMesuraAt(decoded, uplink);
  const mesuraIso = mesuraAt.toISOString();

  // Match case-insensitive: seed i TTN poden diferir en majúscules
  const { data: sensors, error: sensErr } = await supabase
    .from('obrador_sensors')
    .select(
      'id, dev_eui, nom, ubicacio, tipus_lectura, llindar_min, llindar_max, minuts_tolerancia, actiu, ultima_lectura_at',
    )
    .ilike('dev_eui', devEui);

  if (sensErr) {
    console.error('[ttn-webhook] sensor query', sensErr);
    return json({ ok: false, error: sensErr.message }, 500);
  }

  const sensor = (sensors || []).find(
    (s) => normalizeDevEui(s.dev_eui) === devEui,
  ) as SensorRow | undefined;

  if (!sensor) {
    console.warn('[ttn-webhook] sensor desconegut', devEui);
    return json({ ok: true, skipped: 'unknown_sensor', dev_eui: devEui });
  }
  if (!sensor.actiu) {
    console.warn('[ttn-webhook] sensor inactiu', sensor.nom, devEui);
    return json({ ok: true, skipped: 'inactive_sensor', sensor_id: sensor.id });
  }

  // Insert (anti-duplicat per índex únic sensor_id + mesura_at)
  const { error: insErr } = await supabase.from('obrador_temperatures').insert({
    ubicacio: sensor.ubicacio,
    valor: temperature,
    tipus: sensor.tipus_lectura || 'refrigeracio',
    mesura_at: mesuraIso,
    sensor_id: sensor.id,
    humitat: humidity,
  });

  let duplicate = false;
  if (insErr) {
    if (insErr.code === '23505') {
      duplicate = true;
    } else {
      console.error('[ttn-webhook] insert temperatura', insErr);
      return json({ ok: false, error: insErr.message }, 500);
    }
  }

  // Actualitzar ultima_lectura_at només si aquesta mesura és més nova
  const prevUltima = sensor.ultima_lectura_at
    ? new Date(sensor.ultima_lectura_at).getTime()
    : 0;
  if (mesuraAt.getTime() >= prevUltima) {
    await supabase
      .from('obrador_sensors')
      .update({
        ultima_lectura_at: mesuraIso,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sensor.id);
  }

  // Tancar "sense senyal" si n'hi ha d'oberta
  await closeOpenIncidencia(supabase, sensor.id, 'sensor_sense_senyal', mesuraIso, {
    nota: 'Senyal recuperada',
  });

  const alert = await handleRangeAlert(supabase, sensor, temperature, mesuraAt);

  return json({
    ok: true,
    sensor_id: sensor.id,
    duplicate,
    temperature,
    humidity,
    mesura_at: mesuraIso,
    alert,
  });
});

async function findActiveIncidencia(
  supabase: ReturnType<typeof createClient>,
  sensorId: string,
  tipus: string,
) {
  const { data } = await supabase
    .from('obrador_incidencies')
    .select('id, estat, inici_episodi_at, valor_extrem, descripcio')
    .eq('origen', 'sensor')
    .eq('id_sensor', sensorId)
    .eq('tipus', tipus)
    .in('estat', ['oberta', 'en_curs'])
    .limit(1);
  return data?.[0] || null;
}

/**
 * Tancament automàtic només si encara està "oberta" (no reconeguda).
 * Si està "en_curs", no tanquem: cal checklist manual a Kronos.
 */
async function closeOpenIncidencia(
  supabase: ReturnType<typeof createClient>,
  sensorId: string,
  tipus: string,
  tancadaAt: string,
  opts: { nota?: string; valor?: number } = {},
) {
  const active = await findActiveIncidencia(supabase, sensorId, tipus);
  if (!active) return null;

  if (active.estat === 'en_curs') {
    return { skipped: 'en_curs', id: active.id as string };
  }

  const inici = active.inici_episodi_at ? new Date(active.inici_episodi_at) : null;
  const fi = new Date(tancadaAt);
  const duradaMin =
    inici && !Number.isNaN(inici.getTime())
      ? Math.round((fi.getTime() - inici.getTime()) / 60000)
      : null;

  const parts = [active.descripcio || '', opts.nota || 'Episodi tancat'].filter(Boolean);
  if (duradaMin != null) parts.push(`Durada: ${duradaMin} min`);
  if (active.valor_extrem != null) parts.push(`Valor extrem: ${active.valor_extrem}°C`);

  await supabase
    .from('obrador_incidencies')
    .update({
      estat: 'tancada',
      tancada_at: tancadaAt,
      updated_at: new Date().toISOString(),
      descripcio: parts.join(' | '),
    })
    .eq('id', active.id);

  return { closed: active.id as string };
}

async function handleRangeAlert(
  supabase: ReturnType<typeof createClient>,
  sensor: SensorRow,
  valor: number,
  mesuraAt: Date,
): Promise<Record<string, unknown>> {
  const min = sensor.llindar_min;
  const max = sensor.llindar_max;
  const tolerancia = sensor.minuts_tolerancia;

  // Sense llindars APPCC: no obrir alertes de rang
  if (min == null && max == null) {
    return { skipped: 'no_thresholds' };
  }
  if (tolerancia == null) {
    return { skipped: 'no_tolerancia' };
  }

  const out = isOutOfRange(valor, min, max);
  const mesuraIso = mesuraAt.toISOString();

  if (!out) {
    const result = await closeOpenIncidencia(
      supabase,
      sensor.id,
      'sensor_fora_rang',
      mesuraIso,
      { nota: 'Tornada a rang (auto)', valor },
    );
    return { in_range: true, ...(result || {}) };
  }

  // Ja hi ha incidència activa (oberta o en_curs) → actualitzar extrem, no duplicar
  const active = await findActiveIncidencia(supabase, sensor.id, 'sensor_fora_rang');
  if (active) {
    const nextExtreme = extremeOf(active.valor_extrem, valor, min, max);
    if (nextExtreme !== active.valor_extrem) {
      await supabase
        .from('obrador_incidencies')
        .update({
          valor_extrem: nextExtreme,
          updated_at: new Date().toISOString(),
        })
        .eq('id', active.id);
    }
    return {
      out_of_range: true,
      updated: active.id,
      estat: active.estat,
      valor_extrem: nextExtreme,
    };
  }

  // Calcular inici de l'episodi consecutiu fora de rang (fins a aquesta mesura)
  const lookbackHours = Math.max(6, tolerancia / 60 + 2);
  const since = new Date(mesuraAt.getTime() - lookbackHours * 3600 * 1000).toISOString();

  const { data: recent } = await supabase
    .from('obrador_temperatures')
    .select('valor, mesura_at')
    .eq('sensor_id', sensor.id)
    .gte('mesura_at', since)
    .lte('mesura_at', mesuraIso)
    .order('mesura_at', { ascending: false })
    .limit(200);

  const rows = recent || [];
  let streakStart = mesuraAt;
  let extreme = valor;

  for (const r of rows) {
    const v = Number(r.valor);
    const t = new Date(r.mesura_at);
    if (Number.isNaN(t.getTime())) continue;
    if (!isOutOfRange(v, min, max)) break;
    streakStart = t;
    extreme = extremeOf(extreme, v, min, max);
  }

  const streakMin = (mesuraAt.getTime() - streakStart.getTime()) / 60000;
  if (streakMin < tolerancia) {
    return {
      out_of_range: true,
      waiting_tolerancia: true,
      streak_min: Math.round(streakMin * 10) / 10,
      tolerancia,
    };
  }

  const descripcio =
    `Sensor fora de rang: ${sensor.nom} (${sensor.ubicacio}). ` +
    `Valor ${valor}°C (llindars ${min ?? '—'}…${max ?? '—'}°C).`;

  const { data: created, error: creErr } = await supabase
    .from('obrador_incidencies')
    .insert({
      id_lot: null,
      id_sensor: sensor.id,
      origen: 'sensor',
      tipus: 'sensor_fora_rang',
      descripcio,
      data_incidencia: mesuraIso,
      estat: 'oberta',
      valor_extrem: extreme,
      inici_episodi_at: streakStart.toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (creErr) {
    // Condició de cursa amb índex únic d'obertes
    if (creErr.code === '23505') {
      return { out_of_range: true, race_duplicate: true };
    }
    console.error('[ttn-webhook] crear incidencia', creErr);
    return { error: creErr.message };
  }

  await notify({
    title: 'Obrador — sensor fora de rang',
    body: descripcio,
    meta: {
      sensor_id: sensor.id,
      incidencia_id: created?.id,
      valor,
      llindar_min: min,
      llindar_max: max,
    },
  });

  return { out_of_range: true, opened: created?.id, valor_extrem: extreme };
}
