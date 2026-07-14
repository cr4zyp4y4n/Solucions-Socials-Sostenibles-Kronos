import { resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { getRequestInfo } from '@/lib/requestInfo';
import { supabaseAdmin } from '@/lib/supabase';

export type FirmaOnboardingEvento =
  | 'modal_mostrado'
  | 'eleccion_primera_vez'
  | 'rechazado_inicio'
  | 'guia_abandonada'
  | 'paso_siguiente'
  | 'completado';

export type FirmaOnboardingResultado = 'completado' | 'rechazado_inicio' | 'abandonado_mitad';

const EVENTO_ACCION: Record<FirmaOnboardingEvento, string> = {
  modal_mostrado: 'onboarding_modal_mostrado',
  eleccion_primera_vez: 'onboarding_iniciado',
  rechazado_inicio: 'onboarding_rechazado_inicio',
  guia_abandonada: 'onboarding_abandonado_mitad',
  paso_siguiente: 'onboarding_paso_visto',
  completado: 'onboarding_completado'
};

const EVENTO_RESULTADO: Partial<Record<FirmaOnboardingEvento, FirmaOnboardingResultado>> = {
  rechazado_inicio: 'rechazado_inicio',
  guia_abandonada: 'abandonado_mitad',
  completado: 'completado'
};

async function marcarOnboardingSeguimiento(
  envioId: string | null | undefined,
  documentoId: string | null | undefined,
  evento: FirmaOnboardingEvento
) {
  const nowIso = new Date().toISOString();
  const resultado = EVENTO_RESULTADO[evento];

  if (envioId) {
    if (evento === 'modal_mostrado') {
      await supabaseAdmin
        .from('firma_envios')
        .update({ onboarding_modal_at: nowIso, updated_at: nowIso })
        .eq('id', envioId)
        .is('onboarding_modal_at', null);
      return;
    }
    if (resultado) {
      await supabaseAdmin
        .from('firma_envios')
        .update({
          onboarding_resuelto_at: nowIso,
          onboarding_resultado: resultado,
          updated_at: nowIso
        })
        .eq('id', envioId)
        .is('onboarding_resuelto_at', null);
    }
    return;
  }

  if (!documentoId) return;

  if (evento === 'modal_mostrado') {
    await supabaseAdmin
      .from('firma_documentos')
      .update({ onboarding_modal_at: nowIso })
      .eq('id', documentoId)
      .is('onboarding_modal_at', null);
    return;
  }
  if (resultado) {
    await supabaseAdmin
      .from('firma_documentos')
      .update({
        onboarding_resuelto_at: nowIso,
        onboarding_resultado: resultado
      })
      .eq('id', documentoId)
      .is('onboarding_resuelto_at', null);
  }
}

export async function registrarOnboardingPortal(
  token: string,
  payload: {
    evento: FirmaOnboardingEvento;
    paso?: number;
    totalPasos?: number;
    isPack?: boolean;
  }
) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return { ok: false as const, error: 'Falta token' };

  const resolved = await resolveFirmaToken(trimmed);
  if (!resolved) return { ok: false as const, error: 'Token no válido' };

  const { ip, userAgent } = await getRequestInfo();
  const accion = EVENTO_ACCION[payload.evento] || 'onboarding_evento';
  const envioId = resolved.envio?.id || null;
  const documentoId = resolved.documentoPrincipal?.id || null;

  try {
    await supabaseAdmin.from('firma_auditorias').insert({
      documento_id: documentoId,
      ip: ip || null,
      user_agent: userAgent || null,
      resultado: 'info',
      detalle: {
        accion,
        envio_id: envioId,
        evento: payload.evento,
        paso: payload.paso ?? null,
        total_pasos: payload.totalPasos ?? null,
        is_pack: Boolean(payload.isPack),
        onboarding_resultado: EVENTO_RESULTADO[payload.evento] || null
      }
    });
  } catch (e) {
    console.warn('[firma-onboarding]', 'auditoría insert falló:', e);
  }

  try {
    await marcarOnboardingSeguimiento(envioId, documentoId, payload.evento);
  } catch (e) {
    console.warn('[firma-onboarding]', 'seguimiento update falló:', e);
  }

  return { ok: true as const, accion };
}
