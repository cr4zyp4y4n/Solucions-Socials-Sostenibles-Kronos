// Edge Function: comprovació "sensor sense senyal" (pg_cron cada 15 min).
// Secrets: OBRADOR_NOTIFY_* / TELEGRAM_BOT_TOKEN (veure _shared/notify.ts)
// Auth: Authorization Bearer = service role (o SUPABASE_ANON_KEY + verify_jwt).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { notify } from '../_shared/notify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SensorRow = {
  id: string;
  nom: string;
  ubicacio: string;
  minuts_sense_senyal: number;
  ultima_lectura_at: string | null;
  actiu: boolean;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Missing Supabase env' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = Date.now();
  const results: Array<Record<string, unknown>> = [];

  try {
    const { data: sensors, error } = await supabase
      .from('obrador_sensors')
      .select('id, nom, ubicacio, minuts_sense_senyal, ultima_lectura_at, actiu')
      .eq('actiu', true);

    if (error) throw error;

    for (const sensor of (sensors || []) as SensorRow[]) {
      const thresholdMin = Number(sensor.minuts_sense_senyal) || 30;
      const ultimaMs = sensor.ultima_lectura_at
        ? new Date(sensor.ultima_lectura_at).getTime()
        : null;

      // Sense cap lectura mai: no alertar encara (esperar primer uplink / simulador).
      // APPCC: el forat importa quan ja hi havia senyal i es perd.
      if (ultimaMs == null || Number.isNaN(ultimaMs)) {
        results.push({ sensor_id: sensor.id, skip: 'mai_rebut' });
        continue;
      }

      const ageMin = (now - ultimaMs) / 60000;
      if (ageMin <= thresholdMin) {
        results.push({
          sensor_id: sensor.id,
          ok: true,
          age_min: Math.round(ageMin * 10) / 10,
        });
        continue;
      }

      const { data: openRows } = await supabase
        .from('obrador_incidencies')
        .select('id, estat')
        .eq('origen', 'sensor')
        .eq('id_sensor', sensor.id)
        .eq('tipus', 'sensor_sense_senyal')
        .in('estat', ['oberta', 'en_curs'])
        .limit(1);

      if (openRows?.length) {
        results.push({
          sensor_id: sensor.id,
          already_active: openRows[0].id,
          estat: openRows[0].estat,
          age_min: Math.round(ageMin),
        });
        continue;
      }

      const iniciIso = new Date(ultimaMs).toISOString();
      const descripcio =
        `Sensor sense senyal: ${sensor.nom} (${sensor.ubicacio}). ` +
        `Última lectura fa ${Math.round(ageMin)} min (llindar ${thresholdMin} min).`;

      const { data: created, error: creErr } = await supabase
        .from('obrador_incidencies')
        .insert({
          id_lot: null,
          id_sensor: sensor.id,
          origen: 'sensor',
          tipus: 'sensor_sense_senyal',
          descripcio,
          data_incidencia: new Date().toISOString(),
          estat: 'oberta',
          inici_episodi_at: iniciIso,
        })
        .select('id')
        .maybeSingle();

      if (creErr) {
        if (creErr.code === '23505') {
          results.push({ sensor_id: sensor.id, race_duplicate: true });
          continue;
        }
        throw creErr;
      }

      await notify({
        title: 'Obrador — sensor sense senyal',
        body: descripcio,
        meta: {
          sensor_id: sensor.id,
          incidencia_id: created?.id,
          age_min: Math.round(ageMin),
        },
      });

      results.push({
        sensor_id: sensor.id,
        opened: created?.id,
        age_min: Math.round(ageMin),
      });
    }

    return json({
      ok: true,
      checked: (sensors || []).length,
      results,
      at: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[obrador-sensors-watchdog]', message);
    return json({ ok: false, error: message }, 500);
  }
});
