import { PIG_CREDIT_LINES } from './pigTesoreriaCreditsData';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDue(iso) {
  const [y, m, d] = String(iso || '').split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function eur(n) {
  return Number(n).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function resolveSchedule(line, year, month) {
  const payments = line.payments || [];
  const key = `${year}-${pad2(month)}`;
  const index = payments.findIndex((payment) => String(payment.due).startsWith(key));
  if (index >= 0) {
    const payment = payments[index];
    const capital = index === 0 ? line.opening : payments[index - 1].capitalAfter;
    return {
      label: line.label,
      capital,
      quota: payment.quota,
      venciment: formatDue(payment.due),
      obs: line.obs
    };
  }

  const first = payments[0];
  const last = payments[payments.length - 1];
  if (first && key < String(first.due).slice(0, 7)) {
    return {
      label: line.label,
      capital: line.opening,
      quota: '',
      venciment: '',
      obs: `Encara no comença. Primera quota el ${formatDue(first.due)}.`
    };
  }

  if (line.incomplete && last) {
    return {
      label: line.label,
      capital: '',
      quota: '',
      venciment: '',
      obs: `La llista acaba el ${formatDue(last.due)}. Llavors quedaven ${eur(last.capitalAfter)} € i falten les quotes següents.`
    };
  }

  return {
    label: line.label,
    capital: last ? last.capitalAfter : '',
    quota: '',
    venciment: '',
    obs: last ? `Última quota el ${formatDue(last.due)}.` : line.obs
  };
}

/**
 * Files de Crèdits i Finançament per al mes del PIG (monthIndex 0-based).
 * El capital és el que queda abans de la quota d'aquell mes.
 */
export function creditRowsForPigMonth(year, monthIndex) {
  const y = Number(year);
  const month = Number(monthIndex) + 1;
  if (!Number.isFinite(y) || month < 1 || month > 12) return [];

  return PIG_CREDIT_LINES.map((line) => {
    if (line.static) {
      return {
        label: line.label,
        capital: line.capital,
        quota: '',
        venciment: '',
        obs: line.obs
      };
    }
    return resolveSchedule(line, y, month);
  });
}
