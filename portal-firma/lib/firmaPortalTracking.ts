import { resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { supabaseAdmin } from '@/lib/supabase';
import {
  classifyPortalCliente,
  describeClienteTipo,
  type PortalRequestMeta
} from '@/lib/portalRequestMeta';

const LOG_PREFIX = '[firma-portal-visita]';

export type MarcarPortalAbiertoResult =
  | {
      ok: true;
      skipped: boolean;
      marcoPrimeraVisita: boolean;
      skipReason?: string;
      clienteTipo?: string;
    }
  | { ok: false; error: string };

export type RegistrarVisitaPortalOptions = PortalRequestMeta & {
  /** Si true, actualiza portal_abierto_at (solo visita confirmada por el navegador). */
  marcaPrimeraVisita?: boolean;
};

async function insertVisitaAuditoria(
  documentoId: string | undefined,
  meta: PortalRequestMeta,
  detalle: Record<string, unknown>
) {
  try {
    await supabaseAdmin.from('firma_auditorias').insert({
      documento_id: documentoId || null,
      ip: meta.ip || null,
      user_agent: meta.userAgent || null,
      resultado: 'info',
      detalle
    });
  } catch (e) {
    console.warn(LOG_PREFIX, 'auditoría insert falló:', e);
  }
}

/**
 * Registra cada petición al portal (auditoría + consola).
 * portal_abierto_at solo se actualiza si marcaPrimeraVisita=true (POST del navegador).
 */
export async function registrarVisitaPortal(
  token: string,
  options: RegistrarVisitaPortalOptions
): Promise<MarcarPortalAbiertoResult> {
  const trimmed = String(token || '').trim();
  if (!trimmed) return { ok: false, error: 'Falta token' };

  const marcaPrimeraVisita = options.marcaPrimeraVisita === true;
  const clienteTipo = classifyPortalCliente(options);
  const clienteLabel = describeClienteTipo(clienteTipo);

  let resolved;
  try {
    resolved = await resolveFirmaToken(trimmed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(LOG_PREFIX, { source: options.source, error: msg, clienteTipo });
    return { ok: false, error: msg };
  }

  if (!resolved) return { ok: false, error: 'Token no válido' };

  const docId = resolved.documentoPrincipal?.id;
  const envioId = resolved.envio?.id || null;

  let skipReason: string | null = null;
  if (resolved.isExpired) skipReason = 'token_caducado';
  else if (resolved.isRevoked) skipReason = 'token_revocado';
  else if (resolved.envio?.estado === 'cancelado' || resolved.documentoPrincipal?.estado === 'cancelado') {
    skipReason = 'cancelado';
  } else if (resolved.envio?.estado === 'firmado' || resolved.documentoPrincipal?.estado === 'firmado') {
    skipReason = 'ya_firmado';
  } else if (!marcaPrimeraVisita) {
    skipReason = 'solo_log_ssr';
  }

  const logPayload = {
    source: options.source,
    clienteTipo,
    clienteLabel,
    ip: options.ip || '(vacía)',
    referer: options.referer || '(vacío)',
    secFetchSite: options.secFetchSite || '—',
    secFetchMode: options.secFetchMode || '—',
    secFetchDest: options.secFetchDest || '—',
    host: options.host || '—',
    ua: (options.userAgent || '').slice(0, 120),
    envioId,
    skipReason,
    marcaPrimeraVisita
  };
  console.log(LOG_PREFIX, logPayload);

  let marcoPrimeraVisita = false;
  const nowIso = new Date().toISOString();

  if (!skipReason && marcaPrimeraVisita) {
    if (resolved.envio?.id) {
      const { data, error: upErr } = await supabaseAdmin
        .from('firma_envios')
        .update({ portal_abierto_at: nowIso, updated_at: nowIso })
        .eq('id', resolved.envio.id)
        .is('portal_abierto_at', null)
        .select('id');
      if (upErr) return { ok: false, error: upErr.message };
      marcoPrimeraVisita = Array.isArray(data) && data.length > 0;
      if (!marcoPrimeraVisita) skipReason = 'ya_registrada';
    } else if (docId) {
      const { data, error: upErr } = await supabaseAdmin
        .from('firma_documentos')
        .update({ portal_abierto_at: nowIso })
        .eq('id', docId)
        .is('portal_abierto_at', null)
        .select('id');
      if (upErr) return { ok: false, error: upErr.message };
      marcoPrimeraVisita = Array.isArray(data) && data.length > 0;
      if (!marcoPrimeraVisita) skipReason = 'ya_registrada';
    } else {
      return { ok: false, error: 'Documento no encontrado' };
    }
  }

  const accion = marcoPrimeraVisita ? 'portal_primera_visita' : 'portal_visita_detectada';

  await insertVisitaAuditoria(docId, options, {
    accion,
    envio_id: envioId,
    source: options.source,
    cliente_tipo: clienteTipo,
    cliente_label: clienteLabel,
    marca_primera_visita: marcaPrimeraVisita,
    marco_portal_abierto_at: marcoPrimeraVisita,
    skip_reason: skipReason,
    referer: options.referer || null,
    accept: options.accept || null,
    sec_fetch_site: options.secFetchSite || null,
    sec_fetch_mode: options.secFetchMode || null,
    sec_fetch_dest: options.secFetchDest || null,
    host: options.host || null
  });

  return {
    ok: true,
    skipped: Boolean(skipReason),
    marcoPrimeraVisita,
    skipReason: skipReason || undefined,
    clienteTipo
  };
}

/** @deprecated Usa registrarVisitaPortal */
export async function marcarPortalAbiertoSiCorresponde(
  token: string,
  options?: Partial<RegistrarVisitaPortalOptions>
): Promise<MarcarPortalAbiertoResult> {
  return registrarVisitaPortal(token, {
    source: options?.source || 'client_post_open',
    ip: options?.ip || '',
    userAgent: options?.userAgent || '',
    referer: options?.referer || '',
    accept: options?.accept || '',
    secFetchSite: options?.secFetchSite || '',
    secFetchMode: options?.secFetchMode || '',
    secFetchDest: options?.secFetchDest || '',
    host: options?.host || '',
    marcaPrimeraVisita: options?.marcaPrimeraVisita !== false
  });
}
