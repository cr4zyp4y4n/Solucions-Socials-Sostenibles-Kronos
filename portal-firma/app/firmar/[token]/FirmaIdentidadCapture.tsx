'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  token: string;
  alreadyDone?: boolean;
  onDone: () => void;
};

export default function FirmaIdentidadCapture({ token, alreadyDone = false, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraErr, setCameraErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [doneLocal, setDoneLocal] = useState(alreadyDone);
  const [aceptaUso, setAceptaUso] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    setDoneLocal(alreadyDone);
  }, [alreadyDone]);

  const startCamera = async () => {
    setCameraErr('');
    setErr('');
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch {
      setCameraErr(
        'No se pudo abrir la cámara. Usa «Hacer / elegir foto» (recomendado en el móvil).'
      );
      setCameraOn(false);
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setErr('Espera a que la cámara esté lista.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (b) => {
        if (!b) {
          setErr('No se pudo capturar la imagen.');
          return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(b);
        setPreviewUrl(url);
        setBlob(b);
        stopCamera();
      },
      'image/jpeg',
      0.88
    );
  };

  const onFilePicked = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Selecciona una imagen (JPG/PNG).');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setBlob(file);
    setErr('');
    stopCamera();
  };

  const upload = async () => {
    if (!blob) {
      setErr('Haz la foto antes de continuar.');
      return;
    }
    if (!aceptaUso) {
      setErr('Debes aceptar el uso de la imagen para verificación de identidad.');
      return;
    }
    setUploading(true);
    setErr('');
    try {
      const form = new FormData();
      form.append('foto', blob, `identidad-${Date.now()}.jpg`);
      form.append('acepta_uso_verificacion', 'true');
      const res = await fetch(`/firmar/${encodeURIComponent(token)}/identidad`, {
        method: 'POST',
        body: form
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo subir la foto');
      setDoneLocal(true);
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error subiendo la foto');
    } finally {
      setUploading(false);
    }
  };

  if (doneLocal) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Foto de identidad recibida y guardada para verificación. Puedes continuar con el DNI y el SMS.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <h4 className="text-sm font-black text-zinc-900">Verificación visual de identidad</h4>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Haz una <b>selfie</b> mostrando tu <b>DNI/NIE delante de la cara</b> (documento legible).
          Es obligatorio antes del código SMS.
        </p>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-950">
        <b>Información sobre esta imagen:</b> se solicita únicamente para{' '}
        <b>verificar tu identidad</b> en este proceso de firma electrónica. Al enviarla, la imagen{' '}
        <b>se guarda de forma segura</b> en nuestros sistemas (base de datos y almacenamiento de archivos)
        como evidencia del expediente de firma, junto con la fecha y datos del envío. No se usa para otros fines.
      </div>

      {cameraErr ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {cameraErr}
        </div>
      ) : null}
      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{err}</div>
      ) : null}

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Vista previa identidad"
          className="mx-auto max-h-64 w-full rounded-xl border border-zinc-200 object-contain bg-black"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`mx-auto max-h-64 w-full object-cover ${cameraOn ? 'block' : 'hidden'}`}
          />
          {!cameraOn ? (
            <div className="flex h-40 items-center justify-center px-4 text-center text-xs text-zinc-300">
              Abre la cámara o elige una foto con el DNI delante de tu cara.
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {!previewUrl ? (
          <>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-900"
            >
              {cameraOn ? 'Reiniciar cámara' : 'Abrir cámara'}
            </button>
            {cameraOn ? (
              <button
                type="button"
                onClick={captureFromVideo}
                className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-black text-white"
              >
                Capturar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-black text-white"
              >
                Hacer / elegir foto
              </button>
            )}
          </>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-800 sm:col-span-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                checked={aceptaUso}
                onChange={(e) => setAceptaUso(e.target.checked)}
              />
              <span>
                Entiendo que esta imagen es para <b>verificación de identidad</b> y que, al enviarla,{' '}
                <b>se guardará en la base de datos</b> / sistemas de la empresa como evidencia del proceso de firma.
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                setBlob(null);
                setAceptaUso(false);
              }}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-900"
            >
              Repetir
            </button>
            <button
              type="button"
              onClick={() => void upload()}
              disabled={uploading || !aceptaUso}
              className="rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {uploading ? 'Enviando…' : 'Enviar foto y continuar'}
            </button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => onFilePicked(e.target.files?.[0] || null)}
      />
    </div>
  );
}
