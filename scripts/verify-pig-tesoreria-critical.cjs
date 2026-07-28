const fs = require('fs');
const vm = require('vm');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSourceWithTests(path, tests) {
  let source = fs.readFileSync(path, 'utf8');
  source = source.replace(/^import[\s\S]*?;\n/gm, '');
  source = source.replace(/\bexport\s+(?=(async\s+)?function|const|let|var)/g, '');
  vm.runInNewContext(`${source}\n${tests}`, { console, assert });
}

runSourceWithTests(
  'src/services/pigTesoreriaImpuestosService.js',
  `
  assert(accountHasExplicitBalance({ number: '47200000', balance: 0 }) === true, 'zero balance must still be explicit');
  assert(accountHasExplicitBalance({ number: '47200000' }) === false, 'missing balance fields must not be accepted');

  const missingBalance = buildBalanceMap([{ number: '47200000', name: 'IVA soportado' }]);
  assert(missingBalance.matchedRequestedCodes.has('47200000'), 'fiscal account should be matched by exact code');
  assert(missingBalance.matchedCodesWithBalance.size === 0, 'fiscal account without balance must be detected');

  const withBalance = buildBalanceMap([{ number: '47510000', debit: 0, credit: 125.5 }]);
  assert(withBalance.matchedCodesWithBalance.has('47510000'), 'debit/credit fields must count as explicit balance');
  assert(withBalance.map.get('47510000') === -125.5, 'debit-credit balance should be preserved');
  `
);

runSourceWithTests(
  'src/services/pigPrevisionTesoreriaService.js',
  `
  assert(paymentIsExplicitSale({ amount: 100, date: '2026-01-02' }) === false, 'untyped payments must not be treated as sales');
  assert(paymentIsExplicitSale({ documentType: 'invoice', amount: 100 }) === true, 'invoice payments should be accepted');
  assert(paymentIsExplicitSale({ documentType: 'purchase', amount: 100 }) === false, 'purchase payments must be rejected');
  assert(paymentIsExplicitSale({ document: { type: 'sales_receipt' }, amount: 100 }) === true, 'nested sales receipts should be accepted');
  `
);

console.log('OK verify-pig-tesoreria-critical');
