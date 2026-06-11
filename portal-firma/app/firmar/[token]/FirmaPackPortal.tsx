'use client';

import { useCallback, useMemo, useState } from 'react';
import { getFirmaDocumentoLabel } from '@/lib/firmaDocumentos';
import { getFirmaDocMeta } from '@/lib/firmaDocumentosMeta';
import FirmaFlowClient from './FirmaFlowClient';

export type PackDocumento = {
  id: string;
  tipo_documento: string;
  file_name: string | null;
  revisado_at: string | null;
  firmado_at: string | null;
};

type Props = {
  token: string;
  documentos: PackDocumento[];
  isPack: boolean;
  canAttempt: boolean;
  isUsed: boolean;
  isRevoked: boolean;
  isExpired: boolean;
};

export default function FirmaPackPortal({
  token,
  documentos,
  isPack,
  canAttempt,
  isUsed,
  isRevoked,
  isExpired
}: Props) {
  const [activeId, setActiveId] = useState(documentos[0]?.id || '');
  const [revisados, setRevisados] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of documentos) {
      init[d.id] = !!d.revisado_at || !!d.firmado_at;
    }
    return init;
  });
  const [readChecked, setReadChecked] = useState<Record<string, boolean>>({});
  const [formacionAcoso, setFormacionAcoso] = useState<Record<string, boolean>>({});
  const [confirmErr, setConfirmErr] = useState('');
  const [confirming, setConfirming] = useState(false);

  const activeDoc = useMemo(
    () => documentos.find((d) => d.id === activeId) || documentos[0] || null,
    [documentos, activeId]
  );

  const activeMeta = useMemo(
    () => (activeDoc ? getFirmaDocMeta(activeDoc.tipo_documento) : null),
    [activeDoc]
  );

  const pdfUrl = activeDoc
    ? `/firmar/${encodeURIComponent(token)}/pdf?doc=${encodeURIComponent(activeDoc.id)}`
    : '';

  const confirmarLectura = useCallback(async () => {
    if (!activeDoc?.id) return;
    if (!readChecked[activeDoc.id]) {
      setConfirmErr('Marca la casilla de confirmación antes de continuar.');
      return;
    }
    setConfirmErr('');
    setConfirming(true);
    try {
      const res = await fetch(`/firmar/${encodeURIComponent(token)}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentoId: activeDoc.id,
          confirmacion: {
            lectura_confirmada: true,
            ...(activeDoc.tipo_documento === 'acoso' && formacionAcoso[activeDoc.id]
              ? { formacion_acoso: true }
              : {})
          }
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'No se pudo registrar la confirmación');
      }
      setRevisados((prev) => ({ ...prev, [activeDoc.id]: true }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error confirmando lectura';
      setConfirmErr(msg);
    } finally {
      setConfirming(false);
    }
  }, [activeDoc, formacionAcoso, readChecked, token]);

  const allReviewed = useMemo(
    () => documentos.every((d) => revisados[d.id] || d.revisado_at || d.firmado_at),
    [documentos, revisados]
  );

  const reviewedCount = documentos.filter((d) => revisados[d.id] || d.revisado_at || d.firmado_at).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
      {isPack ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-lg font-black">Documentos del pack</h2>
          <p className="mb-4 text-xs text-zinc-500">
            Confirma la lectura de cada documento ({reviewedCount}/{documentos.length}). Después podrás firmar
            todos de una vez.
          </p>
          <ul className="space-y-2">
            {documentos.map((doc, idx) => {
              const done = revisados[doc.id] || !!doc.revisado_at || !!doc.firmado_at;
              const active = doc.id === activeDoc?.id;
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(doc.id);
                      setConfirmErr('');
                    }}
                    className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                      active
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black text-zinc-900">
                          {idx + 1}. {getFirmaDocumentoLabel(doc.tipo_documento)}
                        </div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{doc.file_name || 'PDF'}</div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {done ? 'Confirmado' : 'Pendiente'}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">
                {activeDoc ? getFirmaDocumentoLabel(activeDoc.tipo_documento) : 'Documento'}
              </h2>
              <p className="text-sm text-zinc-500">{activeDoc?.file_name || ''}</p>
            </div>
            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                Abrir en pestaña
              </a>
            ) : null}
          </div>

          {pdfUrl ? (
            <object
              data={pdfUrl}
              type="application/pdf"
              className="h-[55vh] w-full rounded-xl border border-zinc-200 bg-white"
            >
              <iframe src={pdfUrl} title={activeDoc?.file_name || 'Documento'} className="h-[55vh] w-full rounded-xl border" />
            </object>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-600">
              No se ha podido cargar el PDF.
            </div>
          )}

          {activeDoc && activeMeta && !(revisados[activeDoc.id] || activeDoc.revisado_at) ? (
            <div className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0"
                  checked={!!readChecked[activeDoc.id]}
                  onChange={(e) =>
                    setReadChecked((prev) => ({ ...prev, [activeDoc.id]: e.target.checked }))
                  }
                />
                <span>{activeMeta.readStatement}</span>
              </label>

              {activeMeta.optionalFormacionAcoso ? (
                <label className="flex cursor-pointer items-start gap-3 border-t border-zinc-200 pt-3 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={!!formacionAcoso[activeDoc.id]}
                    onChange={(e) =>
                      setFormacionAcoso((prev) => ({ ...prev, [activeDoc.id]: e.target.checked }))
                    }
                  />
                  <span>Solicito mi inscripción en la formación «Prevención del acoso».</span>
                </label>
              ) : null}

              {confirmErr ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {confirmErr}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void confirmarLectura()}
                disabled={confirming}
                className="w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {confirming ? 'Guardando...' : 'Confirmar lectura de este documento'}
              </button>
            </div>
          ) : null}

          {activeDoc && (revisados[activeDoc.id] || activeDoc.revisado_at) ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Lectura confirmada para este documento.
              {activeDoc.tipo_documento === 'acoso' && formacionAcoso[activeDoc.id]
                ? ' Has solicitado la formación en prevención del acoso.'
                : ''}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-zinc-500">
            Verificación y firma
          </h3>
          {!allReviewed ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Confirma la lectura de todos los documentos antes de solicitar el código SMS.
            </div>
          ) : null}
          <FirmaFlowClient
            token={token}
            canAttempt={canAttempt && allReviewed}
            isExpired={isExpired}
            isRevoked={isRevoked}
            isUsed={isUsed}
            acceptLabel={isPack ? 'Acepto y firmo todos los documentos' : 'Acepto y firmo'}
            blockedHint={
              !allReviewed
                ? isPack
                  ? `Faltan ${documentos.length - reviewedCount} documento(s) por confirmar.`
                  : 'Confirma la lectura del documento arriba.'
                : ''
            }
          />
        </div>
      </section>
    </div>
  );
}
