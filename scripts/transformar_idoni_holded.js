const fs = require('fs');

// Leer los archivos
const archivoIdoni = 'ListadoArticulos.xls.csv';
const archivoPlantilla = 'Importa Productes  CSV.csv';

console.log('Leyendo archivos...');

// Leer la plantilla para obtener el encabezado
const plantillaContent = fs.readFileSync(archivoPlantilla, 'utf-8');
const plantillaLines = plantillaContent.split('\n');
const headerPlantilla = plantillaLines[0].trim();

// Leer el archivo de IDONI
const idoniContent = fs.readFileSync(archivoIdoni, 'utf-8');
const idoniLines = idoniContent.split('\n');

// Función para limpiar valores numéricos
function limpiarNumero(valor) {
  if (!valor || valor.trim() === '' || valor === '-' || valor === '0,00' || valor === '0.00') {
    return '';
  }
  
  // Eliminar espacios y convertir coma a punto
  let numero = valor.toString().trim().replace(/\s/g, '').replace(',', '.');
  
  // Si después de limpiar está vacío o no es un número válido, devolver vacío
  const numParsed = parseFloat(numero);
  if (isNaN(numParsed) || numParsed === 0) {
    return '';
  }
  
  return numero;
}

// Función para extraer IVA (solo el número, sin comas, espacios ni texto)
function extraerIVA(ivaStr) {
  if (!ivaStr || ivaStr.trim() === '') {
    return '';
  }
  
  // Limpiar el string: eliminar espacios al inicio y final
  let ivaLimpio = ivaStr.toString().trim();
  
  // El formato puede ser "10,0 " o "21,0 " o "10" o "21"
  // Buscar un número (puede tener coma o punto decimal)
  const match = ivaLimpio.match(/(\d+(?:[.,]\d+)?)/);
  
  if (match) {
    // Convertir a número y redondear (el IVA siempre es entero: 10, 21, 4, etc.)
    const porcentaje = parseFloat(match[1].replace(',', '.'));
    if (porcentaje > 0) {
      // Devolver SOLO el número como string, sin comas, espacios ni texto
      // Esto evita que Holded lo interprete como "IVA 21%, IVA 0%"
      return Math.round(porcentaje).toString();
    }
  }
  
  return '';
}

// Función para limpiar texto
function limpiarTexto(valor) {
  if (!valor) return '';
  return valor.trim();
}

// Procesar productos (empezar desde la línea 2, índice 1, ya que la línea 0 es el encabezado)
const productosTransformados = [];
let productosProcesados = 0;
let productosConError = 0;

for (let i = 1; i < idoniLines.length; i++) {
  const linea = idoniLines[i].trim();
  if (!linea) continue;
  
  const campos = linea.split(';');
  
  // Mapear campos según el orden del header de IDONI
  // Codi;PLU Det.;PLU Maj.;Descripció;Desc. Bal.;Compost;Categoria;C.Prov.;Proveïdor;C.Fam.;Nom Família;Grup;IVA;Rec.;Preu Cost;Ult.Pr.Cost;...
  const codi = limpiarTexto(campos[0]); // SKU
  const descripcio = limpiarTexto(campos[3]); // Descripció (nombre principal)
  const descBal = limpiarTexto(campos[4]); // Desc. Bal. (descripción alternativa)
  const iva = extraerIVA(campos[12]); // IVA (columna 12, índice 12)
  const preuCost = limpiarNumero(campos[14]); // Preu Cost (columna 14, índice 14)
  const preuCompra = limpiarNumero(campos[15]); // Ult.Pr.Cost (columna 15, índice 15)
  const preuVenda = limpiarNumero(campos[22]); // PVP Det. (columna 22, índice 22)
  const ean1 = limpiarTexto(campos[40]); // EAN 1 (código de barras, columna 40, índice 40)
  const pes = limpiarNumero(campos[25]); // Pes Venda (columna 25)
  
  // Si no hay código (SKU), saltar
  if (!codi) continue;
  
  // Usar Desc. Bal. como descripción si existe, sino usar Descripció
  const descripcioFinal = descBal || descripcio || '';
  
  // Crear la línea según el formato de la plantilla
  // SKU;Nom;Descripció;Codi de barres;Codi de fàbrica;Cost (Subtotal);Preu de compra (Subtotal);Preu de venda (Subtotal);Impost sobre la venda;Impost de compres;Existències;Pes;Data d'inici dd/mm/yyyy;Etiquetes separades per -;Proveïdor (Codi);Compte de vendes;Compte de compres;Magatzem
  const nuevaLinea = [
    codi, // SKU
    descripcio || '', // Nom
    descripcioFinal, // Descripció
    ean1 || '', // Codi de barres
    '', // Codi de fàbrica
    preuCost || '', // Cost (Subtotal) - Preu Cost del Excel
    preuCompra || '', // Preu de compra (Subtotal) - Ult.Pr.Cost del Excel
    preuVenda || '', // Preu de venda (Subtotal) - PVP Det. del Excel
    iva || '', // Impost sobre la venda (SOLO EL NÚMERO, sin comas ni espacios)
    '0', // Impost de compres (por defecto 0)
    '0', // Existències (no disponible en IDONI)
    pes || '', // Pes
    '', // Data d'inici dd/mm/yyyy
    '', // Etiquetes separades per -
    '', // Proveïdor (Codi)
    '', // Compte de vendes
    '', // Compte de compres
    '' // Magatzem
  ].join(';');
  
  productosTransformados.push(nuevaLinea);
  productosProcesados++;
  
  if (!iva && campos[12] && campos[12].trim() !== '' && campos[12].trim() !== '0') {
    productosConError++;
    console.log(`Advertencia: Producto ${codi} tiene IVA no reconocido: ${campos[12]}`);
  }
}

// Crear el contenido final
const contenidoFinal = headerPlantilla + '\n' + productosTransformados.join('\n');

// Guardar el archivo
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const archivoSalida = `Productes_IDONI_Holded_${timestamp}.csv`;
fs.writeFileSync(archivoSalida, contenidoFinal, 'utf-8');

console.log(`\n✅ Transformación completada!`);
console.log(`📊 Productos procesados: ${productosProcesados}`);
console.log(`⚠️  Productos con IVA no reconocido: ${productosConError}`);
console.log(`💾 Archivo guardado: ${archivoSalida}`);
console.log(`\n⚠️  IMPORTANTE: El IVA se ha escrito SOLO como número (ej: 10, 21) sin comas, espacios ni texto para evitar duplicados en Holded.`);
