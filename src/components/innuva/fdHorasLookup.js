/** Tabla fija HORAS FD — devengo diario → desglose por concepto (€/día). */
export const FD_DEVENGOS_TIERS = [
  { devengo: 30, salarioBase: 18.58, ppExtra: 3.1, finiquito: 1.77, mejoraVoluntaria: 6.56 },
  { devengo: 50, salarioBase: 30.96, ppExtra: 5.16, finiquito: 2.97, mejoraVoluntaria: 10.91 },
  { devengo: 55, salarioBase: 34.06, ppExtra: 5.68, finiquito: 3.27, mejoraVoluntaria: 12 },
  { devengo: 60, salarioBase: 37.15, ppExtra: 6.19, finiquito: 3.56, mejoraVoluntaria: 13.09 },
  { devengo: 70, salarioBase: 43.34, ppExtra: 7.22, finiquito: 4.16, mejoraVoluntaria: 15.28 },
  { devengo: 80, salarioBase: 49.54, ppExtra: 8.26, finiquito: 4.75, mejoraVoluntaria: 17.45 },
  { devengo: 90, salarioBase: 55.73, ppExtra: 9.29, finiquito: 5.34, mejoraVoluntaria: 19.64 },
  { devengo: 100, salarioBase: 61.92, ppExtra: 10.32, finiquito: 5.94, mejoraVoluntaria: 21.82 },
  { devengo: 110, salarioBase: 68.11, ppExtra: 11.35, finiquito: 6.53, mejoraVoluntaria: 24 },
  { devengo: 120, salarioBase: 74.3, ppExtra: 12.38, finiquito: 7.13, mejoraVoluntaria: 26.19 },
  { devengo: 130, salarioBase: 80.5, ppExtra: 13.42, finiquito: 7.72, mejoraVoluntaria: 28.37 },
  { devengo: 140, salarioBase: 86.69, ppExtra: 14.45, finiquito: 8.31, mejoraVoluntaria: 30.55 },
  { devengo: 150, salarioBase: 92.88, ppExtra: 15.48, finiquito: 8.91, mejoraVoluntaria: 32.73 },
  { devengo: 155, salarioBase: 95.98, ppExtra: 16, finiquito: 9.2, mejoraVoluntaria: 33.82 },
  { devengo: 160, salarioBase: 99.07, ppExtra: 16.51, finiquito: 9.5, mejoraVoluntaria: 34.92 },
  { devengo: 170, salarioBase: 105.26, ppExtra: 17.54, finiquito: 10.1, mejoraVoluntaria: 37.09 },
  { devengo: 175, salarioBase: 108.36, ppExtra: 18.06, finiquito: 10.39, mejoraVoluntaria: 38.19 },
  { devengo: 180, salarioBase: 111.46, ppExtra: 18.58, finiquito: 10.69, mejoraVoluntaria: 39.28 },
  { devengo: 190, salarioBase: 117.65, ppExtra: 19.61, finiquito: 11.28, mejoraVoluntaria: 41.46 },
  { devengo: 200, salarioBase: 123.84, ppExtra: 20.64, finiquito: 11.88, mejoraVoluntaria: 43.84 },
  { devengo: 205, salarioBase: 126.94, ppExtra: 21.16, finiquito: 12.17, mejoraVoluntaria: 44.74 },
  { devengo: 210, salarioBase: 130.03, ppExtra: 21.67, finiquito: 12.47, mejoraVoluntaria: 45.83 },
  { devengo: 230, salarioBase: 142.42, ppExtra: 23.74, finiquito: 13.66, mejoraVoluntaria: 50.19 },
  { devengo: 240, salarioBase: 148.61, ppExtra: 24.77, finiquito: 14.25, mejoraVoluntaria: 52.37 },
  { devengo: 270, salarioBase: 167.18, ppExtra: 27.86, finiquito: 16.03, mejoraVoluntaria: 58.92 },
  { devengo: 280, salarioBase: 173.38, ppExtra: 28.9, finiquito: 16.63, mejoraVoluntaria: 61.1 },
  { devengo: 370, salarioBase: 229.1, ppExtra: 38.18, finiquito: 21.97, mejoraVoluntaria: 80.74 },
  { devengo: 420, salarioBase: 260.06, ppExtra: 43.34, finiquito: 24.94, mejoraVoluntaria: 91.65 }
];

export function parseEuroEs(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\u00a0/g, ' ').replace(/€/g, '').trim();
  if (!s || s === '-' || /^n\/?a$/i.test(s)) return null;
  const cleaned = s.replace(/\s/g, '');
  const n = Number.parseFloat(
    cleaned.includes(',')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  );
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function formatEuroEs(value) {
  const n = Number(value) || 0;
  return n.toFixed(2).replace('.', ',');
}

/**
 * Busca el tramo de devengo diario. Coincidencia exacta (±0,02 €) o el más cercano.
 */
export function lookupFdTier(brutoDia) {
  const amount = Math.round((Number(brutoDia) || 0) * 100) / 100;
  if (amount <= 0) return { tier: null, warning: 'Bruto cero o inválido' };

  const exact = FD_DEVENGOS_TIERS.find((t) => Math.abs(t.devengo - amount) < 0.02);
  if (exact) return { tier: exact, warning: null };

  let best = FD_DEVENGOS_TIERS[0];
  let bestDiff = Math.abs(best.devengo - amount);
  for (const t of FD_DEVENGOS_TIERS) {
    const d = Math.abs(t.devengo - amount);
    if (d < bestDiff) {
      best = t;
      bestDiff = d;
    }
  }

  return {
    tier: best,
    warning: `Bruto ${formatEuroEs(amount)} € sin tramo exacto; se usa el más cercano (${formatEuroEs(best.devengo)} €).`
  };
}

export function breakdownForDay(brutoDia) {
  const { tier, warning } = lookupFdTier(brutoDia);
  if (!tier) return null;
  return {
    salarioBase: tier.salarioBase,
    ppExtra: tier.ppExtra,
    finiquito: tier.finiquito,
    mejoraVoluntaria: tier.mejoraVoluntaria,
    tierDevengo: tier.devengo,
    warning
  };
}
