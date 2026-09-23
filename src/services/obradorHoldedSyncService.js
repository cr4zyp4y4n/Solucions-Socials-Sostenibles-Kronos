import holdedApi from './holdedApi';
import { supabase } from '../config/supabase';
import { isMissingColumnError, PROVEIDORS_SCHEMA_SQL } from './obradorSupabaseService';

const HOLDED_COMPANIES = {
  solucions: 'Solucions Socials Sostenibles',
  menjar: "Menjar d'Hort"
};

function normNom(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function normCif(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^ES/, '')
    .replace(/[\s.\-/]/g, '');
}

/** CIF/NIF des del contacte Holded (taxId, code, etc.). */
export function extractHoldedContactCif(contact) {
  const raw =
    contact?.taxId ||
    contact?.taxid ||
    contact?.vatNumber ||
    contact?.vat ||
    contact?.nif ||
    contact?.code ||
    '';
  const cif = normCif(raw);
  return /^[A-Z0-9]{8,12}$/.test(cif) ? cif : '';
}

export function isHoldedSupplierContact(contact) {
  const type = String(contact?.type || '').toLowerCase();
  if (type === 'supplier' || type === 'creditor') return true;
  if (contact?.supplierRecord != null && contact.supplierRecord !== '') return true;
  return false;
}

export function mapHoldedContactToProveidor(contact, company = 'solucions') {
  const nom = String(contact?.name || contact?.company || '').trim();
  if (!nom) return null;

  const email = contact?.email || '';
  const phone = contact?.mobile || contact?.phone || '';
  const contacte = [email, phone].filter(Boolean).join(' · ') || null;

  return {
    nom,
    cif: extractHoldedContactCif(contact) || null,
    contacte,
    holded_contact_id: String(contact.id),
    holded_empresa: company
  };
}

function findExistingProveidor(existing, row, company) {
  const byHolded = existing.find(
    (p) =>
      p.holded_contact_id === row.holded_contact_id &&
      p.holded_empresa === company
  );
  if (byHolded) return byHolded;

  if (row.cif) {
    const byCif = existing.find((p) => p.cif && normCif(p.cif) === row.cif);
    if (byCif) return byCif;
  }

  const nomNorm = normNom(row.nom);
  return existing.find((p) => normNom(p.nom) === nomNorm) || null;
}

/**
 * Payload d'UPDATE: mai inclou estat_us ni codi_intern (llistat Compres / CSV).
 * No trepitja contacte/cif si ja tenen valor i Holded ve buit.
 */
export function buildHoldedSyncUpdatePayload(match, row, company) {
  const payload = {
    holded_contact_id: row.holded_contact_id,
    holded_empresa: company,
    updated_at: new Date().toISOString()
  };

  if (row.nom) payload.nom = row.nom;
  if (row.cif) payload.cif = row.cif;

  const matchContacte = String(match.contacte || '').trim();
  if (row.contacte && !matchContacte) {
    payload.contacte = row.contacte;
  }

  return payload;
}

/**
 * Importa proveïdors des de Holded → Supabase obrador_proveidors.
 * Blindatge CSV: no modifica estat_us ni codi_intern.
 * Inserts nous: sense aquests camps → default BD (habitual).
 * Només des de Kronos (Electron + holdedApi).
 */
export async function syncProveidorsFromHolded(company = 'solucions') {
  if (!HOLDED_COMPANIES[company]) {
    throw new Error(`Empresa Holded desconeguda: ${company}`);
  }

  const allContacts = await holdedApi.getAllContacts(company);
  const suppliers = (allContacts || [])
    .filter(isHoldedSupplierContact)
    .map((c) => mapHoldedContactToProveidor(c, company))
    .filter(Boolean);

  const { data: existing, error: fetchError } = await supabase
    .from('obrador_proveidors')
    .select('id, nom, cif, contacte, estat_us, codi_intern, holded_contact_id, holded_empresa');

  if (fetchError) {
    if (isMissingColumnError(fetchError)) {
      throw new Error(
        `Falta executar ${PROVEIDORS_SCHEMA_SQL} (i alter_obrador_proveidors_estat_us.sql si cal) a Supabase abans d'importar.`
      );
    }
    throw fetchError;
  }

  const list = existing || [];
  let inserted = 0;
  let updated = 0;

  for (const row of suppliers) {
    const match = findExistingProveidor(list, row, company);

    if (match) {
      const payload = buildHoldedSyncUpdatePayload(match, row, company);
      const { error } = await supabase
        .from('obrador_proveidors')
        .update(payload)
        .eq('id', match.id);
      if (error) throw error;
      Object.assign(match, payload);
      // Conserva estat_us / codi_intern a memòria (no venien al payload)
      updated += 1;
    } else {
      // No passar estat_us ni codi_intern → DEFAULT habitual a BD
      const { data: created, error } = await supabase
        .from('obrador_proveidors')
        .insert({
          nom: row.nom,
          cif: row.cif,
          contacte: row.contacte,
          holded_contact_id: row.holded_contact_id,
          holded_empresa: company
        })
        .select('id, nom, cif, contacte, estat_us, codi_intern, holded_contact_id, holded_empresa')
        .single();
      if (error) throw error;
      list.push(created);
      inserted += 1;
    }
  }

  return {
    company,
    companyLabel: HOLDED_COMPANIES[company],
    holdedContactsTotal: allContacts?.length || 0,
    suppliersFound: suppliers.length,
    inserted,
    updated,
    totalInSupabase: list.length,
    note: 'estat_us i codi_intern no modificats (llistat Compres)'
  };
}

export { HOLDED_COMPANIES };
