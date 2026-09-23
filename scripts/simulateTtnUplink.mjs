/**
 * Simulador d'uplinks TTN v3 → Edge Function ttn-webhook (Ac3 Tasca 2.5)
 *
 * REQUISITS:
 *  - Edge `ttn-webhook` desplegada
 *  - .env amb TTN_WEBHOOK_SECRET (el mateix que a Supabase secrets)
 *  - Per --prepare: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Ús (arrel del repo):
 *   node scripts/simulateTtnUplink.mjs --prepare
 *   node scripts/simulateTtnUplink.mjs --scenario normal
 *   node scripts/simulateTtnUplink.mjs --scenario fora_rang
 *   node scripts/simulateTtnUplink.mjs --scenario torna_rang
 *   node scripts/simulateTtnUplink.mjs --scenario retransmisio
 *   node scripts/simulateTtnUplink.mjs --scenario sense_secret
 *   node scripts/simulateTtnUplink.mjs --scenario normal --dev-eui 0000000000000001
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv();

function argValue(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const PROJECT_REF = 'zalnsacawwekmibhoiba';
const WEBHOOK_URL =
  process.env.TTN_WEBHOOK_URL ||
  `https://${PROJECT_REF}.supabase.co/functions/v1/ttn-webhook`;
const SECRET = process.env.TTN_WEBHOOK_SECRET || '';
const DEV_EUI = String(argValue('--dev-eui', '0000000000000001')).replace(/[^a-fA-F0-9]/g, '').toUpperCase();
const SCENARIO = argValue('--scenario', 'normal');
const DO_PREPARE = process.argv.includes('--prepare');

function buildUplink({ temperature, humidity = 55, receivedAt = new Date(), deviceId = 'sim-em320' }) {
  const iso = new Date(receivedAt).toISOString();
  return {
    end_device_ids: {
      device_id: deviceId,
      application_ids: { application_id: 'obrador-sim' },
      dev_eui: DEV_EUI
    },
    received_at: iso,
    uplink_message: {
      received_at: iso,
      f_port: 85,
      decoded_payload: {
        temperature,
        humidity,
        // Format típic Milesight EM320-TH (decoder oficial)
        battery: 97
      }
    }
  };
}

async function postUplink(body, { withSecret = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  // El gateway de Supabase a menudo exige Authorization aunque verify_jwt=false.
  const gatewayKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  if (gatewayKey) {
    headers.Authorization = `Bearer ${gatewayKey}`;
    headers.apikey = gatewayKey;
  }

  if (withSecret) {
    if (!SECRET) {
      throw new Error('Falta TTN_WEBHOOK_SECRET a .env (o variable d\'entorn)');
    }
    headers['X-Webhook-Secret'] = SECRET;
  }
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function prepareSensorsForTest() {
  const url = process.env.SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) {
    throw new Error('--prepare necessita SUPABASE_SERVICE_ROLE_KEY a .env');
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // VALORS DE PROVA (NO APPCC). Marcat a notes. Cristina substituirà després.
  const { data, error } = await supabase
    .from('obrador_sensors')
    .update({
      actiu: true,
      llindar_min: 0,
      llindar_max: 8,
      minuts_tolerancia: 1,
      minuts_sense_senyal: 30,
      notes:
        'TEST simulador — llindars 0…8°C i tolerància 1 min. NO són valors APPCC. Substituir DevEUI i llindars quan arribi hardware / Cristina.',
      updated_at: new Date().toISOString()
    })
    .like('dev_eui', '000000000000000%')
    .select('id, nom, dev_eui, actiu, llindar_min, llindar_max, minuts_tolerancia');

  if (error) throw error;
  console.log('Sensors preparats per al simulador (TEST):');
  console.table(data || []);
}

async function runScenario(name) {
  const now = Date.now();
  console.log(`\n→ Escenari: ${name} | DevEUI ${DEV_EUI}`);
  console.log(`  URL: ${WEBHOOK_URL}`);

  if (name === 'sense_secret') {
    const r = await postUplink(buildUplink({ temperature: 3.2 }), { withSecret: false });
    console.log('  Esperat 401 →', r.status, r.json);
    return;
  }

  if (name === 'normal') {
    const r = await postUplink(buildUplink({ temperature: 3.5, humidity: 62 }));
    console.log('  ', r.status, r.json);
    return;
  }

  if (name === 'fora_rang') {
    // 3 lectures fora de rang espaiades > minuts_tolerancia (1 min en --prepare)
    for (let i = 0; i < 3; i += 1) {
      const t = new Date(now - (2 - i) * 90 * 1000); // -3 min, -1.5 min, ara
      const r = await postUplink(
        buildUplink({ temperature: 14.5 + i * 0.2, humidity: 70, receivedAt: t })
      );
      console.log(`  lectura ${i + 1}:`, r.status, r.json);
    }
    return;
  }

  if (name === 'torna_rang') {
    const r = await postUplink(buildUplink({ temperature: 3.1, humidity: 58 }));
    console.log('  ', r.status, r.json);
    return;
  }

  if (name === 'retransmisio') {
    const stamp = new Date(now - 3600 * 1000);
    const body = buildUplink({ temperature: 4.2, humidity: 50, receivedAt: stamp });
    const r1 = await postUplink(body);
    const r2 = await postUplink(body);
    console.log('  1a:', r1.status, r1.json);
    console.log('  2a (duplicat esperat):', r2.status, r2.json);
    return;
  }

  throw new Error(
    `Escenari desconegut: ${name}. Usa: normal | fora_rang | torna_rang | retransmisio | sense_secret`
  );
}

async function main() {
  if (DO_PREPARE) {
    await prepareSensorsForTest();
    if (!process.argv.includes('--scenario') && SCENARIO === 'normal' && process.argv.length <= 3) {
      console.log('\nFet. Ara: node scripts/simulateTtnUplink.mjs --scenario normal');
      return;
    }
  }
  await runScenario(SCENARIO);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
