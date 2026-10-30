import { supabaseAdmin } from '@/lib/supabase';
import { normalizeRespuestaAceptacion } from '@/lib/firmaDocumentosMeta';

export type DocumentoOpcionesAceptacion = {
  lectura_confirmada?: boolean;
  respuesta?: 'si' | 'no';
  confirmado_at?: string;
  formacion_acoso?: boolean;
};

function isMissingOpcionesColumn(message: string): boolean {
  return String(message || '').includes('opciones_aceptacion');
}

function opcionesFromAuditDetalle(raw: unknown): DocumentoOpcionesAceptacion | null {
  if (!raw || typeof raw !== 'object') return null;
  const detalle = raw as Record<string, unknown>;
  if (detalle.accion !== 'documento_lectura_confirmada') return null;

  const respuesta = normalizeRespuestaAceptacion(detalle as DocumentoOpcionesAceptacion);
  if (!respuesta) return null;

  return {
    respuesta,
    lectura_confirmada: respuesta === 'si',
    confirmado_at:
      typeof detalle.confirmado_at === 'string'
        ? detalle.confirmado_at
        : undefined,
    formacion_acoso: detalle.formacion_acoso === true
  };
}

async function loadOpcionesFromAudit(
  documentoId: string
): Promise<DocumentoOpcionesAceptacion | null> {
  const { data } = await supabaseAdmin
    .from('firma_auditorias')
    .select('detalle')
    .eq('documento_id', documentoId)
    .order('created_at', { ascending: false })
    .limit(20);

  for (const row of data || []) {
    const opciones = opcionesFromAuditDetalle(
      (row as { detalle?: unknown }).detalle
    );
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
    const opciones = (data.opciones_aceptacion || null) as DocumentoOpcionesAceptacion | null;
    return {
      tipoDocumento: data.tipo_documento,
      opciones: normalizeRespuestaAceptacion(opciones)
        ? opciones
        : await loadOpcionesFromAudit(documentoId)
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
      opciones: await loadOpcionesFromAudit(documentoId)
    };
  }

  return { tipoDocumento: undefined, opciones: null };
}
