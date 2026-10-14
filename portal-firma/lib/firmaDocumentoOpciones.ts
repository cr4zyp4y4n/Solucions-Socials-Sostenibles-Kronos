import { supabaseAdmin } from '@/lib/supabase';

export type DocumentoOpcionesAceptacion = {
  lectura_confirmada?: boolean;
  respuesta?: 'si' | 'no';
  confirmado_at?: string;
  formacion_acoso?: boolean;
};

function isMissingOpcionesColumn(message: string): boolean {
  return String(message || '').includes('opciones_aceptacion');
}

function hasVerifiableRespuesta(opciones?: DocumentoOpcionesAceptacion | null): boolean {
  return (
    opciones?.respuesta === 'si' ||
    opciones?.respuesta === 'no' ||
    typeof opciones?.lectura_confirmada === 'boolean'
  );
}

function normalizeAuditOpciones(row: { created_at?: string | null; detalle?: unknown }) {
  const detalle = row.detalle && typeof row.detalle === 'object'
    ? (row.detalle as Record<string, unknown>)
    : {};
  if (detalle.accion !== 'documento_lectura_confirmada') return null;

  const respuesta = detalle.respuesta === 'si' || detalle.respuesta === 'no'
    ? detalle.respuesta
    : detalle.lectura_confirmada === true
      ? 'si'
      : detalle.lectura_confirmada === false
        ? 'no'
        : null;
  if (!respuesta) return null;

  return {
    respuesta,
    lectura_confirmada: respuesta === 'si',
    confirmado_at:
      typeof detalle.confirmado_at === 'string' ? detalle.confirmado_at : row.created_at || undefined,
    ...(detalle.formacion_acoso === true ? { formacion_acoso: true } : {})
  } satisfies DocumentoOpcionesAceptacion;
}

async function loadDocumentoOpcionesFromAuditoria(
  documentoId: string
): Promise<DocumentoOpcionesAceptacion | null> {
  const { data, error } = await supabaseAdmin
    .from('firma_auditorias')
    .select('created_at, detalle')
    .eq('documento_id', documentoId)
    .eq('resultado', 'ok')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) return null;
  for (const row of data || []) {
    const opciones = normalizeAuditOpciones(row);
    if (opciones) return opciones;
  }
  return null;
}

export async function updateDocumentoLecturaConfirmada(
  documentoId: string,
  opciones: DocumentoOpcionesAceptacion,
  nowIso: string
): Promise<{ ok: true; opcionesGuardadas: boolean } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin
    .from('firma_documentos')
    .update({
      revisado_at: nowIso,
      opciones_aceptacion: opciones
    })
    .eq('id', documentoId);

  if (!error) return { ok: true, opcionesGuardadas: true };

  if (!isMissingOpcionesColumn(error.message)) {
    return { ok: false, error: error.message };
  }

  const { error: fallbackErr } = await supabaseAdmin
    .from('firma_documentos')
    .update({ revisado_at: nowIso })
    .eq('id', documentoId);

  if (fallbackErr) return { ok: false, error: fallbackErr.message };
  return { ok: true, opcionesGuardadas: false };
}

export async function loadDocumentoOpciones(
  documentoId: string
): Promise<{ tipoDocumento?: string; opciones: DocumentoOpcionesAceptacion | null }> {
  const { data, error } = await supabaseAdmin
    .from('firma_documentos')
    .select('opciones_aceptacion, tipo_documento')
    .eq('id', documentoId)
    .maybeSingle();

  if (!error && data) {
    const opcionesFromColumn = data.opciones_aceptacion as DocumentoOpcionesAceptacion | null;
    const opciones =
      (hasVerifiableRespuesta(opcionesFromColumn) ? opcionesFromColumn : null) ||
      (await loadDocumentoOpcionesFromAuditoria(documentoId));
    return {
      tipoDocumento: data.tipo_documento,
      opciones
    };
  }

  if (error && isMissingOpcionesColumn(error.message)) {
    const { data: fallback } = await supabaseAdmin
      .from('firma_documentos')
      .select('tipo_documento')
      .eq('id', documentoId)
      .maybeSingle();
    return {
      tipoDocumento: fallback?.tipo_documento,
      opciones: await loadDocumentoOpcionesFromAuditoria(documentoId)
    };
  }

  return {
    tipoDocumento: undefined,
    opciones: await loadDocumentoOpcionesFromAuditoria(documentoId)
  };
}
