import { supabaseAdmin } from '@/lib/supabase';
import { asSingle } from '@/lib/relation';
import { isMissingOpcionesColumn } from '@/lib/firmaDocumentoOpciones';

export type FirmaDocumentoResolved = {
  id: string;
  tipo_documento: string;
  estado: string;
  storage_path: string | null;
  storage_path_firmado: string | null;
  file_name: string | null;
  hash_pdf: string | null;
  orden: number;
  revisado_at: string | null;
  firmado_at: string | null;
  opciones_aceptacion?: { respuesta?: 'si' | 'no'; lectura_confirmada?: boolean; formacion_acoso?: boolean } | null;
};

export type FirmaTrabajadorResolved = {
  id: string;
  nombre: string;
  dni: string | null;
  telefono: string;
};

export type FirmaTokenResolved = {
  id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  envio_id: string | null;
  documento_id: string | null;
};

type FirmaTokenQueryRow = FirmaTokenResolved & {
  envio?: unknown;
  documento?: unknown;
};

type FirmaTrabajadorQueryRow = FirmaTrabajadorResolved;

type FirmaDocumentoQueryRow = {
  id: string;
  tipo_documento: string;
  estado: string;
  storage_path?: string | null;
  storage_path_firmado?: string | null;
  file_name?: string | null;
  hash_pdf?: string | null;
  orden?: number | null;
  revisado_at?: string | null;
  firmado_at?: string | null;
  opciones_aceptacion?: FirmaDocumentoResolved['opciones_aceptacion'];
  trabajador?: unknown;
};

type FirmaEnvioQueryRow = FirmaEnvioResolved & {
  trabajador?: unknown;
  documentos?: unknown;
};

export type FirmaEnvioResolved = {
  id: string;
  nombre: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  firmado_at: string | null;
};

export type ResolvedFirmaContext = {
  tokenRow: FirmaTokenResolved;
  isExpired: boolean;
  isRevoked: boolean;
  isUsed: boolean;
  isPack: boolean;
  envio: FirmaEnvioResolved | null;
  documentos: FirmaDocumentoResolved[];
  trabajador: FirmaTrabajadorResolved | null;
  /** Documento ancla del token (legacy o primer doc del pack). */
  documentoPrincipal: FirmaDocumentoResolved | null;
};

export async function resolveFirmaToken(token: string): Promise<ResolvedFirmaContext | null> {
  const trimmed = String(token || '').trim();
  if (!trimmed) return null;

  const buildTokenSelect = (includeOpciones: boolean) => `
      id,
      token,
      expires_at,
      used_at,
      revoked_at,
      envio_id,
      documento_id,
      envio:firma_envios (
        id,
        nombre,
        estado,
        fecha_inicio,
        fecha_fin,
        firmado_at,
        trabajador:firma_trabajadores (
          id,
          nombre,
          dni,
          telefono
        ),
        documentos:firma_documentos (
          id,
          tipo_documento,
          estado,
          storage_path,
          storage_path_firmado,
          file_name,
          hash_pdf,
          orden,
          revisado_at,
          firmado_at${includeOpciones ? ',\n          opciones_aceptacion' : ''}
        )
      ),
      documento:firma_documentos!firma_tokens_documento_id_fkey (
        id,
        tipo_documento,
        estado,
        storage_path,
        storage_path_firmado,
        file_name,
        hash_pdf,
        orden,
        revisado_at,
        firmado_at${includeOpciones ? ',\n        opciones_aceptacion' : ''},
        trabajador:firma_trabajadores (
          id,
          nombre,
          dni,
          telefono
        )
      )
    `;

  const runTokenQuery = (includeOpciones: boolean) =>
    supabaseAdmin
      .from('firma_tokens')
      .select(buildTokenSelect(includeOpciones))
    .eq('token', trimmed)
    .maybeSingle();

  let includeOpciones = true;
  let { data: tokenRow, error } = await runTokenQuery(includeOpciones);
  if (error && isMissingOpcionesColumn(error.message)) {
    includeOpciones = false;
    ({ data: tokenRow, error } = await runTokenQuery(includeOpciones));
  }
  if (error) throw new Error(error.message);
  if (!tokenRow) return null;
  const tokenData = tokenRow as unknown as FirmaTokenQueryRow;

  const expiresAt = new Date(tokenData.expires_at);
  const isExpired = Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now();
  const isRevoked = !!tokenData.revoked_at;
  const isUsed = !!tokenData.used_at;

  const envioRaw = asSingle(tokenData.envio as FirmaEnvioQueryRow | FirmaEnvioQueryRow[] | null | undefined);
  const docAnchor = asSingle(tokenData.documento as FirmaDocumentoQueryRow | FirmaDocumentoQueryRow[] | null | undefined);

  let documentos: FirmaDocumentoResolved[] = [];
  let trabajador: FirmaTrabajadorResolved | null = null;
  let envio: FirmaEnvioResolved | null = null;

  const mapDocRow = (d: FirmaDocumentoQueryRow): FirmaDocumentoResolved => ({
    id: d.id,
    tipo_documento: d.tipo_documento,
    estado: d.estado,
    storage_path: d.storage_path ?? null,
    storage_path_firmado: d.storage_path_firmado ?? null,
    file_name: d.file_name ?? null,
    hash_pdf: d.hash_pdf ?? null,
    orden: d.orden ?? 0,
    revisado_at: d.revisado_at ?? null,
    firmado_at: d.firmado_at ?? null,
    opciones_aceptacion: d.opciones_aceptacion ?? null
  });
  const documentoSelect = includeOpciones
    ? 'id, tipo_documento, estado, storage_path, storage_path_firmado, file_name, hash_pdf, orden, revisado_at, firmado_at, opciones_aceptacion'
    : 'id, tipo_documento, estado, storage_path, storage_path_firmado, file_name, hash_pdf, orden, revisado_at, firmado_at';

  if (envioRaw?.id) {
    envio = {
      id: envioRaw.id,
      nombre: envioRaw.nombre ?? null,
      estado: envioRaw.estado,
      fecha_inicio: envioRaw.fecha_inicio ?? null,
      fecha_fin: envioRaw.fecha_fin ?? null,
      firmado_at: envioRaw.firmado_at ?? null
    };
    const { data: docsByEnvio, error: docsErr } = await supabaseAdmin
      .from('firma_documentos')
      .select(documentoSelect)
      .eq('envio_id', envioRaw.id)
      .order('orden', { ascending: true });
    if (!docsErr && docsByEnvio?.length) {
      documentos = (docsByEnvio as unknown as FirmaDocumentoQueryRow[]).map(mapDocRow);
    }

    const t = asSingle(envioRaw.trabajador as FirmaTrabajadorQueryRow | FirmaTrabajadorQueryRow[] | null | undefined);
    if (t?.id && t.telefono) {
      trabajador = { id: t.id, nombre: t.nombre, dni: t.dni ?? null, telefono: t.telefono };
    }
  } else if (tokenData.envio_id) {
    const { data: envioRow, error: envioErr } = await supabaseAdmin
      .from('firma_envios')
      .select(
        `
        id,
        nombre,
        estado,
        fecha_inicio,
        fecha_fin,
        firmado_at,
        trabajador:firma_trabajadores ( id, nombre, dni, telefono )
      `
      )
      .eq('id', tokenData.envio_id)
      .maybeSingle();
    const envioData = envioRow as unknown as FirmaEnvioQueryRow | null;
    if (!envioErr && envioData?.id) {
      envio = {
        id: envioData.id,
        nombre: envioData.nombre ?? null,
        estado: envioData.estado,
        fecha_inicio: envioData.fecha_inicio ?? null,
        fecha_fin: envioData.fecha_fin ?? null,
        firmado_at: envioData.firmado_at ?? null
      };
      const { data: docsByEnvio, error: docsErr } = await supabaseAdmin
        .from('firma_documentos')
        .select(documentoSelect)
        .eq('envio_id', envioData.id)
        .order('orden', { ascending: true });
      if (!docsErr && docsByEnvio?.length) {
        documentos = (docsByEnvio as unknown as FirmaDocumentoQueryRow[]).map(mapDocRow);
      }
      const t = asSingle(envioData.trabajador as FirmaTrabajadorQueryRow | FirmaTrabajadorQueryRow[] | null | undefined);
      if (t?.id && t.telefono) {
        trabajador = { id: t.id, nombre: t.nombre, dni: t.dni ?? null, telefono: t.telefono };
      }
    }
  }

  if (!documentos.length && docAnchor?.id) {
    documentos = [mapDocRow(docAnchor)];
    const t = asSingle(docAnchor.trabajador as FirmaTrabajadorQueryRow | FirmaTrabajadorQueryRow[] | null | undefined);
    if (t?.id && t.telefono) {
      trabajador = { id: t.id, nombre: t.nombre, dni: t.dni ?? null, telefono: t.telefono };
    }
  }

  const documentoPrincipal = documentos[0] || null;
  const envioId = tokenData.envio_id ?? envio?.id ?? null;

  return {
    tokenRow: {
      id: tokenData.id,
      token: tokenData.token,
      expires_at: tokenData.expires_at,
      used_at: tokenData.used_at,
      revoked_at: tokenData.revoked_at,
      envio_id: envioId,
      documento_id: tokenData.documento_id ?? null
    },
    isExpired,
    isRevoked,
    isUsed,
    isPack: documentos.length > 1 || !!envioId,
    envio,
    documentos,
    trabajador,
    documentoPrincipal
  };
}

export function getOtpScopeIds(ctx: ResolvedFirmaContext) {
  return {
    documentoId: ctx.documentoPrincipal?.id || ctx.tokenRow.documento_id,
    envioId: ctx.tokenRow.envio_id || ctx.envio?.id || null
  };
}
