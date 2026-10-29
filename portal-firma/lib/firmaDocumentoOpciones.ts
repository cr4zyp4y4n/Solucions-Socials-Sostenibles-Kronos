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

function opcionesFromAuditoriaDetalle(detalle: unknown): DocumentoOpcionesAceptacion | null {
  if (!detalle || typeof detalle !== 'object') return null;
  const value = detalle as Record<string, unknown>;
  let respuesta: 'si' | 'no' | null = null;
  if (value.respuesta === 'si' || value.respuesta === 'no') {
    respuesta = value.respuesta;
  } else if (typeof value.lectura_confirmada === 'boolean') {
    respuesta = value.lectura_confirmada ? 'si' : 'no';
  }
  if (!respuesta) return null;

  return {
    respuesta,
    lectura_confirmada:
      typeof value.lectura_confirmada === 'boolean' ? value.lectura_confirmada : respuesta === 'si',
    confirmado_at: typeof value.confirmado_at === 'string' ? value.confirmado_at : undefined,
    formacion_acoso: typeof value.formacion_acoso === 'boolean' ? value.formacion_acoso : undefined
  };
}

async function loadOpcionesFromAuditoria(documentoId: string): Promise<DocumentoOpcionesAceptacion | null> {
  const { data, error } = await supabaseAdmin
    .from('firma_auditorias')
    .select('detalle, created_at')
    .eq('documento_id', documentoId)
    .eq('resultado', 'ok')
    .eq('detalle->>accion', 'documento_lectura_confirmada')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return null;
  return opcionesFromAuditoriaDetalle(data?.[0]?.detalle);
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
        (await loadOpcionesFromAuditoria(documentoId))
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
      opciones: await loadOpcionesFromAuditoria(documentoId)
    };
  }

  return { tipoDocumento: undefined, opciones: null };
}
