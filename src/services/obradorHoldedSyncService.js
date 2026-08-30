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
    .replace(/[\s.-]/g, '');
}

function canReuseForCompany(proveidor, company) {
  return !proveidor.holded_empresa || proveidor.holded_empresa === company;
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
    const byCif = existing.find(
      (p) => canReuseForCompany(p, company) && p.cif && normCif(p.cif) === row.cif
    );
    if (byCif) return byCif;
  }

  const nomNorm = normNom(row.nom);
  return existing.find((p) => canReuseForCompany(p, company) && normNom(p.nom) === nomNorm) || null;
}

/**
 * Importa proveïdors des de Holded → Supabase obrador_proveidors.
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
    .select('id, nom, cif, holded_contact_id, holded_empresa');

  if (fetchError) {
    if (isMissingColumnError(fetchError)) {
      throw new Error(
        `Falta executar ${PROVEIDORS_SCHEMA_SQL} a Supabase abans d'importar.`
      );
    }
    throw fetchError;
  }

  const list = existing || [];
  let inserted = 0;
  let updated = 0;

  for (const row of suppliers) {
    const match = findExistingProveidor(list, row, company);
    const payload = {
      nom: row.nom,
      cif: row.cif,
      contacte: row.contacte,
      holded_contact_id: row.holded_contact_id,
      holded_empresa: company,
      updated_at: new Date().toISOString()
    };

    if (match) {
      const { error } = await supabase
        .from('obrador_proveidors')
        .update(payload)
        .eq('id', match.id);
      if (error) throw error;
      Object.assign(match, payload);
      updated += 1;
    } else {
      const { data: created, error } = await supabase
        .from('obrador_proveidors')
        .insert({
          nom: row.nom,
          cif: row.cif,
          contacte: row.contacte,
          holded_contact_id: row.holded_contact_id,
          holded_empresa: company
        })
        .select('id, nom, cif, holded_contact_id, holded_empresa')
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
    totalInSupabase: list.length
  };
}

export { HOLDED_COMPANIES };
