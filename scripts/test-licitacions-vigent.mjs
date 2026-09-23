import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const helperPath = path.join(root, 'src', 'services', 'licitacionsVigent.js');
const source = fs.readFileSync(helperPath, 'utf8');

const commonJsSource = `${source
  .replace(/export const (\w+) =/g, 'const $1 =')
  .replace(/export function (\w+)\(/g, 'function $1(')}

module.exports = {
  LICITACIONES_CERRADAS,
  daysUntil,
  isLicitacioVigent,
  hasLicitacioSeguiment,
  shouldPurgeLicitacioFromDb
};
`;

const module = { exports: {} };
vm.runInNewContext(commonJsSource, { module, exports: module.exports, Set, Date, String, Math });

const {
  isLicitacioVigent,
  hasLicitacioSeguiment,
  shouldPurgeLicitacioFromDb
} = module.exports;

assert.equal(
  isLicitacioVigent({ source: 'TED', estat_contractacio: 'PUB', termini_oferta: null }),
  true,
  'PUB notices without a parsed deadline must not be treated as expired'
);

assert.equal(
  shouldPurgeLicitacioFromDb({
    id: 1,
    estat_contractacio: 'EV',
    termini_oferta: '2000-01-01',
    estat_jc: 'Pendent',
    notes_paula: 'Llamar el lunes'
  }),
  false,
  'expired rows with saved notes must not be purged'
);

assert.equal(
  shouldPurgeLicitacioFromDb({
    id: 2,
    estat_contractacio: 'EV',
    termini_oferta: '2000-01-01',
    estat_jc: 'Pendent',
    data_contacte: '2026-07-03'
  }),
  false,
  'expired rows with contact dates must not be purged'
);

assert.equal(
  hasLicitacioSeguiment({
    estat_jc: 'Pendent',
    notes_paula: '   ',
    resultat_jc: '',
    data_contacte: null
  }),
  false,
  'blank tracking fields should not block purge'
);

assert.equal(
  shouldPurgeLicitacioFromDb({
    id: 3,
    estat_contractacio: 'EV',
    termini_oferta: '2000-01-01',
    estat_jc: 'Pendent'
  }),
  true,
  'expired pending rows without tracking can still be purged'
);

console.log('licitacionsVigent regression tests passed');
