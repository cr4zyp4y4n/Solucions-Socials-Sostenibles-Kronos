export default function NotFound() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900">
      <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
          Portal de Firma
        </div>
        <h1 className="mb-3 text-3xl font-black">Enlace no válido</h1>
        <p className="text-zinc-600">
          El enlace que has abierto no existe o ya no está disponible. Si lo necesitas, contacta con la empresa
          para que te envíen uno nuevo.
        </p>
      </div>
    </main>
  );
}
