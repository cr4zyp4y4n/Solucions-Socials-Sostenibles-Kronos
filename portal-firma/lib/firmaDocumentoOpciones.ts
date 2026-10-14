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

function normalizeRespuesta(raw: unknown): 'si' | 'no' | null {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'si' || v === 'sí' || v === 'yes' || v === 'true') return 'si';
  if (v === 'no' || v === 'false') return 'no';
  return null;
}

async function loadOpcionesFromAudit(documentoId: string): Promise<DocumentoOpcionesAceptacion | null> {
  const { data, error } = await supabaseAdmin
    .from('firma_auditorias')
    .select('detalle, created_at')
    .eq('documento_id', documentoId)
    .eq('resultado', 'ok')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return null;

  for (const row of data || []) {
    const detalle = row.detalle as {
      accion?: string;
      respuesta?: unknown;
      lectura_confirmada?: unknown;
      confirmado_at?: string;
      formacion_acoso?: unknown;
    } | null;

    if (detalle?.accion !== 'documento_lectura_confirmada') continue;

    const respuesta =
      normalizeRespuesta(detalle.respuesta) ??
      (detalle.lectura_confirmada === true
        ? 'si'
        : detalle.lectura_confirmada === false
          ? 'no'
          : null);

    if (!respuesta) continue;

    return {
      respuesta,
      lectura_confirmada: respuesta === 'si',
      confirmado_at: detalle.confirmado_at || row.created_at,
      ...(respuesta === 'si' && detalle.formacion_acoso ? { formacion_acoso: true } : {})
    };
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
    return {
      tipoDocumento: data.tipo_documento,
      opciones:
        ((data.opciones_aceptacion || null) as DocumentoOpcionesAceptacion | null) ||
        (await loadOpcionesFromAudit(documentoId))
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
