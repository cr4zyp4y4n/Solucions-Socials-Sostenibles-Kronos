import { parseCsvText, normalizeWorkerKey } from './fdPlantillaParser';

const EISSS_CSV = `Formato Datos Identificativos,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,500a05fe-2484-4d25-a768-f4183040e184
Cód. Empresa,Cód. Trabajador,Nom. Trabajador,Primer Apellido,Segundo Apellido,Lugar de nacimiento,Fecha de nacimiento,Sexo,Nacionalidad,Estado Civil,Nombre del padre,Nombre de la madre,¿Integra con control de presencia?,Cod. Centro,Perfil de Seguridad,NAF,Caducidad documento identificativo
1,000001,E DANIEL,GARFIAS,MICHEA,,13/06/1967,Hombre,CHILE,Soltero/a,,,Si,1,,08/11633550/18
1,000004,BRUNO,LOPEZ,JUNQUERAS,,20/05/1972,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/05005567/05
1,000005,JOAN C,LOPEZ,JUNQUERAS,,29/04/1968,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/04702756/28
1,000006,OSCAR,LOPEZ,GOMIZ,,02/05/1997,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/12730842/46
1,000008,PAULA A,BARBOSA,CACERES,,30/07/1974,Mujer,ESPAÑA,Soltero/a,,,Si,1,,08/12371130/10
1,000011,MARIA ANGELES,HERNANDEZ,FLORES,,02/03/1970,Mujer,ESPAÑA,Soltero/a,,,Si,1,,08/04809830/14
1,000012,LEO,MONEDERO,JUAN,,29/03/2004,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/13728490/49
1,000013,ELIAS,PINTACUDA,,ITALIA,11/01/1995,Hombre,ITALIA,Soltero/a,,,Si,1,,08/14492419/06
1,000014,MARYELIN ADRIANA,PAEZ,PEÑA,VENEZUELA,01/11/1994,Mujer,ESPAÑA,Soltero/a,,NUR AMALIA,Si,1,,08/15198000/09,01/06/2026
1,000015,ANGIE LIZETH,CIFUENTES,BENAVIDES,,16/02/1994,Mujer,COLOMBIA,Soltero/a,,,Si,1,,08/14685830/96
1,000023,ABU,BAKAR,,PAKISTAN,02/02/2003,Hombre,PAKISTAN,Soltero/a,,,Si,1,,09/10293738/51,26/04/2027
1,000040,DAVID,LOPEZ,GOMIZ,,01/09/2000,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/14276816/34
1,000053,ENCARNACIO,PEREZ,GARCIA,,19/04/1969,Mujer,ESPAÑA,Soltero/a,,,Si,1,,08/05311285/76
1,000058,NEREA,PAREDES,HERNANDEZ,,28/02/1998,Mujer,ESPAÑA,Soltero/a,,,Si,1,,08/12708032/31
1,000060,IONA,LOPEZ,GIMENEZ,,31/05/2008,Mujer,ESPAÑA,Soltero/a,,,Si,1,,08/14848599/02
1,000068,BELINDA,CUBAS,CASTELLANOS,,18/04/1994,Mujer,HONDURAS,Soltero/a,,,Si,1,,08/14681611/48
1,000071,ANDRES F,RAMIREZ,ARANGO,,04/03/2001,Hombre,COLOMBIA,Soltero/a,,,Si,1,,08/14694655/94
1,000072,AHMAD FAHD,ALHAMDO,,,20/01/2007,Hombre,"SIRIA, REPUBLICA ARABE",Soltero/a,,,Si,1,,08/14815437/14
1,000074,MOUSTAPHA,LO,LO,,24/01/2003,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/14455508/52
1,000077,MAMADOU,BALDE,,,06/01/1993,Hombre,GAMBIA,Soltero/a,,,Si,1,,08/13972486/90
1,000079,SAMUEL E,ANTONIO,IBARGUEN,,16/05/2006,Hombre,COLOMBIA,Soltero/a,,,Si,1,,08/14967480/58
1,000087,SUSANA,BENEDET,AGUIRRE,,18/07/1995,Hombre,ESPAÑA,Soltero/a,,,Si,1,,33/10446767/18
1,000088,JUNIOR J,ROSALES,PACHECO,,,Hombre,ESPAÑA,Soltero/a,,,Si,1,,52/10099472/67
1,000090,GIADA,FILLO,,,24/02/1994,Mujer,ITALIA,Soltero/a,,,Si,1,,38/10665706/45
1,000091,Ivan,Bravo,Diaz,,01/11/2005,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/14722380/77
1,000092,JUAN,RUIZ,BARRERA,,22/01/2001,Hombre,COLOMBIA,Soltero/a,,,Si,1,,08/15100164/46
1,000093,LOLA,IZQUIERDO,BENEDICO,,08/05/2003,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/14907163/75
1,000094,CRISTIAN,SANCHEZ,GARCIA,,,Hombre,ESPAÑA,Soltero/a,,,Si,1,,43/10625625/42
1,000095,MARINA,MORENO,SORO,,,Mujer,ESPAÑA,Soltero/a,,,Si,1,,08/12878268/32
1,000096,GIOVANA ELVIRA,LAMAURE,PARRA,,29/06/1995,Mujer,PERU,Soltero/a,,,Si,1,,11/11126875/23
1,000099,BENJAMIN,MARTINEZ,GARCIA,,18/08/1971,Hombre,ESPAÑA,Soltero/a,,,Si,1,,39/10030721/06
1,000100,PAU,RODRÍGUEZ,GEREZ,,29/12/2006,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/13775122/24
1,000101,GIULIANA,SPINUZZA,,ITALIA,19/01/1995,Mujer,ITALIA,Soltero/a,,,Si,1,,08/13926248/24
1,000102,ROBIN RAVINDER,SHARMA,FIGUEREDO,,03/11/2005,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/15155124/07
1,000103,FRANCISCA I,SILVA,IBACACHE,SAN FELIPE-CHILE,05/06/1998,Mujer,CHILE,Soltero/a,,,Si,1,,08/15120971/95,15/07/2026
1,000104,VERONICA,ESPERANZA,,ARGENTINA,22/08/1985,Mujer,ARGENTINA,Soltero/a,,,Si,1,,08/15181699/04
1,000105,PAULA,GALLARDO,VILLANUEVA,ESPAÑA,30/09/2003,Mujer,ESPAÑA,Soltero/a,,,Si,1,,08/14630255/05
1,000106,ALFREDO,MUIÑOS,BALET,,11/12/1997,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/12758084/31
1,000107,XAVIER,AYGUASENOSA,JIMENEZ,,21/06/1997,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/12597912/06
1,999991,MIGUEL ANG,SANCHEZ,IBANEZ,,,Hombre,ESPAÑA,Soltero/a,,,Si,1,,00/00000000/00
1,999992,SCP,ROSELLO,ANDUJAR,,,Hombre,ESPAÑA,Soltero/a,,,Si,1,,00/00000000/00
1,999993,MARIA DOLO,BORRELL,MUÑOZ,,,Hombre,ESPAÑA,Soltero/a,,,Si,1,,00/00000000/00
1,999995,ANDREA,GABARRO,LOPEZ,,,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/13093927/60
1,999997,JUAN,NAVARRO,BRUGER,,,Hombre,ESPAÑA,Soltero/a,,,Si,1,,00/00000000/00`;

const MH_CSV = `Formato Datos Identificativos,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,500a05fe-2484-4d25-a768-f4183040e184
Cód. Empresa,Cód. Trabajador,Nom. Trabajador,Primer Apellido,Segundo Apellido,Lugar de nacimiento,Fecha de nacimiento,Sexo,Nacionalidad,Estado Civil,Nombre del padre,Nombre de la madre,¿Integra con control de presencia?,Cod. Centro,Perfil de Seguridad,NAF,Caducidad documento identificativo
2,000001,BRUNO,LOPEZ,JUNQUERAS,,20/05/1972,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/05005567/05
2,000002,CRISTINA,ANDRES,MURCIANO,,13/07/1969,Mujer,ESPAÑA,Soltero/a,,,Si,1,,08/05323356/22
2,000008,MARIA I,LLORCA,JORDAN,,04/08/1969,Mujer,ESPAÑA,Soltero/a,,,Si,1,,08/05068190/63
2,000009,EMMY M,OMONT,,,04/02/2003,Mujer,FRANCIA,Soltero/a,,,Si,1,,08/14895140/80
2,000010,SERGIO,SANCHEZ,ALMAZAN,,27/10/1997,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/12597905/96
2,000011,IONA,LOPEZ,GIMENEZ,,31/05/2008,Mujer,ESPAÑA,Soltero/a,,,Si,1,,08/14848599/02
2,000012,MANUELA,PAHDE,BARRAGAN,,16/10/1986,Mujer,ESPAÑA,Soltero/a,,,Si,1,,28/14997532/11
2,000013,BRIAN,BAUTISTA,MARTIN,,,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/13485400/41
2,000014,DAVID,LOPEZ,GOMIZ,,01/09/2000,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/14276816/34
2,000015,MARC,FERNANDEZ,VILAMASANA,,23/07/2003,Hombre,ESPAÑA,Soltero/a,,,Si,1,,08/13033522/86
2,000017,RAMON E,ACOSTA,,,04/01/1967,Hombre,ARGENTINA,Soltero/a,,,Si,1,,08/14717324/65
2,000018,BEATRIZ,LOPEZ,JUNQUERAS,ESPAÑA,15/06/1969,Mujer,ESPAÑA,Soltero/a,CARLOS,MARIA,Si,1,,08/04949311/09,15/06/1969`;

function buildNombreInnuva(row) {
  const nom = String(row[2] || '').trim();
  const ape1 = String(row[3] || '').trim();
  const ape2 = String(row[4] || '').trim();

  const apellidos = [ape1, ape2].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const nombre = nom.replace(/\s+/g, ' ').trim();

  if (apellidos && nombre) return `${apellidos}, ${nombre}`.toUpperCase();
  if (apellidos) return apellidos.toUpperCase();
  return nombre.toUpperCase();
}

function addAlias(aliases, value) {
  const key = normalizeWorkerKey(value);
  if (key) aliases.add(key);
}

function aliasKeysFromRow(row) {
  const nom = String(row[2] || '').trim();
  const ape1 = String(row[3] || '').trim();
  const ape2 = String(row[4] || '').trim();
  const aliases = new Set();
  const nomTokens = nom.split(/\s+/).filter(Boolean);
  const firstName = nomTokens[0] || '';

  addAlias(aliases, [nom, ape1, ape2].filter(Boolean).join(' '));
  addAlias(aliases, [nom, ape1].filter(Boolean).join(' '));
  addAlias(aliases, [firstName, ape1, ape2].filter(Boolean).join(' '));
  addAlias(aliases, [firstName, ape1].filter(Boolean).join(' '));
  addAlias(aliases, [ape1, ape2].filter(Boolean).join(' '));

  if (nomTokens.length >= 2 && ape1) {
    addAlias(aliases, `${nomTokens.slice(0, 2).join(' ')} ${ape1}`);
  }

  // Innuva trunca nombres: ENCARNACIO en CSV vs Encarnación en plantilla
  if (firstName && /io$/i.test(firstName) && ape1) {
    addAlias(aliases, `${firstName.replace(/io$/i, 'ion')} ${ape1}`);
  }

  // Nombre con inicial: FRANCISCA I → plantilla puede traer solo "Francisca Silva"
  if (nomTokens.length >= 2 && nomTokens[1].length === 1 && ape1) {
    addAlias(aliases, `${firstName} ${ape1}`);
    if (ape2) addAlias(aliases, `${firstName} ${ape1} ${ape2}`);
  }

  return [...aliases].filter(Boolean);
}

function parseCatalogCsv(text, sourceLabel) {
  const rows = parseCsvText(text);
  const records = [];
  for (const row of rows.slice(2)) {
    const codigo = String(row[1] || '').trim();
    const nombre = buildNombreInnuva(row);
    if (!codigo || !nombre) continue;
    records.push({
      codigo,
      nombre,
      nom: String(row[2] || '').trim(),
      ape1: String(row[3] || '').trim(),
      ape2: String(row[4] || '').trim(),
      sourceLabel,
      aliases: aliasKeysFromRow(row)
    });
  }
  return records;
}

export async function loadInnuvaWorkersCatalog() {
  const allRecords = [
    ...parseCatalogCsv(EISSS_CSV, 'EISSS'),
    ...parseCatalogCsv(MH_CSV, 'MH')
  ];

  const aliasMap = new Map();
  aliasMap.__records = allRecords;
  for (const rec of allRecords) {
    for (const alias of rec.aliases) {
      if (!aliasMap.has(alias)) aliasMap.set(alias, rec);
    }
  }
  return aliasMap;
}

function fuzzyMatchWorker(workerName, catalogList) {
  const key = normalizeWorkerKey(workerName);
  const parts = key.split(' ').filter(Boolean);
  if (parts.length < 2) return null;

  const candidates = [];
  for (const rec of catalogList) {
    const ape1 = normalizeWorkerKey(rec.ape1);
    const ape2 = normalizeWorkerKey(rec.ape2);
    const firstName = normalizeWorkerKey((rec.nom || '').split(/\s+/)[0] || '');

    if (!ape1 || !key.includes(ape1)) continue;

    let score = 10;
    if (ape2 && key.includes(ape2)) score += 5;
    if (firstName && key.includes(firstName)) score += 8;
    else if (firstName && /io$/i.test(firstName) && key.includes(`${firstName.slice(0, -1)}on`)) {
      score += 7;
    } else if (firstName && /ion$/i.test(firstName) && key.includes(firstName.slice(0, -1))) {
      score += 7;
    }

    const nomTokens = normalizeWorkerKey(rec.nom).split(' ').filter(Boolean);
    if (nomTokens.length >= 2 && nomTokens[1].length === 1) {
      if (key.startsWith(`${nomTokens[0]} `)) score += 4;
    }

    if (score >= 18) candidates.push({ rec, score });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].rec;
}

export function resolveInnuvaWorkerMatch(workerName, catalog) {
  const key = normalizeWorkerKey(workerName);
  const exact = catalog?.get(key);
  if (exact) return exact;

  const catalogList = catalog?.__records || [];
  return fuzzyMatchWorker(workerName, catalogList);
}
