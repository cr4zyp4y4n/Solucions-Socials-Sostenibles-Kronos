import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import FirmaFlowClient from './FirmaFlowClient';

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

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('firma_tokens')
    .select(`
      id,
      token,
      expires_at,
      used_at,
      revoked_at,
      documento:firma_documentos!firma_tokens_documento_id_fkey (
        id,
        tipo_documento,
        estado,
        fecha_inicio,
        fecha_fin,
        storage_path,
        file_name,
        firmado_at,
        trabajador:firma_trabajadores!firma_documentos_trabajador_id_fkey (
          id,
          nombre,
          dni,
          telefono
        )
      )
    `)
    .eq('token', token)
    .maybeSingle();

  if (tokenError) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="mb-3 text-3xl font-black text-red-700">Error cargando la firma</h1>
          <p className="text-zinc-600">{tokenError.message}</p>
        </div>
      </main>
    );
  }

  if (!tokenRow) {
    notFound();
  }

  const expiresAt = new Date(tokenRow.expires_at);
  const isExpired = Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now();
  const isRevoked = !!tokenRow.revoked_at;
  const isUsed = !!tokenRow.used_at;
  const documento = Array.isArray(tokenRow.documento) ? tokenRow.documento[0] : tokenRow.documento;
  const trabajador = documento && Array.isArray(documento.trabajador) ? documento.trabajador[0] : documento?.trabajador;

  if (!documento) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="mb-3 text-3xl font-black">Documento no encontrado</h1>
          <p className="text-zinc-600">El token existe, pero no está asociado correctamente a ningún documento.</p>
        </div>
      </main>
    );
  }

  let signedUrl = '';
  // Renderizamos el PDF vía misma-origin para evitar CSP bloqueando iframes/object
  if (documento.storage_path && !isExpired && !isRevoked) {
    signedUrl = `/firmar/${encodeURIComponent(token)}/pdf`;
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Portal de Firma</div>
          <h1 className="mb-3 text-3xl font-black tracking-tight">Revisión del documento</h1>
          <p className="text-zinc-600">
            Esta es la primera versión del portal. Ahora mismo valida el enlace y muestra el documento correcto.
            El siguiente paso será añadir la verificación OTP.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
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
              <div>
                <dt className="font-bold text-zinc-500">Tipo documento</dt>
                <dd className="text-zinc-900">{documento.tipo_documento}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">Estado</dt>
                <dd className="text-zinc-900">{documento.estado}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">Fecha inicio</dt>
                <dd className="text-zinc-900">{documento.fecha_inicio || '—'}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">Fecha fin</dt>
                <dd className="text-zinc-900">{documento.fecha_fin || '—'}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">Caduca el</dt>
                <dd className="text-zinc-900">{formatDate(tokenRow.expires_at)}</dd>
              </div>
              <div>
                <dt className="font-bold text-zinc-500">Firmado el</dt>
                <dd className="text-zinc-900">{formatDate(documento.firmado_at)}</dd>
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
                  Este enlace ya ha sido utilizado.
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              <h3 className="mb-2 text-sm font-black uppercase tracking-[0.2em] text-zinc-500">
                Verificación y firma
              </h3>
              <FirmaFlowClient
                token={token}
                canAttempt={!!documento.storage_path}
                isExpired={isExpired}
                isRevoked={isRevoked}
                isUsed={isUsed}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Documento</h2>
              {signedUrl ? (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800"
                >
                  Abrir en nueva pestaña
                </a>
              ) : null}
            </div>

            {signedUrl ? (
              <div className="space-y-3">
                <object
                  data={signedUrl}
                  type="application/pdf"
                  className="h-[75vh] w-full rounded-xl border border-zinc-200 bg-white"
                >
                  <iframe
                    src={signedUrl}
                    title={documento.file_name || 'Documento de firma'}
                    className="h-[75vh] w-full rounded-xl border border-zinc-200"
                  />
                </object>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  Si el visor aparece en blanco, abre el PDF en una pestaña nueva o descárgalo desde el botón superior.
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-600">
                No se ha podido generar la vista previa del PDF. El enlace puede estar caducado o revocado.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
