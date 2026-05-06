import { Tag, MapPin } from 'lucide-react'

export function DescuentosPage() {
  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <Tag size={12} /> Descuentos vigentes
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Descubrí descuentos en San&nbsp;Pedro
        </h1>
        <p className="text-base text-neutral-500">
          Comercios adheridos al programa Mi San Pedro. Activá el cupón y mostralo en el local.
        </p>
      </div>

      <div className="animate-fade-in mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-card">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-100 text-neutral-500">
          <MapPin size={26} />
        </div>
        <div>
          <h3 className="text-base font-bold text-neutral-900">Próximamente</h3>
          <p className="mt-1 text-sm text-neutral-500">
            En la Fase 1 vas a ver el listado de descuentos con vista por descuento o por local,
            filtros por categoría y distancia desde tu ubicación.
          </p>
        </div>
      </div>
    </div>
  )
}
