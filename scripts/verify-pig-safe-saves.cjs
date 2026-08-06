const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionBody(source, functionName) {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `${functionName}: no se encontro la funcion`);
  const open = source.indexOf('{', start);
  assert(open >= 0, `${functionName}: no se encontro el cuerpo`);

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`${functionName}: cuerpo incompleto`);
}

function assertNoDeleteBeforeWrite({ relPath, functionName }) {
  const body = functionBody(read(relPath), functionName);
  const firstDelete = body.indexOf('.delete()');
  const firstWrite = (() => {
    const insert = body.indexOf('.insert(');
    const upsert = body.indexOf('.upsert(');
    if (insert < 0) return upsert;
    if (upsert < 0) return insert;
    return Math.min(insert, upsert);
  })();
  assert(firstWrite >= 0, `${functionName}: no se encontro insert/upsert`);
  assert(
    firstDelete < 0 || firstWrite < firstDelete,
    `${functionName}: vuelve a borrar antes de escribir`
  );
}

function assertContains({ relPath, needle }) {
  assert(read(relPath).includes(needle), `${relPath}: falta ${needle}`);
}

[
  {
    relPath: 'src/services/pigObjetivosComparativaService.js',
    functionName: 'upsertPigObjetivosComparativa'
  },
  {
    relPath: 'src/services/pigEstimadosSubvencionService.js',
    functionName: 'upsertPigEstimadosSubvencion'
  },
  {
    relPath: 'src/services/pigItinerarioEiService.js',
    functionName: 'upsertPigItinerarioEi'
  },
  {
    relPath: 'src/services/pigTesoreriaPrevisionesService.js',
    functionName: 'upsertPigTesoreriaPrevisiones'
  }
].forEach(assertNoDeleteBeforeWrite);

assertContains({
  relPath: 'src/services/pigObjetivosComparativaService.js',
  needle: ".upsert(payload, { onConflict: 'linea,year,variant' })"
});
assertContains({
  relPath: 'src/services/pigEstimadosSubvencionService.js',
  needle: ".upsert(payload, { onConflict: 'linea,year,slot,segment' })"
});

console.log('OK PIG safe saves: no delete-before-write replacements');
