import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function importParser() {
  const tmp = mkdtempSync(join(tmpdir(), 'obrador-parser-'));
  const modulePath = join(tmp, 'obradorAlbaranParser.mjs');
  writeFileSync(modulePath, readFileSync(new URL('../src/services/obradorAlbaranParser.js', import.meta.url), 'utf8'));
  return import(pathToFileURL(modulePath));
}

const { parseJotriAlbaran } = await importParser();

const jotriOcrText = [
  '###JOTRI_META###',
  'ALBARA DE VENDA',
  'Albara Data',
  '15703 28-05-26',
  '| 15234 | 28-05-26 |',
  '###JOTRI_BODY###',
  '1300452 Producte Test 987654 1 10,00 10,00'
].join('\n');

const parsed = parseJotriAlbaran(jotriOcrText);

assert(
  parsed.lotProveidor === '15703',
  `Expected original JOTRI albara 15703, got ${parsed.lotProveidor || '(empty)'}`
);

assert(
  parsed.linies.some((line) => line.codi === '1300452'),
  'Expected JOTRI numeric reference without separators to be parsed'
);

console.log('Obrador critical parser regressions passed');
