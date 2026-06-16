/* global __FIRMA_SMS_API_BASE__, __FIRMA_SMS_API_SECRET__ */
import { supabase } from '../config/supabase';

const TABLE_TRABAJADORES = 'firma_trabajadores';
const TABLE_ENVIOS = 'firma_envios';
const TABLE_DOCUMENTOS = 'firma_documentos';
const TABLE_TOKENS = 'firma_tokens';
const TABLE_AUDITORIAS = 'firma_auditorias';
const TABLE_OTP_CHALLENGES = 'firma_otp_challenges';
const BUCKET = 'firma-documentos';

/** Cache por sesión: lectura IPC del proceso principal (.env en main). */
let firmaMainConfigCache = undefined;

function parseBool(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function normalizeLinkUrlMode(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'base' || v === 'none' || v === 'full' ? v : 'full';
}

function getOriginFromPortalBaseUrl(portalBaseUrl) {
  try {
    const u = new URL(String(portalBaseUrl || '').trim());
    return u.origin;
  } catch (_) {
    return '';
  }
}

async function getFirmaMainConfig() {
  if (firmaMainConfigCache !== undefined) return firmaMainConfigCache;
  if (typeof window === 'undefined' || !window.electronAPI?.getFirmaSmsConfig) {
    firmaMainConfigCache = null;
    return null;
  }
  try {
    const cfg = await window.electronAPI.getFirmaSmsConfig();
    if (!cfg || typeof cfg !== 'object') {
      firmaMainConfigCache = null;
      return null;
    }
    firmaMainConfigCache = {
      apiBase: String(cfg.apiBase || '').trim(),
      apiSecret: String(cfg.apiSecret || '').trim(),
      portalBaseUrl: String(cfg.portalBaseUrl || '').trim(),
      linkTextOnly: parseBool(cfg.linkTextOnly),
      linkUrlMode: normalizeLinkUrlMode(cfg.linkUrlMode)
    };
    return firmaMainConfigCache;
  } catch (_) {
    firmaMainConfigCache = null;
    return null;
  }
}

function getPortalBaseForLinks() {
  const fromMain = firmaMainConfigCache?.portalBaseUrl;
  if (fromMain) return fromMain.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const fromLs = String(localStorage.getItem('FIRMA_PORTAL_BASE_URL') || '').trim();
    if (fromLs) return fromLs.replace(/\/$/, '');
  }
  return '';
}

function buildPortalLink(token) {
  const base = getPortalBaseForLinks();
  const t = String(token || '').trim();
  if (!base || !t) return '';
  return `${base}/${t}`;
}

function getSmsApiBase() {
  // DefinePlugin (si aplica) inyecta __FIRMA_SMS_API_BASE__ como literal en build.
  const fromBundle =
    typeof __FIRMA_SMS_API_BASE__ !== 'undefined'
      ? String(__FIRMA_SMS_API_BASE__ || '').trim()
      : '';
  if (fromBundle) return fromBundle.replace(/\/$/, '');

  const fromEnv =
    typeof process !== 'undefined' && process.env && process.env.FIRMA_SMS_API_BASE
      ? String(process.env.FIRMA_SMS_API_BASE).trim()
      : '';
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const fromLs = String(localStorage.getItem('FIRMA_SMS_API_BASE') || '').trim();
    if (fromLs) return fromLs.replace(/\/$/, '');
  }
  return '';
}

function getSmsApiSecret() {
  const fromBundle =
    typeof __FIRMA_SMS_API_SECRET__ !== 'undefined'
      ? String(__FIRMA_SMS_API_SECRET__ || '').trim()
      : '';
  if (fromBundle) return fromBundle;

  const fromEnv =
    typeof process !== 'undefined' && process.env && process.env.FIRMA_SMS_API_SECRET
      ? String(process.env.FIRMA_SMS_API_SECRET).trim()
      : '';
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    return String(localStorage.getItem('FIRMA_SMS_API_SECRET') || '').trim();
  }
  return '';
}

function debugFirmaSmsConfig(mainCfg, base, hasSecret) {
  const bundleBaseLen =
    typeof __FIRMA_SMS_API_BASE__ !== 'undefined' ? String(__FIRMA_SMS_API_BASE__ || '').length : -1;
  const nodeEnv =
    typeof process !== 'undefined' && process.env ? String(process.env.NODE_ENV || '') : '';
  const mainBaseLen = mainCfg ? String(mainCfg.apiBase || '').length : -1;
  // No imprimimos secretos. Siempre log al pulsar SMS.
  // eslint-disable-next-line no-console
  console.info('[FirmaService][SMS]', {
    fuente: mainCfg?.apiBase
      ? 'main/ipc'
      : typeof __FIRMA_SMS_API_BASE__ !== 'undefined'
        ? 'webpack'
        : 'sin-inyeccion-webpack',
    FIRMA_SMS_API_BASE: base || '(vacío)',
    FIRMA_SMS_API_SECRET: hasSecret ? '(presente)' : '(vacío)',
    mainBaseLen,
    bundleBaseLen,
    NODE_ENV: nodeEnv || '(n/a)',
    FIRMA_PORTAL_BASE_URL_env: mainCfg?.portalBaseUrl || '(vacío)',
    FIRMA_SMS_LINK_TEXT_ONLY: mainCfg?.linkTextOnly ? '1' : '0',
    FIRMA_SMS_LINK_URL_MODE: mainCfg?.linkUrlMode || 'full',
    FIRMA_PORTAL_BASE_URL_LS:
      typeof window !== 'undefined' ? String(localStorage.getItem('FIRMA_PORTAL_BASE_URL') || '') : ''
  });
}

async function sha256File(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomToken() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function isMissingFirmaPackSchema(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (msg.includes('row-level security') || msg.includes('permission denied for')) return false;
  return (
    (msg.includes('does not exist') && (msg.includes('envio_id') || msg.includes('firma_envios'))) ||
    (msg.includes('could not find') && msg.includes('envio_id'))
  );
}

function formatFirmaEnviosRlsError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (!msg.includes('firma_envios') || !msg.includes('row-level security')) return null;
  return (
    'La tabla firma_envios ya existe pero faltan permisos (RLS) en Supabase. ' +
    'Ejecuta database/alter_firma_envios_rls.sql en el SQL Editor y vuelve a crear el pack.'
  );
}

function formatFirmaTipoDocumentoCheckError(err) {
  const msg = String(err?.message || err || '');
  if (!msg.includes('firma_documentos_tipo_documento_check')) return null;
  return (
    'El tipo de documento no está permitido en Supabase (check constraint antiguo). ' +
    'Ejecuta database/alter_firma_documentos_tipo_documento.sql en el SQL Editor.'
  );
}

function formatFirmaPackSchemaError(err) {
  const tipoCheck = formatFirmaTipoDocumentoCheckError(err);
  if (tipoCheck) return tipoCheck;
  const rls = formatFirmaEnviosRlsError(err);
  if (rls) return rls;
  if (!isMissingFirmaPackSchema(err)) return null;
  return (
    'Falta la migración de packs de firma en Supabase. Ejecuta el SQL del archivo ' +
    'database/create_firma_envios.sql (SQL Editor → Run). Luego recarga Firma en Kronos.'
  );
}

class FirmaService {
  /**
   * Base pública del portal de firma (p. ej. https://firma.solucionssocials.org/firmar), sin barra final.
   * Vacío si no hay FIRMA_PORTAL_BASE_URL en .env (main) ni FIRMA_PORTAL_BASE_URL en localStorage.
   */
  async resolvePortalBaseUrl() {
    await getFirmaMainConfig();
    return getPortalBaseForLinks();
  }

  async loadTrabajadores() {
    const { data, error } = await supabase
      .from(TABLE_TRABAJADORES)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getOrCreateTrabajadorFromHolded(holdedEmployee) {
    const holdedId = String(holdedEmployee?.id || '').trim();
    if (!holdedId) throw new Error('Empleado Holded inválido (falta id).');

    const payload = {
      holded_employee_id: holdedId,
      nombre: String(holdedEmployee?.nombreCompleto || holdedEmployee?.nombre || '').trim(),
      dni: String(holdedEmployee?.dni || '').trim() || null,
      telefono: String(holdedEmployee?.telefono || '').trim(),
      email: String(holdedEmployee?.email || '').trim() || null
    };

    if (!payload.nombre) throw new Error('El empleado de Holded no tiene nombre.');
    if (!payload.telefono) throw new Error('El empleado de Holded no tiene teléfono móvil.');

    // 1) Buscar por holded_employee_id (fuente de verdad)
    const { data: existing, error: findErr } = await supabase
      .from(TABLE_TRABAJADORES)
      .select('*')
      .eq('holded_employee_id', payload.holded_employee_id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing?.id) {
      // 2) Mantener actualizado teléfono/email/nombre por si cambian en Holded
      const shouldUpdate =
        (payload.nombre && payload.nombre !== existing.nombre) ||
        (payload.dni !== (existing.dni || null)) ||
        (payload.telefono && payload.telefono !== existing.telefono) ||
        ((payload.email || null) !== (existing.email || null));

      if (!shouldUpdate) return existing;

      const { data: updated, error: updErr } = await supabase
        .from(TABLE_TRABAJADORES)
        .update({
          nombre: payload.nombre,
          dni: payload.dni,
          telefono: payload.telefono,
          email: payload.email
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (updErr) throw updErr;
      return updated;
    }

    // 3) Insertar nuevo trabajador de firma vinculado a Holded
    const { data: created, error: createErr } = await supabase
      .from(TABLE_TRABAJADORES)
      .insert(payload)
      .select()
      .single();
    if (createErr) throw createErr;
    return created;
  }

  async createTrabajador(payload) {
    const insertPayload = {
      holded_employee_id: payload.holdedEmployeeId || null,
      nombre: String(payload.nombre || '').trim(),
      dni: String(payload.dni || '').trim() || null,
      telefono: String(payload.telefono || '').trim(),
      email: String(payload.email || '').trim() || null
    };
    const { data, error } = await supabase
      .from(TABLE_TRABAJADORES)
      .insert(insertPayload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async _enrichEnviosRows(rows) {
    const envios = Array.isArray(rows) ? rows : [];
    const envioIds = envios.map((r) => r.id).filter(Boolean);
    const docIds = envios.flatMap((e) => (e.documentos || []).map((d) => d.id)).filter(Boolean);

    let otpPrimeraPorEnvio = new Map();
    let otpPrimeraPorDoc = new Map();
    if (envioIds.length) {
      const { data: challEnv, error: challEnvErr } = await supabase
        .from(TABLE_OTP_CHALLENGES)
        .select('envio_id, created_at')
        .in('envio_id', envioIds);
      if (!challEnvErr) {
        for (const c of challEnv || []) {
          if (!c.envio_id || !c.created_at) continue;
          const prev = otpPrimeraPorEnvio.get(c.envio_id);
          if (!prev || new Date(c.created_at).getTime() < new Date(prev).getTime()) {
            otpPrimeraPorEnvio.set(c.envio_id, c.created_at);
          }
        }
      }
    }
    if (docIds.length) {
      const { data: challDoc, error: challDocErr } = await supabase
        .from(TABLE_OTP_CHALLENGES)
        .select('documento_id, created_at')
        .in('documento_id', docIds);
      if (!challDocErr) {
        for (const c of challDoc || []) {
          if (!c.documento_id || !c.created_at) continue;
          const prev = otpPrimeraPorDoc.get(c.documento_id);
          if (!prev || new Date(c.created_at).getTime() < new Date(prev).getTime()) {
            otpPrimeraPorDoc.set(c.documento_id, c.created_at);
          }
        }
      }
    }

    const tokenIds = envios.map((r) => r.token_actual_id).filter(Boolean);
    let tokenMap = new Map();
    if (tokenIds.length) {
      const { data: tokens, error: tokenError } = await supabase
        .from(TABLE_TOKENS)
        .select('id, token, expires_at, used_at, revoked_at')
        .in('id', tokenIds);
      if (tokenError) throw tokenError;
      tokenMap = new Map((tokens || []).map((t) => [t.id, t]));
    }

    return envios.map((row) => {
      const documentos = [...(row.documentos || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      const otpDesdeEnvio = row.otp_primera_solicitud_at || otpPrimeraPorEnvio.get(row.id) || null;
      const otpDesdeDoc = documentos.length === 1
        ? documentos[0].otp_primera_solicitud_at || otpPrimeraPorDoc.get(documentos[0].id) || null
        : null;
      const token = row.token_actual_id ? tokenMap.get(row.token_actual_id) || null : null;
      return {
        ...row,
        documentos,
        otp_primera_solicitud_at: otpDesdeEnvio || otpDesdeDoc || null,
        token_actual: token,
        portal_link: token?.token ? buildPortalLink(token.token) : '',
        es_pack: documentos.length > 1
      };
    });
  }

  _docOrphanAsEnvio(doc) {
    return {
      id: doc.id,
      trabajador_id: doc.trabajador_id,
      nombre: doc.file_name || doc.tipo_documento,
      estado: doc.estado,
      fecha_inicio: doc.fecha_inicio,
      fecha_fin: doc.fecha_fin,
      notas_internas: doc.notas_internas,
      token_actual_id: doc.token_actual_id,
      link_compartido_at: doc.link_compartido_at,
      portal_abierto_at: doc.portal_abierto_at,
      otp_primera_solicitud_at: doc.otp_primera_solicitud_at,
      firmado_at: doc.firmado_at,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      trabajador: doc.trabajador,
      documentos: [doc],
      es_legacy_suelto: true
    };
  }

  /** Envíos de firma (packs multi-PDF + legacy sueltos sin envio_id). */
  async loadEnvios() {
    await getFirmaMainConfig();

    let envios = [];
    const { data: envioRows, error: envErr } = await supabase
      .from(TABLE_ENVIOS)
      .select(`
        *,
        trabajador:firma_trabajadores (
          id,
          nombre,
          dni,
          telefono,
          email
        ),
        documentos:firma_documentos (*)
      `)
      .order('created_at', { ascending: false });

    if (envErr) {
      if (!isMissingFirmaPackSchema(envErr)) throw envErr;
    } else {
      envios = await this._enrichEnviosRows(envioRows || []);
    }

    let orphanDocs = [];
    const { data: orphans, error: orphanErr } = await supabase
      .from(TABLE_DOCUMENTOS)
      .select(`
        *,
        trabajador:firma_trabajadores (
          id,
          nombre,
          dni,
          telefono,
          email
        )
      `)
      .is('envio_id', null)
      .order('created_at', { ascending: false });
    if (orphanErr) {
      if (!isMissingFirmaPackSchema(orphanErr)) throw orphanErr;
      const { data: allDocs, error: allErr } = await supabase
        .from(TABLE_DOCUMENTOS)
        .select(`
          *,
          trabajador:firma_trabajadores (
            id,
            nombre,
            dni,
            telefono,
            email
          )
        `)
        .order('created_at', { ascending: false });
      if (allErr) {
        const hint = formatFirmaPackSchemaError(allErr);
        throw new Error(hint || allErr.message || String(allErr));
      }
      orphanDocs = allDocs || [];
    } else {
      orphanDocs = orphans || [];
    }

    const legacy = await this._enrichEnviosRows(
      orphanDocs.map((doc) => this._docOrphanAsEnvio(doc))
    );

    return [...envios, ...legacy].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /** @deprecated Usa loadEnvios. Mantiene compatibilidad con código antiguo. */
  async loadDocumentos() {
    const envios = await this.loadEnvios();
    return envios.flatMap((e) =>
      (e.documentos || []).map((d) => ({
        ...d,
        trabajador: e.trabajador,
        portal_link: e.portal_link,
        link_compartido_at: e.link_compartido_at || d.link_compartido_at,
        portal_abierto_at: e.portal_abierto_at || d.portal_abierto_at,
        otp_primera_solicitud_at: e.otp_primera_solicitud_at || d.otp_primera_solicitud_at,
        envio: e
      }))
    );
  }

  async uploadPdf({ documentoId, file }) {
    if (!file) throw new Error('Falta el PDF');
    const ext = file.name.split('.').pop() || 'pdf';
    const safeName = `${Date.now()}-${String(file.name || 'documento').replace(/[^\w.-]/g, '_')}`;
    const storagePath = `${documentoId}/${safeName}.${ext === 'pdf' ? 'pdf' : ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/pdf'
      });
    if (error) throw error;

    const hashPdf = await sha256File(file);
    const { data, error: updateError } = await supabase
      .from(TABLE_DOCUMENTOS)
      .update({
        storage_path: storagePath,
        file_name: file.name,
        hash_pdf: hashPdf
      })
      .eq('id', documentoId)
      .select()
      .single();
    if (updateError) throw updateError;
    return data;
  }

  async createTokenFirma({ documentoId, envioId = null, expiresHours = 48 }) {
    await getFirmaMainConfig();
    const nowIso = new Date().toISOString();

    if (envioId) {
      await supabase
        .from(TABLE_TOKENS)
        .update({ revoked_at: nowIso })
        .eq('envio_id', envioId)
        .is('used_at', null)
        .is('revoked_at', null);
    }
    if (documentoId) {
      await supabase
        .from(TABLE_TOKENS)
        .update({ revoked_at: nowIso })
        .eq('documento_id', documentoId)
        .is('used_at', null)
        .is('revoked_at', null);
    }

    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();
    const token = randomToken();
    const insertPayload = {
      documento_id: documentoId,
      token,
      expires_at: expiresAt
    };
    if (envioId) insertPayload.envio_id = envioId;

    const { data, error } = await supabase.from(TABLE_TOKENS).insert(insertPayload).select().single();
    if (error) throw error;

    if (envioId) {
      const { error: envErr } = await supabase
        .from(TABLE_ENVIOS)
        .update({ token_actual_id: data.id })
        .eq('id', envioId);
      if (envErr) throw envErr;
    }
    if (documentoId) {
      const { error: docError } = await supabase
        .from(TABLE_DOCUMENTOS)
        .update({ token_actual_id: data.id })
        .eq('id', documentoId);
      if (docError) throw docError;
    }

    return {
      ...data,
      portalLink: buildPortalLink(token)
    };
  }

  async createEnvio({ trabajadorId, nombre, fechaInicio, fechaFin, notasInternas, items }) {
    await getFirmaMainConfig();
    if (!getPortalBaseForLinks()) {
      throw new Error(
        'Falta FIRMA_PORTAL_BASE_URL en el .env de Kronos (proceso principal). Ejemplo: FIRMA_PORTAL_BASE_URL=https://tu-dominio.com/firmar — sin barra al final. Reinicia la app tras guardar el .env.'
      );
    }

    const list = (Array.isArray(items) ? items : []).filter((i) => i?.file);
    if (!list.length) throw new Error('Añade al menos un PDF al pack.');

    const tipos = list.map((i) => String(i.tipoDocumento || '').trim());
    if (tipos.includes('vrp_consentimiento') && tipos.includes('vrp_renuncia')) {
      throw new Error(
        'No puedes incluir VRP consentimiento y VRP renuncia en el mismo pack. Usa solo uno según la decisión del trabajador.'
      );
    }

    const packNombre =
      String(nombre || '').trim() ||
      (list.length === 1 ? null : `Pack contratación (${list.length} documentos)`);

    const { data: envio, error: envErr } = await supabase
      .from(TABLE_ENVIOS)
      .insert({
        trabajador_id: trabajadorId,
        nombre: packNombre,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        notas_internas: notasInternas || null,
        estado: 'pendiente'
      })
      .select()
      .single();
    if (envErr) {
      const hint = formatFirmaPackSchemaError(envErr);
      throw new Error(hint || envErr.message || String(envErr));
    }

    const createdDocs = [];
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      const { data: doc, error: docErr } = await supabase
        .from(TABLE_DOCUMENTOS)
        .insert({
          trabajador_id: trabajadorId,
          envio_id: envio.id,
          orden: i,
          tipo_documento: item.tipoDocumento,
          fecha_inicio: fechaInicio || null,
          fecha_fin: fechaFin || null,
          estado: 'pendiente',
          storage_path: 'pending',
          file_name: item.file?.name || null,
          notas_internas: notasInternas || null
        })
        .select()
        .single();
      if (docErr) {
        const hint = formatFirmaPackSchemaError(docErr);
        throw new Error(hint || docErr.message || String(docErr));
      }
      await this.uploadPdf({ documentoId: doc.id, file: item.file });
      createdDocs.push(doc);
    }

    const firstDocId = createdDocs[0].id;
    let tokenInfo;
    try {
      tokenInfo = await this.createTokenFirma({ documentoId: firstDocId, envioId: envio.id });
    } catch (tokenErr) {
      const hint = formatFirmaPackSchemaError(tokenErr);
      throw new Error(hint || tokenErr?.message || String(tokenErr));
    }
    await supabase.from(TABLE_AUDITORIAS).insert({
      documento_id: firstDocId,
      resultado: 'ok',
      detalle: {
        accion: 'envio_pack_creado',
        envio_id: envio.id,
        num_documentos: list.length,
        token_generado: true
      }
    });

    return {
      envioId: envio.id,
      documentoIds: createdDocs.map((d) => d.id),
      tokenInfo
    };
  }

  async createDocumento({ trabajadorId, tipoDocumento, fechaInicio, fechaFin, notasInternas, file }) {
    return this.createEnvio({
      trabajadorId,
      nombre: null,
      fechaInicio,
      fechaFin,
      notasInternas,
      items: [{ tipoDocumento, file }]
    });
  }

  async cancelarEnvio(envioId, { esLegacySuelto = false } = {}) {
    const nowIso = new Date().toISOString();

    if (esLegacySuelto) {
      return this.cancelarDocumento(envioId);
    }

    const { error: envErr } = await supabase
      .from(TABLE_ENVIOS)
      .update({ estado: 'cancelado', updated_at: nowIso })
      .eq('id', envioId);
    if (envErr) throw envErr;

    await supabase.from(TABLE_DOCUMENTOS).update({ estado: 'cancelado' }).eq('envio_id', envioId);

    await supabase
      .from(TABLE_TOKENS)
      .update({ revoked_at: nowIso })
      .eq('envio_id', envioId)
      .is('used_at', null)
      .is('revoked_at', null);

    const { data: docs } = await supabase.from(TABLE_DOCUMENTOS).select('id').eq('envio_id', envioId).limit(1);
    const docId = docs?.[0]?.id;
    if (docId) {
      await supabase.from(TABLE_AUDITORIAS).insert({
        documento_id: docId,
        resultado: 'cancelado',
        detalle: { accion: 'envio_pack_cancelado', envio_id: envioId }
      });
    }
    return true;
  }

  async cancelarDocumento(documentoId) {
    const { error } = await supabase
      .from(TABLE_DOCUMENTOS)
      .update({ estado: 'cancelado' })
      .eq('id', documentoId);
    if (error) throw error;

    await supabase
      .from(TABLE_TOKENS)
      .update({ revoked_at: new Date().toISOString() })
      .eq('documento_id', documentoId)
      .is('used_at', null)
      .is('revoked_at', null);

    await supabase.from(TABLE_AUDITORIAS).insert({
      documento_id: documentoId,
      resultado: 'cancelado',
      detalle: { accion: 'cancelado_desde_kronos' }
    });
    return true;
  }

  /**
   * Envía un SMS con el enlace de firma vía API del portal-firma (Twilio en servidor).
   * Requiere FIRMA_SMS_API_BASE (ej. http://localhost:3001) y FIRMA_SMS_API_SECRET (mismo valor en portal .env.local).
   */
  async sendLinkSms({ documentoId, to, portalLink, trabajadorNombre }) {
    const mainCfg = await getFirmaMainConfig();
    const baseRaw = String(mainCfg?.apiBase || '').trim() || getSmsApiBase();
    const base = baseRaw ? baseRaw.replace(/\/$/, '') : '';
    const secret = String(mainCfg?.apiSecret || '').trim() || getSmsApiSecret();
    debugFirmaSmsConfig(mainCfg, base, !!secret);
    if (!base) throw new Error('Falta FIRMA_SMS_API_BASE (URL del portal, ej. http://localhost:3001)');
    if (!secret) throw new Error('Falta FIRMA_SMS_API_SECRET (debe coincidir con portal-firma .env.local)');
    if (!documentoId) throw new Error('Falta documentoId');

    const nombre = trabajadorNombre ? String(trabajadorNombre).trim() : '';
    const linkUrlMode = mainCfg?.linkUrlMode || 'full';
    const textOnly = !!mainCfg?.linkTextOnly || linkUrlMode === 'none';
    const linkForSms =
      linkUrlMode === 'base'
        ? (getOriginFromPortalBaseUrl(mainCfg?.portalBaseUrl) || portalLink)
        : portalLink;

    const body = textOnly
      ? (nombre
        ? `Hola ${nombre}, tienes un documento para firmar en Kronos.`
        : 'Tienes un documento para firmar en Kronos.')
      : (nombre
        ? `Kronos: documento pendiente de firma. Enlace: ${linkForSms}`
        : `Kronos: documento pendiente de firma. Enlace: ${linkForSms}`);

    const res = await fetch(`${base}/api/firma/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`
      },
      body: JSON.stringify({ to, body })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(json.error || `Error enviando SMS (${res.status})`);
    }

    const nowIso = new Date().toISOString();
    const { error: docErr } = await supabase
      .from(TABLE_DOCUMENTOS)
      .update({
        estado: 'enviado',
        enviado_at: nowIso,
        // SMS de enlace cuenta como “enlace enviado” si la columna existe
        link_compartido_at: nowIso
      })
      .eq('id', documentoId);
    if (docErr) {
      // El SMS ya salió; no rompemos el flujo, pero dejamos trazabilidad
      await supabase.from(TABLE_AUDITORIAS).insert({
        documento_id: documentoId,
        resultado: 'ok',
        detalle: { accion: 'sms_enviado_sin_actualizar_estado', error: docErr.message }
      });
    } else {
      await supabase.from(TABLE_AUDITORIAS).insert({
        documento_id: documentoId,
        resultado: 'ok',
        detalle: { accion: 'sms_enlace_enviado', delivery: json.delivery || 'sms' }
      });
    }

    return json;
  }

  /**
   * Marca la primera vez que se compartió el enlace desde Kronos (WhatsApp, email, copiar mensaje, etc.).
   * Idempotente: no sobrescribe si ya había fecha.
   */
  async marcarLinkCompartidoEnvio(envio, { esLegacySuelto = false } = {}) {
    if (!envio?.id) throw new Error('Falta envío');
    const nowIso = new Date().toISOString();

    if (esLegacySuelto || envio.es_legacy_suelto) {
      return this.marcarLinkCompartido(envio.id);
    }

    const { data: row, error: readErr } = await supabase
      .from(TABLE_ENVIOS)
      .select('id, link_compartido_at')
      .eq('id', envio.id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) throw new Error('Envío no encontrado');
    if (row.link_compartido_at) return { ok: true, already: true };

    const { error } = await supabase
      .from(TABLE_ENVIOS)
      .update({ link_compartido_at: nowIso, updated_at: nowIso })
      .eq('id', envio.id)
      .is('link_compartido_at', null);
    if (error) throw error;

    const docId = envio.documentos?.[0]?.id;
    if (docId) {
      await supabase.from(TABLE_AUDITORIAS).insert({
        documento_id: docId,
        resultado: 'ok',
        detalle: { accion: 'link_compartido_desde_kronos', envio_id: envio.id }
      });
    }
    return { ok: true };
  }

  async marcarLinkCompartido(documentoId) {
    if (!documentoId) throw new Error('Falta documentoId');
    const nowIso = new Date().toISOString();
    const { data: row, error: readErr } = await supabase
      .from(TABLE_DOCUMENTOS)
      .select('id, link_compartido_at')
      .eq('id', documentoId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) throw new Error('Documento no encontrado');
    if (row.link_compartido_at) return { ok: true, already: true };

    const { error } = await supabase
      .from(TABLE_DOCUMENTOS)
      .update({ link_compartido_at: nowIso })
      .eq('id', documentoId)
      .is('link_compartido_at', null);
    if (error) throw error;

    await supabase.from(TABLE_AUDITORIAS).insert({
      documento_id: documentoId,
      resultado: 'ok',
      detalle: { accion: 'link_compartido_desde_kronos' }
    });
    return { ok: true };
  }

  /**
   * URL firmada temporal para ver/descargar un PDF del bucket (original o con sello de firma).
   */
  async getDocumentoPdfSignedUrl(documento, { firmado = true, expiresIn = 600 } = {}) {
    if (!documento) throw new Error('Falta documento');
    const path = firmado ? documento.storage_path_firmado : documento.storage_path;
    if (!path || path === 'pending') {
      throw new Error(firmado ? 'Este documento aún no está firmado' : 'PDF original no disponible');
    }
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error('No se pudo obtener el enlace del PDF');
    return data.signedUrl;
  }

  async downloadDocumentoPdf(documento, { firmado = true } = {}) {
    const url = await this.getDocumentoPdfSignedUrl(documento, { firmado });
    const fallbackName = `${documento.tipo_documento || 'documento'}.pdf`;
    const fileName = firmado
      ? documento.file_name_firmado || `SIGNED-${fallbackName}`
      : documento.file_name || fallbackName;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error descargando PDF (${res.status})`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
  }

  /** Historial de auditoría de un envío (portal + Kronos). */
  async loadAuditoriasForEnvio(envio) {
    if (!envio?.id) return [];

    const docIds = [...new Set((envio.documentos || []).map((d) => d.id).filter(Boolean))];
    if (!docIds.length && envio.es_legacy_suelto) {
      docIds.push(envio.id);
    }
    if (!docIds.length) return [];

    const { data, error } = await supabase
      .from(TABLE_AUDITORIAS)
      .select('id, documento_id, ip, user_agent, resultado, detalle, created_at')
      .in('documento_id', docIds)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const envioId = envio.es_legacy_suelto ? null : envio.id;
    return (data || []).filter((row) => {
      const det = row.detalle && typeof row.detalle === 'object' ? row.detalle : {};
      const detEnvio = det.envio_id || null;
      if (envioId && detEnvio && detEnvio !== envioId) return false;
      return true;
    });
  }
}

export default new FirmaService();
