import holdedApiV2Service from './holdedApiV2Service';

const TYPE_ORDER = ['bank', 'card', 'gateway', 'cash'];

function parseBalance(value) {
  const n = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function sortTreasuryAccounts(accounts = []) {
  return [...accounts].sort((a, b) => {
    const ta = TYPE_ORDER.indexOf(String(a?.type || ''));
    const tb = TYPE_ORDER.indexOf(String(b?.type || ''));
    const oa = ta >= 0 ? ta : TYPE_ORDER.length;
    const ob = tb >= 0 ? tb : TYPE_ORDER.length;
    if (oa !== ob) return oa - ob;
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'ca');
  });
}

/** Només comptes amb IBAN (comptes bancaris reals). */
export function isTreasuryAccountWithIban(account) {
  return Boolean(String(account?.iban || '').trim());
}

export async function loadPigTreasuryAccounts({ company = 'solucions' } = {}) {
  try {
    const raw = await holdedApiV2Service.getTreasuryAccounts({ archived: false }, company);
    const accounts = sortTreasuryAccounts(
      (raw || []).filter((item) => item && item.archived !== true && isTreasuryAccountWithIban(item))
    );
    return { accounts, error: null };
  } catch (error) {
    return { accounts: [], error };
  }
}

export function buildPigTesoreriaSheetAoa({ title, accounts = [], errorMessage = '' } = {}) {
  const aoa = [];
  const meta = {
    titleRow: 0,
    summaryStartRow: 2,
    detailHeaderRow: -1,
    detailDataStartRow: -1,
    detailDataEndRow: -1,
    totalRows: []
  };

  aoa.push([title, '', '', '', '', '']);
  aoa.push(['', '', '', '', '', '']);

  if (errorMessage) {
    aoa.push([`Error API Holded: ${errorMessage}`, '', '', '', '', '']);
    return { aoa, meta };
  }

  if (!accounts.length) {
    aoa.push(['(Cap compte bancari amb IBAN trobat a Holded)', '', '', '', '', '']);
    return { aoa, meta };
  }

  const balancesByCurrency = new Map();

  for (const account of accounts) {
    const balance = parseBalance(account.balance);
    const currency = String(account.currency || 'EUR').trim() || 'EUR';
    balancesByCurrency.set(currency, (balancesByCurrency.get(currency) || 0) + balance);
  }

  // Bloc resum (estil PIG GENERAL: etiqueta a A, import a B)
  for (const account of accounts) {
    const label = account.name || '(Sense nom)';
    aoa.push([label, '', '', '', '', '']);
    aoa.push(['', parseBalance(account.balance), '', '', '', '']);
  }

  meta.summaryEndRow = aoa.length - 1;
  aoa.push(['', '', '', '', '', '']);
  aoa.push(['DETALL COMPTES BANCARIS (IBAN)', '', '', '', '', '']);
  meta.detailHeaderRow = aoa.length;
  aoa.push(['Compte', 'Divisa', 'IBAN', 'BIC', 'Saldo', 'Pend. conciliar']);

  meta.detailDataStartRow = aoa.length;
  for (const account of accounts) {
    aoa.push([
      account.name || '(Sense nom)',
      String(account.currency || 'EUR'),
      account.iban || '',
      account.bic || '',
      parseBalance(account.balance),
      Number(account.transactions_pending_to_reconcile) || 0
    ]);
  }
  meta.detailDataEndRow = aoa.length - 1;

  aoa.push(['', '', '', '', '', '']);

  const currencyKeys = [...balancesByCurrency.keys()].sort();
  for (const currency of currencyKeys) {
    const rowIdx = aoa.length;
    meta.totalRows.push(rowIdx);
    const suffix = currencyKeys.length > 1 ? ` (${currency})` : '';
    aoa.push([`TOTAL TESORERÍA${suffix}`, '', '', '', balancesByCurrency.get(currency), '']);
  }

  return { aoa, meta };
}
