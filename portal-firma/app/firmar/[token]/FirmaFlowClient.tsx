'use client';

import { useMemo, useState } from 'react';

type Props = {
  token: string;
  canAttempt: boolean;
  isUsed: boolean;
  isRevoked: boolean;
  isExpired: boolean;
};

export default function FirmaFlowClient({ token, canAttempt, isUsed, isRevoked, isExpired }: Props) {
  const [step, setStep] = useState<'idle' | 'requested' | 'verified' | 'done'>('idle');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [debugOtp, setDebugOtp] = useState<string>('');

  const disabledReason = useMemo(() => {
    if (!canAttempt) return 'No disponible.';
    if (isExpired) return 'Este enlace ha caducado.';
    if (isRevoked) return 'Este enlace ha sido revocado.';
    if (isUsed) return 'Este enlace ya ha sido utilizado.';
    return '';
  }, [canAttempt, isExpired, isRevoked, isUsed]);

  const requestOtp = async () => {
    setLoading(true);
    setErr('');
    setMsg('');
    setDebugOtp('');
    try {
      const res = await fetch(`/firmar/${encodeURIComponent(token)}/otp/request`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo enviar el código');
      setStep('requested');
      if (json.delivery === 'debug' && json.otp) setDebugOtp(String(json.otp));
      setMsg(json.delivery === 'sms' ? 'Código enviado por SMS.' : 'Modo debug: código generado (solo dev).');
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
      const res = await fetch(`/firmar/${encodeURIComponent(token)}/accept`, { method: 'POST' });
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
        <button
          onClick={requestOtp}
          disabled={loading}
          className="w-full rounded-full bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
        >
          {loading ? 'Enviando código...' : 'Enviar código por SMS'}
        </button>
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
              disabled={loading}
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
          {loading ? 'Firmando...' : 'Acepto y firmo'}
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

