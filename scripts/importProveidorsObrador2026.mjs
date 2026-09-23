/**
 * Importació one-shot: proveidors_obrador_2026.csv → obrador_proveidors
 *
 * REQUISITS:
 *  1. Executat alter_obrador_proveidors_estat_us.sql a Supabase
 *  2. .env amb SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (recomanat)
 *     o SUPABASE_ANON_KEY + sessió amb rol management (RLS)
 *
 * Ús (des de l'arrel del repo):
 *   node scripts/importProveidorsObrador2026.mjs
 *   node scripts/importProveidorsObrador2026.mjs --dry-run
 *
 * No esborra proveïdors. No trepitja contacte/cif/nom si ja tenen valor (Holded).
 * NIF compartit BIOCOP (actiu) vs Irigoyen (inactiu): guanya l'actiu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'proveidors_obrador_2026.csv');
const DRY_RUN = process.argv.includes('--dry-run');

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
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  const readField = () => {
    if (text[i] === '"') {
      i += 1;
      let out = '';
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            out += '"';
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        out += text[i];
        i += 1;
      }
      if (text[i] === ',') i += 1;
      return out;
    }
    let out = '';
    while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
      out += text[i];
      i += 1;
    }
    if (text[i] === ',') i += 1;
    return out;
  };

  const readRow = () => {
    if (i >= len) return null;
    if (text[i] === '\r') i += 1;
    if (text[i] === '\n') {
      i += 1;
      return null;
    }
    const fields = [];
    while (i < len && text[i] !== '\n' && text[i] !== '\r') {
      fields.push(readField());
    }
    if (text[i] === '\r') i += 1;
    if (text[i] === '\n') i += 1;
    return fields;
  };

  const header = readRow();
  if (!header) throw new Error('CSV buit');
  const keys = header.map((h) => String(h || '').trim());

  while (i < len) {
    const fields = readRow();
    if (!fields || fields.every((f) => !String(f || '').trim())) continue;
    const obj = {};
    keys.forEach((k, idx) => {
      obj[k] = fields[idx] != null ? String(fields[idx]).trim() : '';
    });
    rows.push(obj);
  }
  return rows;
}

function normNom(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function normCif(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^ES/, '')
    .replace(/[\s.\-/]/g, '');
}

function isActiveEstat(estat) {
  return estat === 'habitual' || estat === 'ocasional';
}

function estatPriority(estat) {
  const map = { habitual: 4, ocasional: 3, revisar: 2, inactiu: 1 };
  return map[estat] || 0;
}

function buildContacteSummary(row) {
  const parts = [
    row.contacte,
    row.telefon,
    row.mobil,
    row.email
  ].map((x) => String(x || '').trim()).filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function shouldDiscardRow(row) {
  const nom = String(row.nom || '').trim();
  if (!nom || nom === '-') return true;
  const estat = String(row.estat_us || '').trim();
  if (!['habitual', 'ocasional', 'inactiu', 'revisar'].includes(estat)) return true;
  return false;
}

loadEnv();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Falta SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY (o ANON) al .env');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '⚠️  Sense SUPABASE_SERVICE_ROLE_KEY: RLS pot bloquejar inserts/updates amb la anon key.'
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const rawRows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
const csvRows = rawRows
  .filter((r) => !shouldDiscardRow(r))
  .map((r) => ({
    codi: String(r.codi || '').trim(),
    nom: String(r.nom || '').trim(),
    estat_us: String(r.estat_us || '').trim(),
    nif_normalitzat: normCif(r.nif_normalitzat || r.nif || ''),
    contacte_summary: buildContacteSummary(r)
  }))
  .sort((a, b) => estatPriority(b.estat_us) - estatPriority(a.estat_us));

console.log(`CSV: ${rawRows.length} files · útils: ${csvRows.length}${DRY_RUN ? ' · DRY-RUN' : ''}`);

const { data: existing, error: fetchError } = await supabase
  .from('obrador_proveidors')
  .select('id, nom, cif, contacte, estat_us, codi_intern, holded_contact_id');

if (fetchError) {
  console.error('Error llegint obrador_proveidors:', fetchError.message);
  console.error('Has executat database/alter_obrador_proveidors_estat_us.sql?');
  process.exit(1);
}

const list = [...(existing || [])];
const existingIdsAtStart = new Set(list.map((p) => p.id));
const nifClaimedByActive = new Set(); // NIF reclamat per una fila CSV habitual/ocasional
const touchedIds = new Set(); // ids tocats per aquest import (update o insert)

const report = {
  updated: [],
  inserted: [],
  skipped_nif_conflict: [],
  name_match_no_nif: [],
  inserted_no_nif: [],
  demoted_to_inactiu: []
};

function findByNif(nif) {
  if (!nif) return null;
  return list.find((p) => p.cif && normCif(p.cif) === nif) || null;
}

function findByNom(nom) {
  const n = normNom(nom);
  return list.find((p) => normNom(p.nom) === n) || null;
}

for (const row of csvRows) {
  let match = null;
  let matchMode = null;

  if (row.nif_normalitzat) {
    match = findByNif(row.nif_normalitzat);
    if (match) matchMode = 'nif';
  }
  if (!match) {
    match = findByNom(row.nom);
    if (match) matchMode = 'nom';
  }

  // Només conflicte Biocop/Irigoyen: NIF ja reclamat per un CSV actiu en aquest mateix import
  if (
    row.nif_normalitzat &&
    !isActiveEstat(row.estat_us) &&
    nifClaimedByActive.has(row.nif_normalitzat)
  ) {
    report.skipped_nif_conflict.push({
      codi: row.codi,
      nom: row.nom,
      estat_us: row.estat_us,
      nif: row.nif_normalitzat,
      motiu: 'NIF ja assignat a un proveïdor actiu del CSV (habitual/ocasional)'
    });
    continue;
  }

  if (match) {
    // Si ja hem tocat aquest id amb un CSV de prioritat més alta, no el devaluem
    if (
      touchedIds.has(match.id) &&
      estatPriority(row.estat_us) < estatPriority(match.estat_us)
    ) {
      report.skipped_nif_conflict.push({
        codi: row.codi,
        nom: row.nom,
        estat_us: row.estat_us,
        nif: row.nif_normalitzat,
        match_id: match.id,
        match_nom: match.nom,
        motiu: `Registre ja actualitzat a ${match.estat_us}; s'omet ${row.estat_us}`
      });
      continue;
    }

    const patch = {
      estat_us: row.estat_us,
      codi_intern: row.codi || match.codi_intern || null,
      updated_at: new Date().toISOString()
    };
    // Només omplir contacte / cif si estan buits
    if (!String(match.contacte || '').trim() && row.contacte_summary) {
      patch.contacte = row.contacte_summary;
    }
    if (!String(match.cif || '').trim() && row.nif_normalitzat) {
      patch.cif = row.nif_normalitzat;
    }

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('obrador_proveidors')
        .update(patch)
        .eq('id', match.id);
      if (error) {
        console.error(`Update fallit ${row.nom}:`, error.message);
        process.exit(1);
      }
    }

    Object.assign(match, patch);
    touchedIds.add(match.id);
    report.updated.push({
      codi: row.codi,
      nom: row.nom,
      estat_us: row.estat_us,
      match_mode: matchMode,
      id: match.id,
      match_nom: match.nom
    });

    if (row.nif_normalitzat && isActiveEstat(row.estat_us)) {
      nifClaimedByActive.add(row.nif_normalitzat);
    }
    if (!row.nif_normalitzat && matchMode === 'nom') {
      report.name_match_no_nif.push({ codi: row.codi, nom: row.nom, id: match.id });
    }
    continue;
  }

  // Insert nou
  const insertRow = {
    nom: row.nom,
    estat_us: row.estat_us,
    codi_intern: row.codi || null,
    cif: row.nif_normalitzat || null,
    contacte: row.contacte_summary
  };

  if (!DRY_RUN) {
    const { data: created, error } = await supabase
      .from('obrador_proveidors')
      .insert(insertRow)
      .select('id, nom, cif, contacte, estat_us, codi_intern, holded_contact_id')
      .single();
    if (error) {
      console.error(`Insert fallit ${row.nom}:`, error.message);
      process.exit(1);
    }
    list.push(created);
    touchedIds.add(created.id);
    report.inserted.push({
      codi: row.codi,
      nom: row.nom,
      estat_us: row.estat_us,
      id: created.id,
      sense_nif: !row.nif_normalitzat
    });
    if (!row.nif_normalitzat) {
      report.inserted_no_nif.push({ codi: row.codi, nom: row.nom, id: created.id, estat_us: row.estat_us });
    }
  } else {
    const dryId = `dry-${row.codi}`;
    list.push({
      id: dryId,
      nom: row.nom,
      cif: row.nif_normalitzat || null,
      contacte: row.contacte_summary,
      estat_us: row.estat_us,
      codi_intern: row.codi
    });
    touchedIds.add(dryId);
    report.inserted.push({
      codi: row.codi,
      nom: row.nom,
      estat_us: row.estat_us,
      id: dryId,
      sense_nif: !row.nif_normalitzat
    });
    if (!row.nif_normalitzat) {
      report.inserted_no_nif.push({
        codi: row.codi,
        nom: row.nom,
        id: dryId,
        estat_us: row.estat_us
      });
    }
  }

  if (row.nif_normalitzat && isActiveEstat(row.estat_us)) {
    nifClaimedByActive.add(row.nif_normalitzat);
  }
}

// Holded va omplir centenars de proveïdors amb default habitual.
// Els que NO surten al CSV oficial → inactiu (queden a l'històric, no al selector).
for (const p of list) {
  if (touchedIds.has(p.id)) continue;
  if (!existingIdsAtStart.has(p.id)) continue;
  if (p.estat_us === 'inactiu') continue;

  const patch = {
    estat_us: 'inactiu',
    updated_at: new Date().toISOString()
  };
  if (!DRY_RUN) {
    const { error } = await supabase
      .from('obrador_proveidors')
      .update(patch)
      .eq('id', p.id);
    if (error) {
      console.error(`Demote fallit ${p.nom}:`, error.message);
      process.exit(1);
    }
  }
  Object.assign(p, patch);
  report.demoted_to_inactiu.push({ id: p.id, nom: p.nom });
}

const byEstat = { habitual: 0, ocasional: 0, inactiu: 0, revisar: 0 };
for (const p of list) {
  if (byEstat[p.estat_us] != null) byEstat[p.estat_us] += 1;
}

const csvActius = csvRows.filter((r) => isActiveEstat(r.estat_us)).length;

console.log('\n=== INFORME ===');
console.log(`Actualitzats (CSV): ${report.updated.length}`);
console.log(`Inserits (CSV):     ${report.inserted.length}`);
console.log(`Passats a inactiu (Holded fora del CSV): ${report.demoted_to_inactiu.length}`);
console.log(`Omesos NIF conflicte (actiu CSV guanya): ${report.skipped_nif_conflict.length}`);
console.log(`Match per nom sense NIF: ${report.name_match_no_nif.length}`);
console.log(`Inserits sense NIF (revisar a mà): ${report.inserted_no_nif.length}`);
console.log(`CSV actius (habitual+ocasional): ${csvActius}`);
console.log('Comptadors estat_us (post-import):', byEstat);
console.log(`Actius al selector (habitual+ocasional): ${byEstat.habitual + byEstat.ocasional}`);

if (report.skipped_nif_conflict.length) {
  console.log('\n--- Conflictes NIF ---');
  for (const x of report.skipped_nif_conflict) {
    console.log(`  codi ${x.codi} ${x.nom} (${x.estat_us}) → ${x.motiu}`);
  }
}
if (report.inserted_no_nif.length) {
  console.log('\n--- Sense NIF (inserits o a revisar) ---');
  for (const x of report.inserted_no_nif) {
    console.log(`  codi ${x.codi} ${x.nom} (${x.estat_us}) id=${x.id}`);
  }
}
if (report.name_match_no_nif.length) {
  console.log('\n--- Match per nom (sense NIF al CSV) ---');
  for (const x of report.name_match_no_nif) {
    console.log(`  codi ${x.codi} ${x.nom} → id ${x.id}`);
  }
}

const outPath = path.join(ROOT, 'scripts', 'importProveidorsObrador2026.report.json');
fs.writeFileSync(outPath, JSON.stringify({ dryRun: DRY_RUN, byEstat, ...report }, null, 2), 'utf8');
console.log(`\nInforme JSON: ${outPath}`);
console.log(DRY_RUN ? '\nDRY-RUN: no s\'ha escrit a Supabase.' : '\nFet.');
