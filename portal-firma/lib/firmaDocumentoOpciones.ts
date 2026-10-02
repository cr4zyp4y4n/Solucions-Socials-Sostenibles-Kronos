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
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'si' || value === 'sí' || value === 'yes' || value === 'true') return 'si';
  if (value === 'no' || value === 'false') return 'no';
  return null;
}

function opcionesFromAuditDetalle(detalle: unknown): DocumentoOpcionesAceptacion | null {
  if (!detalle || typeof detalle !== 'object') return null;

  const d = detalle as {
    accion?: unknown;
    respuesta?: unknown;
    lectura_confirmada?: unknown;
    confirmado_at?: unknown;
    formacion_acoso?: unknown;
    opciones?: {
      respuesta?: unknown;
      lectura_confirmada?: unknown;
      confirmado_at?: unknown;
      formacion_acoso?: unknown;
    };
  };
  if (d.accion !== 'documento_lectura_confirmada') return null;

  const respuesta = normalizeRespuesta(d.respuesta ?? d.opciones?.respuesta);
  if (!respuesta) return null;

  return {
    respuesta,
    lectura_confirmada: respuesta === 'si',
    confirmado_at:
      typeof d.confirmado_at === 'string'
        ? d.confirmado_at
        : typeof d.opciones?.confirmado_at === 'string'
          ? d.opciones.confirmado_at
          : undefined,
    ...(respuesta === 'si' && (d.formacion_acoso || d.opciones?.formacion_acoso)
      ? { formacion_acoso: true }
      : {})
  };
}

async function loadOpcionesFromAuditoria(
  documentoId: string
): Promise<DocumentoOpcionesAceptacion | null> {
  const { data, error } = await supabaseAdmin
    .from('firma_auditorias')
    .select('detalle, created_at')
    .eq('documento_id', documentoId)
    .eq('resultado', 'ok')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return null;

  for (const row of data || []) {
    const opciones = opcionesFromAuditDetalle((row as { detalle?: unknown }).detalle);
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
      opciones: opciones || (await loadOpcionesFromAuditoria(documentoId))
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

  return { tipoDocumento: undefined, opciones: await loadOpcionesFromAuditoria(documentoId) };
}
