const SENSITIVE_LABEL_RE = {
  dni: /\b(dni|nif|nie|cif)\b/i,
  phone: /\b(tel[eé]fono|m[oó]vil|otp)\b/i,
  email: /\b(email|correo)\b/i,
  iban: /\b(iban|cuenta)\b/i,
  name: /\b(nombre|trabajador|socio|empleado|titular)\b/i,
  money: /\b(importe|total|precio|saldo|abono|factura|pagar|promedio|valor|venta|compra|gasto|ingreso|beneficio|sueldo|salario|n[oó]mina|eur|€|monto|presupuesto|proforma|tesorer[ií]a)\b/i,
  stat: /\b(cantidad|n[uú]mero|unidades|registros|compras procesadas|proveedores)\b/i
};

export function sensitiveTypeFromLabel(label) {
  const l = String(label || '').trim();
  if (!l) return null;
  if (SENSITIVE_LABEL_RE.dni.test(l)) return 'dni';
  if (SENSITIVE_LABEL_RE.phone.test(l)) return 'phone';
  if (SENSITIVE_LABEL_RE.email.test(l)) return 'email';
  if (SENSITIVE_LABEL_RE.iban.test(l)) return 'iban';
  if (SENSITIVE_LABEL_RE.name.test(l)) return 'name';
  if (SENSITIVE_LABEL_RE.money.test(l)) return 'money';
  if (SENSITIVE_LABEL_RE.stat.test(l)) return 'stat';
  return null;
}

function maskName(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 1) return '*';
      return `${word[0]}${'*'.repeat(Math.max(2, word.length - 1))}`;
    })
    .join(' ');
}

function maskDni(value) {
  const s = String(value).replace(/\s/g, '');
  if (s.length <= 4) return '****';
  return `${'*'.repeat(s.length - 4)}${s.slice(-4)}`;
}

function maskPhone(value) {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '*** *** ***';
  const tail = digits.slice(-2);
  return `*** *** **${tail}`;
}

function maskEmail(value) {
  const s = String(value).trim();
  const at = s.indexOf('@');
  if (at <= 0) return '***@***';
  const domain = s.slice(at + 1);
  return `***@${domain || '***'}`;
}

function maskIban(value) {
  const s = String(value).replace(/\s/g, '');
  if (s.length <= 4) return '****';
  return `${s.slice(0, 2)}${'*'.repeat(Math.max(4, s.length - 6))}${s.slice(-4)}`;
}

function maskMoney(value) {
  const s = String(value).trim();
  const symbolMatch = s.match(/^([€$£¥]|CHF|C\$|A\$)/) || s.match(/([€$£¥])\s*$/);
  const symbol = symbolMatch ? symbolMatch[1] : '€';
  return `${symbol}\u00a0••••••`;
}

function maskStat(value) {
  const s = String(value).trim();
  if (/^\d+$/.test(s)) return '•••';
  return '••••••';
}

function maskGeneric(value) {
  const s = String(value);
  if (!s) return s;
  return '*'.repeat(Math.min(Math.max(s.length, 6), 12));
}

function looksLikeMoney(value) {
  const s = String(value).trim();
  return /[€$£¥]/.test(s) || /^\d{1,3}(\.\d{3})*,\d{2}(\s*€)?$/.test(s) || /^\d+([.,]\d{2})?\s*€$/.test(s);
}

export function maskSensitiveValue(value, type = 'text') {
  if (value == null || value === '') return value;
  const s = String(value);
  switch (type) {
    case 'name':
      return maskName(s);
    case 'dni':
      return maskDni(s);
    case 'phone':
      return maskPhone(s);
    case 'email':
      return maskEmail(s);
    case 'iban':
      return maskIban(s);
    case 'money':
      return maskMoney(s);
    case 'stat':
    case 'number':
      return maskStat(s);
    case 'auto': {
      if (/\S+@\S+\.\S+/.test(s)) return maskEmail(s);
      if (/^\d{8,9}[A-Za-z]?$/.test(s.replace(/\s/g, ''))) return maskDni(s);
      if (/^\+?\d[\d\s().-]{7,}$/.test(s)) return maskPhone(s);
      if (/^[A-Z]{2}\d{2}/i.test(s.replace(/\s/g, ''))) return maskIban(s);
      if (looksLikeMoney(s)) return maskMoney(s);
      if (/^\d+$/.test(s)) return maskStat(s);
      return maskGeneric(s);
    }
    default:
      return maskGeneric(s);
  }
}
