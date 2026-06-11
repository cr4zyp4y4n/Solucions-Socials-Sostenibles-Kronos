import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getFirmaDocumentoLabel } from '../constants/firmaDocumentos';
import { getFirmaEmpresaNombre } from '../constants/firmaEmpresas';

const CLAUSULA_ELECTRONICA =
  'La aceptación mediante el portal electrónico de la empresa (verificación por SMS al teléfono ' +
  'del trabajador, con registro de fecha, hora e identidad) tendrá efectos de acuse de recibo y ' +
  'firma a efectos de la normativa de Prevención de Riesgos Laborales y documentación laboral aplicable.';

function buildWorkerContext(employee, entityKey) {
  const emp = employee || {};
  const hoy = new Date();
  const fechaLarga = hoy.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return {
    empresa: getFirmaEmpresaNombre(entityKey),
    nombreCompleto: emp.nombreCompleto || `${emp.nombre || ''} ${emp.apellidos || ''}`.trim(),
    dni: emp.dni || emp.dniLegacy || '',
    puesto: emp.contratoPuesto || emp.puesto || '',
    telefono: emp.telefono || '',
    email: emp.email || '',
    fechaNacimiento: emp.fechaNacimiento || '',
    fechaHoy: hoy.toLocaleDateString('es-ES'),
    fechaLarga,
    localidad: emp.ciudad || emp.ciudadFiscal || 'Barcelona'
  };
}

function createDoc(title) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxW = pageWidth - margin * 2;
  return { doc, margin, pageWidth, maxW };
}

function writeTitle(doc, title, margin, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, margin, y);
  return y + 8;
}

function writeParagraphs(doc, paragraphs, margin, maxW, startY) {
  let y = startY;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const p of paragraphs) {
    const lines = doc.splitTextToSize(p, maxW);
    if (y + lines.length * 5 > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }
  return y;
}

function writeFieldBlock(doc, fields, margin, startY) {
  let y = startY;
  doc.setFontSize(10);
  for (const [label, value] of fields) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || '—'), margin + 42, y);
    y += 6;
  }
  return y + 4;
}

function addClausulaFooter(doc, margin, maxW) {
  const y = 262;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y - 4, margin + maxW, y - 4);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  const lines = doc.splitTextToSize(CLAUSULA_ELECTRONICA, maxW);
  doc.text(lines, margin, y);
}

function docToBlob(doc) {
  const buf = doc.output('arraybuffer');
  return new Blob([buf], { type: 'application/pdf' });
}

function generateRpt(ctx) {
  const { doc, margin, maxW } = createDoc('RPT');
  let y = writeTitle(doc, 'ENTREGA DE INFORMACIÓN A LOS TRABAJADORES', margin, 22);
  y = writeFieldBlock(
    doc,
    [
      ['EMPRESA', ctx.empresa],
      ['NOMBRE Y APELLIDOS', ctx.nombreCompleto],
      ['DNI', ctx.dni],
      ['PUESTO', ctx.puesto],
      ['FECHA', ctx.fechaHoy]
    ],
    margin,
    y
  );
  y = writeParagraphs(
    doc,
    [
      'En base a lo dispuesto en el artículo 18 de la Ley 31/1995 de Prevención de Riesgos Laborales ' +
        '(Información, consulta y participación de los trabajadores), la empresa hace entrega al trabajador ' +
        'identificado de la ficha informativa de riesgos específicos del puesto de trabajo derivada de la ' +
        'evaluación de riesgos (RPT).',
      'El/la trabajador/a declara haber recibido dicha información y comprometerse a conocerla y aplicarla ' +
        'en el desempeño de sus funciones.',
      'Servicio de Prevención Ajeno: PRESAL, S.L. (referencia documental PRL).'
    ],
    margin,
    maxW,
    y
  );
  addClausulaFooter(doc, margin, maxW);
  return docToBlob(doc);
}

function generateAcoso(ctx) {
  const { doc, margin, maxW } = createDoc('acoso');
  let y = writeTitle(doc, 'ENTREGA DE INFORMACIÓN – PROTOCOLO DE ACOSO', margin, 22);
  y = writeFieldBlock(
    doc,
    [
      ['EMPRESA', ctx.empresa],
      ['NOMBRE Y APELLIDOS', ctx.nombreCompleto],
      ['DNI', ctx.dni],
      ['FECHA', ctx.fechaHoy]
    ],
    margin,
    y
  );
  y = writeParagraphs(
    doc,
    [
      'En base al artículo 18 de la Ley 31/1995 de Prevención de Riesgos Laborales, se hace entrega del ' +
        'Procedimiento de actuación ante riesgos psicosociales derivados de comportamientos inadecuados (acoso).',
      'El/la trabajador/a declara haber recibido el protocolo y comprometerse a conocerlo y aplicarlo.',
      'La solicitud de inscripción en la formación «Prevención del acoso», si procede, se registrará en el ' +
        'portal de firma electrónica en el momento de la aceptación.'
    ],
    margin,
    maxW,
    y
  );
  addClausulaFooter(doc, margin, maxW);
  return docToBlob(doc);
}

function generateEpis(ctx, episRows) {
  const { doc, margin, maxW } = createDoc('epis');
  let y = writeTitle(doc, 'INFORMACIÓN Y ENTREGA DE EQUIPOS DE PROTECCIÓN INDIVIDUAL', margin, 22);
  y = writeFieldBlock(
    doc,
    [
      ['EMPRESA', ctx.empresa],
      ['TRABAJADOR/A', ctx.nombreCompleto],
      ['DNI', ctx.dni],
      ['PUESTO', ctx.puesto],
      ['FECHA', ctx.fechaHoy]
    ],
    margin,
    y
  );
  y = writeParagraphs(
    doc,
    [
      'El/la trabajador/a reconoce haber sido informado/a de los trabajos y zonas en los que deberá utilizar ' +
        'los equipos de protección individual (EPI) y haber recibido instrucciones para su correcto uso, ' +
        'comprometiéndose a utilizarlos, conservarlos y comunicar cualquier deterioro o pérdida.'
    ],
    margin,
    maxW,
    y
  );

  const rows =
    Array.isArray(episRows) && episRows.length
      ? episRows
          .filter((r) => r?.equipo?.trim())
          .map((r) => [r.equipo.trim(), r.marca?.trim() || '—', r.modelo?.trim() || '—'])
      : [['(Sin EPI específico registrado para el puesto)', '—', '—']];

  autoTable(doc, {
    startY: y + 2,
    head: [['Equipo de protección individual', 'Marca', 'Modelo']],
    body: rows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [60, 60, 60] }
  });

  addClausulaFooter(doc, margin, maxW);
  return docToBlob(doc);
}

function generateVrpConsentimiento(ctx) {
  const { doc, margin, maxW } = createDoc('vrp');
  let y = writeTitle(doc, 'CONSENTIMIENTO – RECONOCIMIENTO MÉDICO (VRP)', margin, 22);
  y = writeParagraphs(doc, [`${ctx.localidad}, ${ctx.fechaLarga}`], margin, maxW, 22);
  y = writeFieldBlock(
    doc,
    [
      ['EMPRESA', ctx.empresa],
      ['NOMBRE Y APELLIDOS', ctx.nombreCompleto],
      ['DNI', ctx.dni],
      ['FECHA NACIMIENTO', ctx.fechaNacimiento],
      ['PUESTO', ctx.puesto],
      ['TELÉFONO', ctx.telefono],
      ['EMAIL', ctx.email]
    ],
    margin,
    y
  );
  y = writeParagraphs(
    doc,
    [
      'La empresa pone a disposición del/de la trabajador/a, en cumplimiento del artículo 22 de la Ley ' +
        '31/1995 de Prevención de Riesgos Laborales, la realización de un reconocimiento médico / vigilancia ' +
        'de la salud en función de los riesgos inherentes al trabajo.',
      'PRESTO MI CONSENTIMIENTO EXPRESO para someterme a dicho reconocimiento médico.',
      'Para solicitar cita: PRESAL, S.L. — angeles.gonzalez@presal.com'
    ],
    margin,
    maxW,
    y
  );
  addClausulaFooter(doc, margin, maxW);
  return docToBlob(doc);
}

function generateVrpRenuncia(ctx) {
  const { doc, margin, maxW } = createDoc('vrp');
  let y = writeTitle(doc, 'RENUNCIA – RECONOCIMIENTO MÉDICO (VRP)', margin, 22);
  y = writeParagraphs(doc, [`${ctx.localidad}, ${ctx.fechaLarga}`], margin, maxW, 22);
  y = writeFieldBlock(
    doc,
    [
      ['EMPRESA', ctx.empresa],
      ['NOMBRE Y APELLIDOS', ctx.nombreCompleto],
      ['DNI', ctx.dni],
      ['FECHA NACIMIENTO', ctx.fechaNacimiento],
      ['PUESTO', ctx.puesto],
      ['TELÉFONO', ctx.telefono],
      ['EMAIL', ctx.email]
    ],
    margin,
    y
  );
  y = writeParagraphs(
    doc,
    [
      'He sido informado/a de que puedo someterme voluntariamente a un reconocimiento médico / vigilancia ' +
        'de la salud conforme al artículo 22 de la Ley 31/1995 de Prevención de Riesgos Laborales.',
      'DEJO CONSTANCIA EXPRESA DE MI RENUNCIA PERSONAL a la realización del reconocimiento médico, ' +
        'habiendo sido informado/a de las consecuencias de esta decisión.'
    ],
    margin,
    maxW,
    y
  );
  addClausulaFooter(doc, margin, maxW);
  return docToBlob(doc);
}

function generateGenerico(ctx, tipoDocumento) {
  const { doc, margin, maxW } = createDoc('otro');
  const titulo = getFirmaDocumentoLabel(tipoDocumento).toUpperCase();
  let y = writeTitle(doc, titulo, margin, 22);
  y = writeFieldBlock(
    doc,
    [
      ['EMPRESA', ctx.empresa],
      ['TRABAJADOR/A', ctx.nombreCompleto],
      ['DNI', ctx.dni],
      ['PUESTO', ctx.puesto],
      ['FECHA', ctx.fechaHoy]
    ],
    margin,
    y
  );
  y = writeParagraphs(
    doc,
    [
      `Documento de ${getFirmaDocumentoLabel(tipoDocumento)} generado automáticamente desde Kronos ` +
        'con los datos del trabajador en Holded.',
      'El/la trabajador/a declara haber recibido y leído el contenido asociado a este documento y acepta ' +
        'su contenido mediante el procedimiento de firma electrónica de la empresa.'
    ],
    margin,
    maxW,
    y
  );
  addClausulaFooter(doc, margin, maxW);
  return docToBlob(doc);
}

/**
 * Genera un PDF listo para el pack de firma a partir de datos Holded.
 * @returns {Promise<Blob>}
 */
export async function generateFirmaPdfBlob({ tipoDocumento, employee, entityKey, episRows = [] }) {
  const ctx = buildWorkerContext(employee, entityKey);
  const tipo = String(tipoDocumento || '').trim();

  switch (tipo) {
    case 'riesgos_laborales':
      return generateRpt(ctx);
    case 'acoso':
      return generateAcoso(ctx);
    case 'epis':
      return generateEpis(ctx, episRows);
    case 'vrp_consentimiento':
      return generateVrpConsentimiento(ctx);
    case 'vrp_renuncia':
      return generateVrpRenuncia(ctx);
    default:
      return generateGenerico(ctx, tipo);
  }
}

export function blobToPdfFile(blob, fileName) {
  return new File([blob], fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`, {
    type: 'application/pdf'
  });
}

export async function generateFirmaPdfFile({ tipoDocumento, employee, entityKey, episRows = [] }) {
  const blob = await generateFirmaPdfBlob({ tipoDocumento, employee, entityKey, episRows });
  const safeDni = String(employee?.dni || 'doc').replace(/[^\w-]/g, '');
  const base = getFirmaDocumentoLabel(tipoDocumento)
    .replace(/[^\w\s-áéíóúñ]/gi, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return blobToPdfFile(blob, `${base}-${safeDni}.pdf`);
}
