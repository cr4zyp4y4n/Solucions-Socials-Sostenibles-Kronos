const fs = require('fs');
const path = require('path');

// Leer los archivos
const archivoProductos = 'Empresa d\'Inserció Solucions Socials Sostenibles SCCL CSV - Productes.csv';
const archivoPlantilla = 'Importa Productes  CSV.csv';

console.log('Leyendo archivos...');

// Leer la plantilla para obtener el encabezado
const plantillaContent = fs.readFileSync(archivoPlantilla, 'utf-8');
const plantillaLines = plantillaContent.split('\n');
const headerPlantilla = plantillaLines[0].trim();

// Leer el archivo de productos
const productosContent = fs.readFileSync(archivoProductos, 'utf-8');
const productosLines = productosContent.split('\n');

// Encontrar la línea del encabezado (buscar la línea que contiene "Creat;Nom;Descripció;SKU")
let headerIndex = -1;
for (let i = 0; i < productosLines.length; i++) {
  if (productosLines[i].includes('Creat;Nom;Descripció;SKU') || productosLines[i].includes('Creat;Nom;Descripci')) {
    headerIndex = i;
    break;
  }
}

if (headerIndex === -1) {
  console.error('❌ No se encontró el encabezado en el archivo');
  process.exit(1);
}

console.log(`📋 Encabezado encontrado en la línea ${headerIndex + 1}`);
const headerProductos = productosLines[headerIndex].split(';');

// Función para extraer el IVA correcto (eliminar IVA 0% y quedarse con el que no sea 0%)
function extraerIVA(impostosStr) {
  if (!impostosStr || impostosStr.trim() === '' || impostosStr === '-   €') {
    return '';
  }
  
  // Limpiar el string (eliminar comas al final y espacios extra)
  const impostosLimpio = impostosStr.trim().replace(/,\s*$/, '');
  
  // Buscar todos los IVAs en el string
  // Patrón: IVA seguido de un número y %
  const ivaMatches = [...impostosLimpio.matchAll(/IVA\s*(\d+(?:[.,]\d+)?)%/gi)];
  
  let ivaCorrecto = '';
  for (const match of ivaMatches) {
    const porcentaje = parseFloat(match[1].replace(',', '.'));
    // Si el IVA no es 0%, es el correcto
    if (porcentaje > 0) {
      ivaCorrecto = Math.round(porcentaje).toString();
      break; // Tomar el primero que no sea 0%
    }
  }
  
  return ivaCorrecto;
}

// Función para limpiar valores numéricos (eliminar "€", espacios, etc.)
function limpiarNumero(valor) {
  if (!valor || valor.trim() === '') {
    return '';
  }
  
  // Si el valor es solo un guión o " -   € ", devolver vacío
  const valorLimpio = valor.trim();
  if (valorLimpio === '-' || valorLimpio === '-   €' || valorLimpio.match(/^-\s*€?\s*$/)) {
    return '';
  }
  
  // Eliminar todos los caracteres no numéricos excepto punto y coma, luego convertir coma a punto
  let numero = valor
    .replace(/[^\d,.-]/g, '') // Eliminar todo excepto dígitos, coma, punto y guión
    .replace(/\s/g, '') // Eliminar espacios
    .replace(',', '.'); // Convertir coma a punto
  
  // Si después de limpiar está vacío o solo tiene caracteres no numéricos, devolver vacío
  if (!numero || isNaN(parseFloat(numero))) {
    return '';
  }
  
  return numero;
}

// Función para limpiar texto
function limpiarTexto(valor) {
  if (!valor) return '';
  return valor.trim();
}

// Función para limpiar código de barras (puede estar en formato científico)
function limpiarCodigoBarras(codigo) {
  if (!codigo || codigo.trim() === '') {
    return '';
  }
  
  const codigoLimpio = codigo.trim();
  
  // Si está en formato científico (ej: 8,42268E+12), convertirlo
  if (codigoLimpio.includes('E+') || codigoLimpio.includes('e+')) {
    try {
      // Reemplazar coma por punto para parseFloat
      const numero = parseFloat(codigoLimpio.replace(',', '.'));
      // Convertir a entero y luego a string para quitar decimales
      return Math.floor(numero).toString();
    } catch (e) {
      return codigoLimpio;
    }
  }
  
  return codigoLimpio;
}

// Procesar productos (empezar desde la línea siguiente al encabezado)
const productosTransformados = [];
let productosProcesados = 0;
let productosConError = 0;

for (let i = headerIndex + 1; i < productosLines.length; i++) {
  const linea = productosLines[i].trim();
  if (!linea) continue;
  
  const campos = linea.split(';');
  
  // Mapear campos según el orden del header
  // Creat;Nom;Descripció;SKU;Codi;Variant;Tags;Magatzem;Canal;Compte;Existències;Cost;Preu de compra;Valor del cost;Valor de vendes;Subtotal;IVA;Retenció;Rec. de eq.;Impostos;Total
  const nom = limpiarTexto(campos[1]);
  const descripcio = limpiarTexto(campos[2]);
  const sku = limpiarTexto(campos[3]);
  const codi = limpiarCodigoBarras(campos[4]);
  const tags = limpiarTexto(campos[6]);
  const magatzem = limpiarTexto(campos[7]);
  const existencies = limpiarTexto(campos[10]);
  const cost = limpiarNumero(campos[11]);
  const preuCompra = limpiarNumero(campos[12]);
  const preuVenda = limpiarNumero(campos[15]); // Subtotal es el precio de venta
  const impostos = limpiarTexto(campos[19]);
  const dataCreat = limpiarTexto(campos[0]);
  
  // Extraer IVA correcto
  const iva = extraerIVA(impostos);
  
  // Si no hay SKU o Nom, saltar
  if (!sku && !nom) continue;
  
  // Convertir fecha de dd/mm/yyyy a dd/mm/yyyy (ya está en formato correcto)
  let dataInici = '';
  if (dataCreat) {
    // La fecha ya está en formato dd/mm/yyyy
    dataInici = dataCreat;
  }
  
  // Convertir tags (si hay) separados por punto y coma a separados por guión
  let etiquetes = '';
  if (tags) {
    etiquetes = tags.replace(/;/g, '-').replace(/,/g, '-');
  }
  
  // Crear la línea según el formato de la plantilla
  // SKU;Nom;Descripció;Codi de barres;Codi de fàbrica;Cost (Subtotal);Preu de compra (Subtotal);Preu de venda (Subtotal);Impost sobre la venda;Impost de compres;Existències;Pes;Data d'inici dd/mm/yyyy;Etiquetes separades per -;Proveïdor (Codi);Compte de vendes;Compte de compres;Magatzem
  const nuevaLinea = [
    sku || '',
    nom || '',
    descripcio || '',
    codi || '',
    '', // Codi de fàbrica
    cost || '',
    preuCompra || '',
    preuVenda || '',
    iva || '',
    '0', // Impost de compres (por defecto 0)
    existencies || '0',
    '', // Pes
    dataInici || '',
    etiquetes || '',
    '', // Proveïdor (Codi)
    '', // Compte de vendes
    '', // Compte de compres
    magatzem || ''
  ].join(';');
  
  productosTransformados.push(nuevaLinea);
  productosProcesados++;
  
  if (!iva && impostos) {
    productosConError++;
    console.log(`Advertencia: Producto ${sku || nom} tiene IVA no reconocido: ${impostos}`);
  }
}

// Crear el contenido final
const contenidoFinal = headerPlantilla + '\n' + productosTransformados.join('\n');

// Guardar el archivo con timestamp para no sobrescribir el anterior
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const archivoSalida = `Productes_Holded_Corregit_${timestamp}.csv`;
fs.writeFileSync(archivoSalida, contenidoFinal, 'utf-8');

console.log(`\n✅ Transformación completada!`);
console.log(`📊 Productos procesados: ${productosProcesados}`);
console.log(`⚠️  Productos con IVA no reconocido: ${productosConError}`);
console.log(`💾 Archivo guardado: ${archivoSalida}`);

