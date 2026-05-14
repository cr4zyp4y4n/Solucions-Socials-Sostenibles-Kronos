/* global __FIRMA_SMS_API_BASE__, __FIRMA_SMS_API_SECRET__ */
import { supabase } from '../config/supabase';

const TABLE_TRABAJADORES = 'firma_trabajadores';
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
  return 'https://pendiente-configurar-portal.local/firmar'.replace(/\/$/, '');
}

function buildPortalLink(token) {
  const base = getPortalBaseForLinks();
  return `${base}/${token}`;
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

class FirmaService {
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

  async loadDocumentos() {
    await getFirmaMainConfig();
    const { data, error } = await supabase
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
    if (error) throw error;

    const rows = data || [];
    const docIds = rows.map((r) => r.id).filter(Boolean);

    /** Si la columna otp_primera_solicitud_at no se rellenó en el portal, inferimos la primera solicitud desde un agregado seguro. */
    let otpPrimeraPorDoc = new Map();
    if (docIds.length) {
      const { data: rpcRows, error: rpcError } = await supabase
        .rpc('firma_otp_first_requests', { documento_ids: docIds });
      if (!rpcError) {
        for (const c of rpcRows || []) {
          const did = c.documento_id;
          const ts = c.created_at;
          if (did && ts) otpPrimeraPorDoc.set(did, ts);
        }
      } else {
        // Compatibilidad con entornos que aun no han instalado la RPC segura.
        const { data: challRows, error: challError } = await supabase
          .from(TABLE_OTP_CHALLENGES)
          .select('documento_id, created_at')
          .in('documento_id', docIds);
        if (challError) {
          console.warn('[firma] firma_otp_first_requests/firma_otp_challenges (merge OTP):', rpcError.message, challError.message);
        } else {
          for (const c of challRows || []) {
            const did = c.documento_id;
            const ts = c.created_at;
            if (!did || !ts) continue;
            const prev = otpPrimeraPorDoc.get(did);
            if (!prev || new Date(ts).getTime() < new Date(prev).getTime()) {
              otpPrimeraPorDoc.set(did, ts);
            }
          }
        }
      }
    }

    const tokenIds = rows.map((r) => r.token_actual_id).filter(Boolean);
    let tokenMap = new Map();
    if (tokenIds.length) {
      const { data: tokens, error: tokenError } = await supabase
        .from(TABLE_TOKENS)
        .select('id, token, expires_at, used_at, revoked_at')
        .in('id', tokenIds);
      if (tokenError) throw tokenError;
      tokenMap = new Map((tokens || []).map((t) => [t.id, t]));
    }

    return rows.map((row) => {
      const desdeColumna = row.otp_primera_solicitud_at || null;
      const desdeChallenge = otpPrimeraPorDoc.get(row.id) || null;
      const otpPrimera = desdeColumna || desdeChallenge || null;
      return {
        ...row,
        otp_primera_solicitud_at: otpPrimera,
        token_actual: row.token_actual_id ? tokenMap.get(row.token_actual_id) || null : null,
        portal_link: row.token_actual_id && tokenMap.get(row.token_actual_id)?.token
          ? buildPortalLink(tokenMap.get(row.token_actual_id).token)
          : ''
      };
    });
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

  async createTokenFirma({ documentoId, expiresHours = 48 }) {
    await getFirmaMainConfig();
    const nowIso = new Date().toISOString();
    await supabase
      .from(TABLE_TOKENS)
      .update({ revoked_at: nowIso })
      .eq('documento_id', documentoId)
      .is('used_at', null)
      .is('revoked_at', null);

    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();
    const token = randomToken();
    const { data, error } = await supabase
      .from(TABLE_TOKENS)
      .insert({
        documento_id: documentoId,
        token,
        expires_at: expiresAt
      })
      .select()
      .single();
    if (error) throw error;

    const { error: docError } = await supabase
      .from(TABLE_DOCUMENTOS)
      .update({ token_actual_id: data.id })
      .eq('id', documentoId);
    if (docError) throw docError;

    return {
      ...data,
      portalLink: buildPortalLink(token)
    };
  }

  async createDocumento({ trabajadorId, tipoDocumento, fechaInicio, fechaFin, notasInternas, file }) {
    const { data, error } = await supabase
      .from(TABLE_DOCUMENTOS)
      .insert({
        trabajador_id: trabajadorId,
        tipo_documento: tipoDocumento,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        estado: 'pendiente',
        storage_path: 'pending',
        file_name: file?.name || null,
        notas_internas: notasInternas || null
      })
      .select()
      .single();
    if (error) throw error;

    const documentoId = data.id;
    if (file) {
      await this.uploadPdf({ documentoId, file });
    }
    const tokenInfo = await this.createTokenFirma({ documentoId });
    await supabase.from(TABLE_AUDITORIAS).insert({
      documento_id: documentoId,
      resultado: 'ok',
      detalle: { accion: 'creado_en_kronos', token_generado: true }
    });

    return {
      documentoId,
      tokenInfo
    };
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
}

export default new FirmaService();
