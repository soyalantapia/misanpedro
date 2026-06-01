import { AnimatedSection } from '@/components/AnimatedSection'

const CATS = [
  'Verdulería',
  'Carnicería',
  'Almacén',
  'Panadería',
  'Fiambrería',
  'Farmacia',
  'Kiosco',
  'Rotisería',
  'Pollería',
  'Fruta',
  'Dietética',
  'Librería',
] as const

function Chip({ label }: { label: string }) {
  return (
    <span className="whitespace-nowrap rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-200">
      {label}
    </span>
  )
}

export function Categorias() {
  return (
    <section className="overflow-hidden py-16 sm:py-20">
      <AnimatedSection className="mx-auto max-w-2xl px-5 text-center sm:px-6">
        <span className="text-xs font-bold uppercase tracking-widest text-accent-700">Qué vas a encontrar</span>
        <h2 className="mt-4 text-balance text-[clamp(1.8rem,5vw,3rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
          Descuentos en lo de todas las semanas
        </h2>
      </AnimatedSection>

      <div className="relative mt-10 flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="marquee flex shrink-0 items-center gap-3 pr-3">
          {CATS.map((c) => (
            <Chip key={'a' + c} label={c} />
          ))}
        </div>
        <div className="marquee flex shrink-0 items-center gap-3 pr-3" aria-hidden>
          {CATS.map((c) => (
            <Chip key={'b' + c} label={c} />
          ))}
        </div>
      </div>
    </section>
  )
}
