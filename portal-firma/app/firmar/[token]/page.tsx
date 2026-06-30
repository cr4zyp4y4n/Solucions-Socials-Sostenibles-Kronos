import { notFound } from 'next/navigation';
import { getFirmaDocumentoLabel } from '@/lib/firmaDocumentos';
import { registrarVisitaPortal } from '@/lib/firmaPortalTracking';
import { getPortalRequestMeta } from '@/lib/portalRequestMeta';
import { resolveFirmaToken } from '@/lib/resolveFirmaToken';
import FirmaPackPortal from './FirmaPackPortal';

export const dynamic = 'force-dynamic';

type TokenPageProps = {
  params: Promise<{ token: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-ES');
}

export default async function FirmaTokenPage({ params }: TokenPageProps) {
  const { token } = await params;

  let resolved;
  try {
    resolved = await resolveFirmaToken(token);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="mb-3 text-3xl font-black text-red-700">Error cargando la firma</h1>
          <p className="text-zinc-600">{msg}</p>
        </div>
      </main>
    );
  }

  if (!resolved) notFound();

  const { trabajador, documentos, envio, isExpired, isRevoked, isUsed, isPack } = resolved;
  const documentoPrincipal = resolved.documentoPrincipal;

  if (!documentos.length) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="mb-3 text-3xl font-black">Documento no encontrado</h1>
          <p className="text-zinc-600">El token existe, pero no está asociado correctamente a ningún documento.</p>
        </div>
      </main>
    );
  }

  try {
    const meta = await getPortalRequestMeta('ssr_get');
    const track = await registrarVisitaPortal(token, { ...meta, marcaPrimeraVisita: false });
    if (!track.ok) {
      console.warn('[firma portal] visita SSR:', track.error);
    }
  } catch (e) {
    console.warn('[firma portal] visita SSR:', e);
  }

  const titulo = isPack
    ? envio?.nombre || `Pack de contratación (${documentos.length} documentos)`
    : getFirmaDocumentoLabel(documentoPrincipal?.tipo_documento);

  const canAttempt = documentos.some((d) => d.storage_path) && !isExpired && !isRevoked;

  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-6xl min-w-0">
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Portal de Firma</div>
          <h1 className="mb-2 text-3xl font-black tracking-tight">{titulo}</h1>
          <p className="text-zinc-600">
            {isPack
              ? 'Revisa cada documento del pack y, al final, firma todos con una sola verificación.'
              : 'Revisa el documento y completa la verificación para firmar.'}
          </p>
        </div>

        <div className="mb-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-black">Datos del envío</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-bold text-zinc-500">Trabajador</dt>
                <dd className="text-zinc-900">{trabajador?.nombre || '—'}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">DNI</dt>
                <dd className="text-zinc-900">{trabajador?.dni || '—'}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">Teléfono</dt>
                <dd className="text-zinc-900">{trabajador?.telefono || '—'}</dd>
              </div>
              {isPack ? (
                <div>
                  <dt className="font-bold text-zinc-500">Documentos</dt>
                  <dd className="text-zinc-900">{documentos.length}</dd>
                </div>
              ) : (
                <div>
                  <dt className="font-bold text-zinc-500">Tipo documento</dt>
                  <dd className="text-zinc-900">{getFirmaDocumentoLabel(documentoPrincipal?.tipo_documento)}</dd>
                </div>
              )}
              <div>
                <dt className="font-bold text-zinc-500">Estado</dt>
                <dd className="text-zinc-900">{envio?.estado || documentoPrincipal?.estado || '—'}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">Fecha inicio</dt>
                <dd className="text-zinc-900">{envio?.fecha_inicio || '—'}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">Fecha fin</dt>
                <dd className="text-zinc-900">{envio?.fecha_fin || '—'}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">Caduca el</dt>
                <dd className="text-zinc-900">{formatDate(resolved.tokenRow.expires_at)}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">Firmado el</dt>
                <dd className="text-zinc-900">{formatDate(envio?.firmado_at || documentoPrincipal?.firmado_at)}</dd>
              </div>
            </dl>

            <div className="mt-6 space-y-2">
              {isExpired ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Este enlace ha caducado.
                </div>
              ) : null}
              {isRevoked ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  Este enlace ha sido revocado por la empresa.
                </div>
              ) : null}
              {isUsed ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Este enlace ya ha sido utilizado. Todos los documentos han sido firmados.
                </div>
              ) : null}
            </div>
          </section>

          <div className="min-w-0">
            <FirmaPackPortal
              token={token}
              documentos={documentos.map((d) => ({
                id: d.id,
                tipo_documento: d.tipo_documento,
                file_name: d.file_name,
                revisado_at: d.revisado_at,
                firmado_at: d.firmado_at,
                opciones_aceptacion: d.opciones_aceptacion ?? null
              }))}
              isPack={isPack}
              canAttempt={canAttempt}
              isExpired={isExpired}
              isRevoked={isRevoked}
              isUsed={isUsed}
              requiereConfirmacionDni={Boolean(trabajador?.dni?.trim())}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
