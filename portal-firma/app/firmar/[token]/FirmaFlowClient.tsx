'use client';

import { useEffect, useMemo, useState } from 'react';

type Props = {
  token: string;
  canAttempt: boolean;
  isUsed: boolean;
  isRevoked: boolean;
  isExpired: boolean;
  requiereConfirmacionDni?: boolean;
  acceptLabel?: string;
  blockedHint?: string;
};

export default function FirmaFlowClient({
  token,
  canAttempt,
  isUsed,
  isRevoked,
  isExpired,
  requiereConfirmacionDni = false,
  acceptLabel = 'Acepto y firmo',
  blockedHint = ''
}: Props) {
  useEffect(() => {
    if (isExpired || isRevoked) return;
    const url = `/firmar/${encodeURIComponent(token)}/open`;
    void fetch(url, { method: 'POST', cache: 'no-store' }).catch(() => {});
  }, [token, isExpired, isRevoked]);

  const [step, setStep] = useState<'idle' | 'requested' | 'verified' | 'done'>('idle');
  const [dni, setDni] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [debugOtp, setDebugOtp] = useState<string>('');

  const disabledReason = useMemo(() => {
    if (blockedHint) return blockedHint;
    if (!canAttempt) return 'No disponible.';
    if (isExpired) return 'Este enlace ha caducado.';
    if (isRevoked) return 'Este enlace ha sido revocado.';
    if (isUsed) return 'Este enlace ya ha sido utilizado.';
    return '';
  }, [blockedHint, canAttempt, isExpired, isRevoked, isUsed]);

  const requestOtp = async () => {
    if (requiereConfirmacionDni && !dni.trim()) {
      setErr('Introduce tu DNI o NIE para continuar.');
      return;
    }
    setLoading(true);
    setErr('');
    setMsg('');
    setDebugOtp('');
    try {
      const res = await fetch(`/firmar/${encodeURIComponent(token)}/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requiereConfirmacionDni ? { dni: dni.trim() } : {})
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo enviar el código');
      setStep('requested');
      if (json.delivery === 'debug' && json.otp) setDebugOtp(String(json.otp));
      const baseMsg =
        json.delivery === 'sms' ? 'Código enviado por SMS.' : 'Modo debug: código generado (solo dev).';
      const seg = json.otpSeguimiento as { ok?: boolean; error?: string; yaEstaba?: boolean } | undefined;
      if (seg && seg.ok === false && seg.error) {
        setMsg(
          `${baseMsg} Atención: el historial en Kronos puede no actualizarse hasta solucionar esto: ${seg.error}`
        );
      } else {
        setMsg(baseMsg);
      }
    } catch (e: any) {
      setErr(e?.message || 'Error enviando OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`/firmar/${encodeURIComponent(token)}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otp.trim() })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'Código incorrecto');
      setStep('verified');
      setMsg('Código verificado correctamente.');
    } catch (e: any) {
      setErr(e?.message || 'Error verificando OTP');
    } finally {
      setLoading(false);
    }
  };

  const accept = async () => {
    setLoading(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`/firmar/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo completar la firma');
      setStep('done');
      setMsg('Documento aceptado correctamente.');
    } catch (e: any) {
      setErr(e?.message || 'Error aceptando documento');
    } finally {
      setLoading(false);
    }
  };

  if (disabledReason) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-700">
        {disabledReason}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {msg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {msg}
        </div>
      ) : null}
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      ) : null}

      {debugOtp ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>OTP (debug)</b>: {debugOtp}
        </div>
      ) : null}

      {step === 'idle' ? (
        <div className="space-y-3">
          {requiereConfirmacionDni ? (
            <div>
              <div className="mb-2 text-sm text-zinc-700">
                Para verificar tu identidad, introduce tu <b>DNI o NIE</b> (debe coincidir con el de la empresa).
              </div>
              <input
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base uppercase tracking-wide"
                placeholder="12345678A"
              />
            </div>
          ) : null}
          <button
            onClick={requestOtp}
            disabled={loading || (requiereConfirmacionDni && !dni.trim())}
            className="w-full rounded-full bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading
              ? 'Enviando código...'
              : requiereConfirmacionDni
                ? 'Confirmar DNI y enviar código por SMS'
                : 'Enviar código por SMS'}
          </button>
        </div>
      ) : null}

      {step === 'requested' ? (
        <div className="space-y-3">
          <div>
            <div className="mb-2 text-sm font-bold text-zinc-700">Introduce el código</div>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base"
              placeholder="123456"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={verifyOtp}
              disabled={loading || !otp.trim()}
              className="rounded-full bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
            <button
              onClick={requestOtp}
              disabled={loading || (requiereConfirmacionDni && !dni.trim())}
              className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60"
            >
              Reenviar código
            </button>
          </div>
        </div>
      ) : null}

      {step === 'verified' ? (
        <button
          onClick={accept}
          disabled={loading}
          className="w-full rounded-full bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
        >
          {loading ? 'Firmando...' : acceptLabel}
        </button>
      ) : null}

      {step === 'done' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          Firma completada. Ya puedes cerrar esta página.
        </div>
      ) : null}
    </div>
  );
}
