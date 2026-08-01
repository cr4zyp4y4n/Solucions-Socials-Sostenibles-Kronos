const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function extractFunction(source, name) {
  const declaration = source.indexOf(`function ${name}`);
  const asyncDeclaration = source.indexOf(`async function ${name}`);
  const start = declaration >= 0 ? declaration : asyncDeclaration;
  assert(start >= 0, `No se encuentra la función ${name}`);

  let bodyStart = -1;
  let parenDepth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '(') parenDepth += 1;
    if (source[i] === ')') parenDepth -= 1;
    if (source[i] === '{' && parenDepth === 0) {
      bodyStart = i;
      break;
    }
  }
  assert(bodyStart >= 0, `No se encuentra el cuerpo de ${name}`);

  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  throw new Error(`No se pudo extraer ${name}`);
}

function verifyService({ file, upsertFn, helperFn, table }) {
  const source = readRepoFile(file);
  const upsertBody = extractFunction(source, upsertFn);
  const helperBody = extractFunction(source, helperFn);

  assert(
    !/\.delete\(\)[\s\S]{0,120}\.eq\(['"]year['"]/.test(source),
    `${file}: no debe borrar por year antes de reinsertar filas editables`
  );
  assert(
    !upsertBody.includes('.delete()') && upsertBody.includes(`${helperFn}(y, payload)`),
    `${file}: ${upsertFn} debe delegar el reemplazo seguro`
  );
  assert(
    helperBody.includes(`.from('${table}')`) && helperBody.includes(".select('id')") && helperBody.includes(".eq('year', year)"),
    `${file}: ${helperFn} debe capturar IDs previos del año`
  );
  assert(
    helperBody.includes('.insert(payload)'),
    `${file}: ${helperFn} debe insertar la nueva versión antes de borrar la anterior`
  );
  assert(
    helperBody.includes(".in('id', previousIds)") && !helperBody.includes(".eq('year', year);\n    if (deleteError)"),
    `${file}: ${helperFn} debe borrar solo IDs previos, no todo el año`
  );
}

verifyService({
  file: 'src/services/pigItinerarioEiService.js',
  upsertFn: 'upsertPigItinerarioEi',
  helperFn: 'replaceItinerarioForYearSafely',
  table: 'pig_itinerario_ei'
});

verifyService({
  file: 'src/services/pigTesoreriaPrevisionesService.js',
  upsertFn: 'upsertPigTesoreriaPrevisiones',
  helperFn: 'replacePrevisionesForYearSafely',
  table: 'pig_tesoreria_previsiones'
});

console.log('OK pig editable safe replace');
