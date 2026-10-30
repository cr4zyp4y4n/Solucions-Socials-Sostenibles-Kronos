// Edge Function: sync diari de licitacions (pg_cron 07:15 Europe/Madrid).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Notificacions: OBRADOR_NOTIFY_* / TELEGRAM_BOT_TOKEN (veure _shared/notify.ts)
//
// Auth: Authorization Bearer = service role (pg_cron) o JWT vàlid.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { notify } from '../_shared/notify.ts';
import {
  setLicitacionsDeps,
  runLicitacionsSync,
} from '../_shared/licitacions/fonts.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Guard: evita doble execució el mateix dia (cron 15 5,6 * * * CET/CEST). */
async function alreadyRanToday(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const now = new Date();
  // Approximate Europe/Madrid day key in UTC±1/2 is enough with a 06:00–08:00 window.
  const madridOffsetMin = (() => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Madrid',
        timeZoneName: 'shortOffset',
      }).formatToParts(now);
      const raw = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+1';
      const m = raw.match(/GMT([+-]\d+)(?::(\d+))?/i);
      if (!m) return 60;
      const h = Number(m[1]);
      const mins = Number(m[2] || 0);
      return h * 60 + Math.sign(h || 1) * mins;
    } catch {
      return 60;
    }
  })();
  const local = new Date(now.getTime() + madridOffsetMin * 60_000);
  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  const dayStartUtc = new Date(Date.UTC(y, Number(mo) - 1, Number(d), 0, 0, 0) - madridOffsetMin * 60_000);

  const { data, error } = await supabase
    .from('licitacions_sync_log')
    .select('id, ok, started_at')
    .eq('origen', 'edge')
    .gte('started_at', dayStartUtc.toISOString())
    .order('started_at', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('[licitacions-sync] guard check:', error.message);
    return false;
  }
  return Boolean(data?.length);
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

  let body: Record<string, unknown> = {};
  try {
    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}));
    }
  } catch {
    body = {};
  }

  const force = Boolean(body.force);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (!force && (await alreadyRanToday(supabase))) {
      return json({
        ok: true,
        skipped: 'already_ran_today',
        at: new Date().toISOString(),
      });
    }

    setLicitacionsDeps({ supabase });

    const result = await runLicitacionsSync({
      origen: 'edge',
      limit: 100,
      tedMaxPages: 2,
      pscpMaxPages: 10,
      archiveCaducadas: true,
    });

    const failed = Boolean(result.errors) && (result.fetched?.pscp || 0) + (result.fetched?.placsp || 0) === 0
      && Object.keys(result.errors || {}).some((k) => k !== 'incidencies');

    if (result.errors && (failed || result.errors.fatal)) {
      await notify({
        title: 'Licitacions — sync edge amb errors',
        body: `Errors: ${JSON.stringify(result.errors).slice(0, 800)}`,
        meta: {
          origen: 'edge',
          inserides: result.inserted,
          llegits: result.llegits,
        },
      });
    }

    const reservades = result.noves_reservades || [];
    if (reservades.length) {
      const lines = reservades
        .slice(0, 8)
        .map((r: { title?: string; area?: string; termini_oferta?: string }) =>
          `· ${r.title || '—'} (${r.area || '—'}) termini ${r.termini_oferta || '—'}`
        )
        .join('\n');
      await notify({
        title: `Licitacions — ${reservades.length} reservada(es) DA 4ª nova(es)`,
        body: lines,
        meta: { count: reservades.length, origen: 'edge' },
      });
    }

    return json({
      ok: true,
      inserted: result.inserted,
      updated: result.updated,
      arxivades: result.arxivades,
      llegits: result.llegits,
      exclosos: result.exclosos,
      noves_per_area: result.noves_per_area,
      noves_reservades: reservades.length,
      fetched: result.fetched,
      errors: result.errors,
      at: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[licitacions-sync]', message);
    try {
      await notify({
        title: 'Licitacions — sync edge FALLIT',
        body: message.slice(0, 900),
        meta: { origen: 'edge' },
      });
    } catch (_) {
      // ignore notify failure
    }
    return json({ ok: false, error: message }, 500);
  }
});
