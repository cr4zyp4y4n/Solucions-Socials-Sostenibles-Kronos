'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFirmaDocumentoLabel } from '@/lib/firmaDocumentos';
import { getFirmaDocMeta, getReadStatementNo } from '@/lib/firmaDocumentosMeta';
import FirmaFlowClient from './FirmaFlowClient';
import FirmaOnboardingModal from './FirmaOnboardingModal';

export type PackDocumento = {
  id: string;
  tipo_documento: string;
  file_name: string | null;
  revisado_at: string | null;
  firmado_at: string | null;
  opciones_aceptacion?: {
    respuesta?: 'si' | 'no';
    lectura_confirmada?: boolean;
    formacion_acoso?: boolean;
  } | null;
};

function respuestaFromOpciones(op?: PackDocumento['opciones_aceptacion']): 'si' | 'no' | null {
  if (!op) return null;
  if (op.respuesta === 'si' || op.respuesta === 'no') return op.respuesta;
  if (op.lectura_confirmada === true) return 'si';
  if (op.lectura_confirmada === false) return 'no';
  return null;
}

type Props = {
  token: string;
  documentos: PackDocumento[];
  isPack: boolean;
  canAttempt: boolean;
  isUsed: boolean;
  isRevoked: boolean;
  isExpired: boolean;
  requiereConfirmacionDni?: boolean;
  identidadFotoOk?: boolean;
};

function DocumentoDetalle({
  token,
  doc,
  respuesta,
  formacionAcosoChecked,
  confirmErr,
  confirming,
  alreadyDone,
  respuestaGuardada,
  onRespuestaChange,
  onFormacionChange,
  onConfirmar
}: {
  token: string;
  doc: PackDocumento;
  respuesta: 'si' | 'no' | '';
  formacionAcosoChecked: boolean;
  confirmErr: string;
  confirming: boolean;
  alreadyDone: boolean;
  respuestaGuardada: 'si' | 'no' | null;
  onRespuestaChange: (value: 'si' | 'no') => void;
  onFormacionChange: (checked: boolean) => void;
  onConfirmar: () => void;
}) {
  const meta = getFirmaDocMeta(doc.tipo_documento);
  const pdfUrl = `/firmar/${encodeURIComponent(token)}/pdf?doc=${encodeURIComponent(doc.id)}`;

  return (
    <div className="space-y-3 border-t border-zinc-200 px-3 pb-3 pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="break-words text-xs text-zinc-500">{doc.file_name || 'PDF'}</p>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-800 sm:w-auto"
        >
          Abrir en pestaña
        </a>
      </div>

      <object
        data={pdfUrl}
        type="application/pdf"
        className="h-[50vh] min-w-0 w-full rounded-xl border border-zinc-200 bg-white"
      >
        <iframe
          src={pdfUrl}
          title={doc.file_name || 'Documento'}
          className="h-[50vh] min-w-0 w-full rounded-xl border"
        />
      </object>

      {!alreadyDone && meta ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-bold text-zinc-800">Tras leer el documento, indica tu respuesta:</p>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
              respuesta === 'si' ? 'border-emerald-600 bg-emerald-50' : 'border-zinc-200 bg-white'
            }`}
          >
            <input
              type="radio"
              name={`respuesta-${doc.id}`}
              className="mt-1 h-4 w-4 shrink-0"
              checked={respuesta === 'si'}
              onChange={() => onRespuestaChange('si')}
            />
            <span className="min-w-0">
              <span className="font-black text-emerald-800">Sí — </span>
              {meta.readStatement}
            </span>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
              respuesta === 'no' ? 'border-amber-600 bg-amber-50' : 'border-zinc-200 bg-white'
            }`}
          >
            <input
              type="radio"
              name={`respuesta-${doc.id}`}
              className="mt-1 h-4 w-4 shrink-0"
              checked={respuesta === 'no'}
              onChange={() => onRespuestaChange('no')}
            />
            <span className="min-w-0">
              <span className="font-black text-amber-900">No — </span>
              {getReadStatementNo(doc.tipo_documento)}
            </span>
          </label>

          {meta.optionalFormacionAcoso && respuesta === 'si' ? (
            <label className="flex cursor-pointer items-start gap-3 border-t border-zinc-200 pt-3 text-sm text-zinc-800">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0"
                checked={formacionAcosoChecked}
                onChange={(e) => onFormacionChange(e.target.checked)}
              />
              <span className="min-w-0">Solicito mi inscripción en la formación «Prevención del acoso».</span>
            </label>
          ) : null}

          {confirmErr ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {confirmErr}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onConfirmar}
            disabled={confirming}
            className="w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {confirming ? 'Guardando...' : 'Guardar respuesta'}
          </button>
        </div>
      ) : null}

      {alreadyDone ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            respuestaGuardada === 'no'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          Respuesta registrada: <strong>{respuestaGuardada === 'no' ? 'No' : 'Sí'}</strong>
          {doc.tipo_documento === 'acoso' && formacionAcosoChecked
            ? ' · Has solicitado la formación en prevención del acoso.'
            : ''}
        </div>
      ) : null}
    </div>
  );
}

export default function FirmaPackPortal({
  token,
  documentos,
  isPack,
  canAttempt,
  isUsed,
  isRevoked,
  isExpired,
  requiereConfirmacionDni = false,
  identidadFotoOk = false
}: Props) {
  // null = ningún documento expandido (tras guardar se cierra)
  const [expandedId, setExpandedId] = useState<string | null>(
    isPack ? null : documentos[0]?.id || null
  );
  const [revisados, setRevisados] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of documentos) {
      init[d.id] = !!d.revisado_at || !!d.firmado_at;
    }
    return init;
  });
  const [respuestaByDoc, setRespuestaByDoc] = useState<Record<string, 'si' | 'no' | ''>>({});
  const [respuestaGuardada, setRespuestaGuardada] = useState<Record<string, 'si' | 'no'>>(() => {
    const init: Record<string, 'si' | 'no'> = {};
    for (const d of documentos) {
      const r = respuestaFromOpciones(d.opciones_aceptacion);
      if (r) init[d.id] = r;
    }
    return init;
  });
  const [formacionAcoso, setFormacionAcoso] = useState<Record<string, boolean>>({});
  const [confirmErr, setConfirmErr] = useState('');
  const [confirming, setConfirming] = useState(false);
  const portalEligible = canAttempt && !isExpired && !isRevoked && !isUsed;
  const [showOnboarding, setShowOnboarding] = useState(portalEligible);
  const portalOpenedRef = useRef(false);

  const auditOnboarding = useCallback(
    async (payload: {
      evento: 'modal_mostrado' | 'eleccion_primera_vez' | 'rechazado_inicio' | 'guia_abandonada' | 'paso_siguiente' | 'completado';
      paso?: number;
      totalPasos?: number;
    }) => {
      try {
        await fetch(`/firmar/${encodeURIComponent(token)}/onboarding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, isPack })
        });
      } catch {
        // No bloquear la UX si falla la auditoría
      }
    },
    [isPack, token]
  );

  useEffect(() => {
    if (!portalEligible || portalOpenedRef.current) return;
    portalOpenedRef.current = true;

    void fetch(`/firmar/${encodeURIComponent(token)}/open`, {
      method: 'POST',
      cache: 'no-store'
    }).catch(() => {});

    void auditOnboarding({ evento: 'modal_mostrado' });
  }, [auditOnboarding, portalEligible, token]);

  const confirmarLectura = useCallback(
    async (doc: PackDocumento) => {
      const respuesta = respuestaByDoc[doc.id];
      if (respuesta !== 'si' && respuesta !== 'no') {
        setConfirmErr('Selecciona Sí o No antes de continuar.');
        return;
      }
      setConfirmErr('');
      setConfirming(true);
      try {
        const res = await fetch(`/firmar/${encodeURIComponent(token)}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentoId: doc.id,
            confirmacion: {
              respuesta,
              lectura_confirmada: respuesta === 'si',
              ...(doc.tipo_documento === 'acoso' && respuesta === 'si' && formacionAcoso[doc.id]
                ? { formacion_acoso: true }
                : {})
            }
          })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) {
          throw new Error(json.error || 'No se pudo registrar la respuesta');
        }
        const guardada = (json.opciones?.respuesta === 'si' || json.opciones?.respuesta === 'no'
          ? json.opciones.respuesta
          : respuesta) as 'si' | 'no';
        setRespuestaGuardada((prev) => ({ ...prev, [doc.id]: guardada }));
        setRevisados((prev) => ({ ...prev, [doc.id]: true }));
        // Tras guardar, cerrar el detalle bajo la tarjeta
        setExpandedId(null);
        setConfirmErr('');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error confirmando respuesta';
        setConfirmErr(msg);
      } finally {
        setConfirming(false);
      }
    },
    [formacionAcoso, respuestaByDoc, token]
  );

  const allReviewed = useMemo(
    () => documentos.every((d) => revisados[d.id] || d.revisado_at || d.firmado_at),
    [documentos, revisados]
  );

  const reviewedCount = documentos.filter((d) => revisados[d.id] || d.revisado_at || d.firmado_at).length;

  const toggleDoc = (docId: string) => {
    setConfirmErr('');
    setExpandedId((prev) => (prev === docId ? null : docId));
  };

  return (
    <>
      {showOnboarding ? (
        <FirmaOnboardingModal
          isPack={isPack}
          onAudit={(payload) => void auditOnboarding(payload)}
          onClose={() => setShowOnboarding(false)}
        />
      ) : null}

      <div
        className={`mx-auto grid min-w-0 max-w-2xl gap-6 ${
          showOnboarding ? 'pointer-events-none select-none opacity-40' : ''
        }`}
        aria-hidden={showOnboarding}
      >
        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-lg font-black">
            {isPack ? 'Documentos del pack' : 'Documento'}
          </h2>
          <p className="mb-4 text-xs text-zinc-500">
            {isPack
              ? `Pulsa cada documento para abrirlo debajo. Indica Sí o No (${reviewedCount}/${documentos.length}) y guarda; se cerrará solo.`
              : 'Revisa el documento, indica Sí o No y guarda la respuesta.'}
          </p>

          <ul className="space-y-2">
            {documentos.map((doc, idx) => {
              const done = revisados[doc.id] || !!doc.revisado_at || !!doc.firmado_at;
              const respuesta =
                respuestaGuardada[doc.id] || respuestaFromOpciones(doc.opciones_aceptacion);
              const expanded = expandedId === doc.id;

              return (
                <li
                  key={doc.id}
                  className={`overflow-hidden rounded-xl border transition ${
                    expanded
                      ? 'border-emerald-600 bg-emerald-50/40'
                      : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleDoc(doc.id)}
                    className="w-full px-3 py-3 text-left text-sm"
                    aria-expanded={expanded}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-black text-zinc-900">
                          {idx + 1}. {getFirmaDocumentoLabel(doc.tipo_documento)}
                        </div>
                        <div className="mt-1 truncate text-xs text-zinc-500">
                          {expanded ? 'Pulsa para cerrar' : doc.file_name || 'Pulsa para abrir'}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {done ? (respuesta === 'no' ? 'No' : respuesta === 'si' ? 'Sí' : 'OK') : 'Pendiente'}
                      </span>
                    </div>
                  </button>

                  {expanded ? (
                    <DocumentoDetalle
                      token={token}
                      doc={doc}
                      respuesta={respuestaByDoc[doc.id] || ''}
                      formacionAcosoChecked={!!formacionAcoso[doc.id]}
                      confirmErr={confirmErr}
                      confirming={confirming}
                      alreadyDone={done}
                      respuestaGuardada={
                        respuestaGuardada[doc.id] ||
                        respuestaFromOpciones(doc.opciones_aceptacion)
                      }
                      onRespuestaChange={(value) =>
                        setRespuestaByDoc((prev) => ({ ...prev, [doc.id]: value }))
                      }
                      onFormacionChange={(checked) =>
                        setFormacionAcoso((prev) => ({ ...prev, [doc.id]: checked }))
                      }
                      onConfirmar={() => void confirmarLectura(doc)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-zinc-500">
            Verificación y firma
          </h3>
          {!allReviewed ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Indica Sí o No en todos los documentos antes de solicitar el código SMS.
            </div>
          ) : null}
          <FirmaFlowClient
            token={token}
            canAttempt={canAttempt && allReviewed}
            isExpired={isExpired}
            isRevoked={isRevoked}
            isUsed={isUsed}
            requiereConfirmacionDni={requiereConfirmacionDni}
            identidadFotoOk={identidadFotoOk}
            acceptLabel={isPack ? 'Acepto y firmo todos los documentos' : 'Acepto y firmo'}
            blockedHint={
              !allReviewed
                ? isPack
                  ? `Faltan ${documentos.length - reviewedCount} documento(s) por responder (Sí o No).`
                  : 'Indica Sí o No en el documento de arriba.'
                : ''
            }
          />
        </section>
      </div>
    </>
  );
}
