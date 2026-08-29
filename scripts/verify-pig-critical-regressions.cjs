const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const impuestosService = read('src/services/pigTesoreriaImpuestosService.js');
const pigPage = read('src/components/PIGPage.jsx');

assert(
  /function\s+assertImpuestosAccountsLoaded\s*\(/.test(impuestosService),
  'loadPigImpuestosBalances must validate that Holded returned fiscal accounts'
);
assert(
  /assertImpuestosAccountsLoaded\(raw\s*\|\|\s*\[\]\)/.test(impuestosService),
  'loadPigImpuestosBalances must call fiscal-account validation before building balances'
);
assert(
  /catch\s*\(\s*error\s*\)\s*\{[\s\S]*impuestos:\s*null[\s\S]*error[\s\S]*\}/.test(impuestosService),
  'loadPigImpuestosBalances must not return zero-filled impuestos when Holded fails'
);
assert(
  !/catch\s*\(\s*error\s*\)\s*\{[\s\S]{0,500}mod303:\s*IMPUESTOS_MOD_303_ACCOUNTS\.map\(\(r\)\s*=>\s*\(\{\s*\.\.\.r,\s*balance:\s*0\s*\}\)\)/.test(impuestosService),
  'Holded tax-load failures must not be converted into zero tax balances'
);

assert(
  /const\s+assertAllOk\s*=\s*\(results,\s*message\)\s*=>/.test(pigPage),
  'generateExcel must have an autosave result guard'
);
assert(
  /assertAllOk\(saveResults,\s*'No se pudieron guardar estimados, objetivos o itinerario\.'\)/.test(pigPage),
  'PIG export must abort if EISSS autosaves fail'
);
assert(
  /assertAllOk\(saveResults,\s*'No se pudieron guardar objetivos, itinerario o previsiones\.'\)/.test(pigPage),
  'Cuenta Resultados export must abort if autosaves fail'
);
assert(
  /if\s*\(\s*impuestosError\s*\)\s*\{[\s\S]{0,700}throw new Error\(/.test(pigPage),
  'generateExcel must abort instead of exporting TESORERIA with zeroed impuestos'
);

console.log('OK verify-pig-critical-regressions');
