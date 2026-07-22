import { maskSensitiveValue } from './sensitiveData';

export function shouldMaskDisplayValue(value) {
  const s = String(value ?? '').trim();
  if (!s) return false;
  if (s === '—' || s === 'N/A' || s === '\u00a0') return false;
  if (/^sin\s/i.test(s)) return false;
  return true;
}

export function applyPrivacyMask(value, type, hideSensitive) {
  if (!hideSensitive || !shouldMaskDisplayValue(value)) return value;
  return maskSensitiveValue(value, type);
}

export function applyPrivacyMoney(formatted, hideSensitive) {
  return applyPrivacyMask(formatted, 'money', hideSensitive);
}

export function privacyTypeFromStatLabel(label) {
  const l = String(label || '').trim();
  if (!l) return 'auto';
  if (/\b(total a pagar|promedio|importe|pagar|factura|saldo|valor|precio|venta|compra|gasto|ingreso|beneficio|abono|sueldo|salario|n[oó]mina|eur|€)\b/i.test(l)) {
    return 'money';
  }
  if (/\b(proveedor|compras procesadas|procesad|registro|cantidad|n[uú]mero)\b/i.test(l)) {
    return 'stat';
  }
  return 'auto';
}
