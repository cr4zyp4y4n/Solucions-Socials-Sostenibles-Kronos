import { supabase } from '../config/supabase';

/**
 * Horarios SMS + envíos (recordatorios de fichaje).
 * Tablas: fichajes_sms_horarios, fichajes_sms_envios
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Fecha YYYY-MM-DD y minutos desde medianoche en Europe/Madrid */
export function nowPartsInMadrid(date = new Date()) {
  const tz = 'Europe/Madrid';
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  }).formatToParts(date);

  let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  if (hour === 24) hour = 0;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const wdShort = parts.find((p) => p.type === 'weekday')?.value;
  const isoMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const isoWeekday = isoMap[wdShort] || 0;

  return { fecha, minsNow: hour * 60 + minute, isoWeekday, tz };
}

function parseTimeToMinutes(t) {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatHm(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

class FichajeSmsRecordatoriosService {
  async obtenerHorariosActivos() {
    try {
      const { data, error } = await supabase
        .from('fichajes_sms_horarios')
        .select('*')
        .eq('activo', true);
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error obteniendo horarios SMS fichaje:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  async obtenerEnviosPorFecha(fecha) {
    try {
      const { data, error } = await supabase
        .from('fichajes_sms_envios')
        .select('*')
        .eq('fecha', fecha)
        .order('enviado_at', { ascending: false });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error obteniendo envíos SMS fichaje:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Estado de recordatorios de HOY para el panel.
   * @returns {Record<empleadoId, {
   *   nombre, telefono, horaEntrada, horaSalida,
   *   faltaEntrada, faltaSalida,
   *   smsEntrada, smsSalida,
   *   avisos: string[]
   * }>}
   */
  buildAlertasHoy({
    horarios = [],
    envios = [],
    fichajesHoy = [],
    vacacionesHoyIds = new Set(),
    bajasHoyIds = new Set(),
    now = new Date()
  } = {}) {
    const { fecha, minsNow, isoWeekday } = nowPartsInMadrid(now);
    const fichajeByEmp = new Map();
    (fichajesHoy || []).forEach((f) => {
      if (f?.empleado_id) fichajeByEmp.set(f.empleado_id, f);
    });

    const enviosByEmp = new Map();
    (envios || []).forEach((e) => {
      if (!e?.empleado_id) return;
      if (!enviosByEmp.has(e.empleado_id)) enviosByEmp.set(e.empleado_id, {});
      const slot = enviosByEmp.get(e.empleado_id);
      // Preferir el más reciente (ya vienen ordered desc)
      if (!slot[e.tipo]) slot[e.tipo] = e;
    });

    const map = {};

    for (const h of horarios || []) {
      const empleadoId = String(h.empleado_id || '').trim();
      if (!empleadoId) continue;

      const dias = Array.isArray(h.dias_semana) ? h.dias_semana.map(Number) : [1, 2, 3, 4, 5];
      if (!dias.includes(isoWeekday)) continue;
      if (vacacionesHoyIds.has(empleadoId) || bajasHoyIds.has(empleadoId)) continue;

      const tol = Number(h.tolerancia_minutos) || 15;
      const entradaLimit = parseTimeToMinutes(h.hora_entrada) + tol;
      const salidaLimit = parseTimeToMinutes(h.hora_salida) + tol;
      const fichaje = fichajeByEmp.get(empleadoId);
      const env = enviosByEmp.get(empleadoId) || {};

      const faltaEntrada = minsNow >= entradaLimit && !fichaje?.hora_entrada;
      const faltaSalida =
        minsNow >= salidaLimit && !!fichaje?.hora_entrada && !fichaje?.hora_salida;

      if (!faltaEntrada && !faltaSalida && !env.entrada_olvidada && !env.salida_olvidada) {
        // Con horario pero al día: aún así podemos mostrar "OK SMS" solo si hubo envío sin falta actual — skip
        continue;
      }

      // Si ya fichó pero hubo SMS hoy, o hay falta → mostrar
      if (!faltaEntrada && !faltaSalida) continue;

      const smsEntrada = env.entrada_olvidada || null;
      const smsSalida = env.salida_olvidada || null;
      const avisos = [];
      if (faltaEntrada) {
        avisos.push(
          smsEntrada?.delivery === 'sms'
            ? 'Sin entrada · SMS enviado'
            : smsEntrada?.delivery === 'error'
              ? 'Sin entrada · SMS falló'
              : 'Sin entrada · SMS pendiente'
        );
      }
      if (faltaSalida) {
        avisos.push(
          smsSalida?.delivery === 'sms'
            ? 'Sin salida · SMS enviado'
            : smsSalida?.delivery === 'error'
              ? 'Sin salida · SMS falló'
              : 'Sin salida · SMS pendiente'
        );
      }

      map[empleadoId] = {
        empleadoId,
        nombre: h.nombre || null,
        telefono: h.telefono || null,
        horaEntrada: formatHm(parseTimeToMinutes(h.hora_entrada)),
        horaSalida: formatHm(parseTimeToMinutes(h.hora_salida)),
        toleranciaMinutos: tol,
        faltaEntrada,
        faltaSalida,
        smsEntrada,
        smsSalida,
        avisos,
        fecha
      };
    }

    return map;
  }

  async cargarAlertasHoy({ fichajesHoy = [], vacacionesHoyIds, bajasHoyIds } = {}) {
    const { fecha } = nowPartsInMadrid();
    const [horRes, envRes] = await Promise.all([
      this.obtenerHorariosActivos(),
      this.obtenerEnviosPorFecha(fecha)
    ]);

    const alertas = this.buildAlertasHoy({
      horarios: horRes.data || [],
      envios: envRes.data || [],
      fichajesHoy,
      vacacionesHoyIds: vacacionesHoyIds || new Set(),
      bajasHoyIds: bajasHoyIds || new Set()
    });

    return {
      success: horRes.success !== false,
      fecha,
      alertas,
      error: horRes.error || envRes.error || null
    };
  }
}

const fichajeSmsRecordatoriosService = new FichajeSmsRecordatoriosService();
export default fichajeSmsRecordatoriosService;
