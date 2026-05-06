import { CheckCircle2 } from 'lucide-react'

export function CanjeadosPage() {
  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <CheckCircle2 size={12} /> Historial
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Canjeados
        </h1>
        <p className="text-base text-neutral-500">
          Tu historial de descuentos usados. Acá vas a ver cuánto ahorraste cada mes.
        </p>
      </div>

      <div className="animate-fade-in mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-card">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-100 text-neutral-500">
          <CheckCircle2 size={26} />
        </div>
        <div>
          <h3 className="text-base font-bold text-neutral-900">Sin canjes todavía</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Cuando uses tu primer descuento en un comercio, va a aparecer acá con la fecha y cuánto
            ahorraste.
          </p>
        </div>
      </div>
    </div>
  )
}
