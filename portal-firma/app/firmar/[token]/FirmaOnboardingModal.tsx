'use client';

import { useMemo, useState } from 'react';

type Props = {
  isPack: boolean;
  onAudit: (payload: {
    evento: 'eleccion_primera_vez' | 'rechazado_inicio' | 'guia_abandonada' | 'paso_siguiente' | 'completado';
    paso?: number;
    totalPasos?: number;
  }) => void;
  onClose: () => void;
};

export default function FirmaOnboardingModal({ isPack, onAudit, onClose }: Props) {
  const [phase, setPhase] = useState<'choice' | 'steps'>('choice');
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(
    () => [
      {
        title: '1. Revisa el documento',
        body: isPack
          ? 'Verás una lista de documentos. Abre cada uno, léelo con calma y responde Sí o No según corresponda.'
          : 'Lee el documento en pantalla con calma. Cuando lo hayas revisado, indica tu respuesta Sí o No.'
      },
      {
        title: '2. Confirma cada respuesta',
        body: isPack
          ? 'Debes guardar la respuesta de todos los documentos del pack antes de continuar con la firma.'
          : 'Pulsa «Guardar respuesta» para registrar tu lectura antes de seguir.'
      },
      {
        title: '3. Verificación por SMS',
        body: 'Te pediremos un código por SMS al teléfono de la empresa. Si se solicita, también confirmarás tu DNI o NIE.'
      },
      {
        title: '4. Firma electrónica',
        body: isPack
          ? 'Cuando el código sea correcto, podrás firmar todos los documentos del pack de una sola vez.'
          : 'Cuando el código sea correcto, podrás aceptar y firmar el documento.'
      }
    ],
    [isPack]
  );

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1;

  const handleFirstTime = () => {
    onAudit({ evento: 'eleccion_primera_vez', totalPasos: steps.length });
    setPhase('steps');
    setStepIndex(0);
  };

  const handleRejectAtStart = () => {
    onAudit({ evento: 'rechazado_inicio' });
    onClose();
  };

  const handleAbandonGuide = () => {
    onAudit({
      evento: 'guia_abandonada',
      paso: stepIndex + 1,
      totalPasos: steps.length
    });
    onClose();
  };

  const handleNext = () => {
    if (isLastStep) {
      onAudit({ evento: 'completado', paso: stepIndex + 1, totalPasos: steps.length });
      onClose();
      return;
    }
    const next = stepIndex + 1;
    onAudit({ evento: 'paso_siguiente', paso: next + 1, totalPasos: steps.length });
    setStepIndex(next);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/55 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="firma-onboarding-title"
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
      >
        {phase === 'choice' ? (
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                Novedad en el portal
              </div>
              <h2 id="firma-onboarding-title" className="text-2xl font-black text-zinc-900">
                ¿Es la primera vez que firmas aquí?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                Hemos mejorado el portal para que sepas qué verás en cada paso antes de empezar. Si ya conoces
                el proceso, puedes ir directamente a firmar.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              En resumen: revisar documento{isPack ? 's' : ''} → responder Sí/No → código SMS → firma.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleFirstTime}
                className="rounded-full bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                Sí, explícame el proceso
              </button>
              <button
                type="button"
                onClick={handleRejectAtStart}
                className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-900 transition hover:bg-zinc-50"
              >
                No, ir a firmar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                Paso {stepIndex + 1} de {steps.length}
              </div>
              <h2 className="text-2xl font-black text-zinc-900">{currentStep.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">{currentStep.body}</p>
            </div>

            <div className="flex gap-2">
              {steps.map((_, index) => (
                <span
                  key={index}
                  className={`h-2 flex-1 rounded-full ${
                    index <= stepIndex ? 'bg-emerald-600' : 'bg-zinc-200'
                  }`}
                />
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleNext}
                className="rounded-full bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 sm:col-span-2"
              >
                {isLastStep ? 'Entendido, empezar' : 'Siguiente'}
              </button>
              <button
                type="button"
                onClick={handleAbandonGuide}
                className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 sm:col-span-2"
              >
                Saltar explicación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
