export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
          Portal de Firma
        </div>
        <h1 className="mb-4 text-4xl font-black tracking-tight">Portal de firma de documentos</h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-600">
          Este portal se usa para abrir enlaces únicos de firma enviados a trabajadores. Si has recibido un SMS,
          abre el enlace completo que aparece en el mensaje.
        </p>
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white px-6 py-5 text-left text-sm text-zinc-600 shadow-sm">
          <div className="mb-2 font-bold text-zinc-900">Próximo paso</div>
          <div>
            La primera versión valida el token y muestra el PDF del documento. Después añadiremos el flujo OTP.
          </div>
        </div>
      </div>
    </main>
  );
}
