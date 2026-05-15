import { Sparkles } from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'

const PIONEROS = [
  { id: 'la-frutilla', name: 'Heladería La Frutilla' },
  { id: 'la-esquina', name: 'La Esquina' },
  { id: 'carmen-vintage', name: 'Carmen Vintage' },
  { id: 'pampero', name: 'Vivero Pampero' },
  { id: 'almendra', name: 'Almendra Belleza' },
  { id: 'estacion-25', name: 'Estación 25' },
] as const

export function SocialProof() {
  return (
    <section className="border-y border-neutral-200/70 bg-neutral-50/60 px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <AnimatedSection className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent-700">
            <Sparkles size={11} />
            Programa fundador · Primeros 20 comercios
          </span>
          <h2 className="text-balance text-base font-semibold leading-snug text-neutral-700 sm:text-lg">
            Precio fundador <strong className="text-neutral-900">$25.000/mes</strong>{' '}
            congelado de por vida
          </h2>
        </AnimatedSection>

        <AnimatedSection
          delay={120}
          className="mt-10 grid grid-cols-2 items-center gap-x-8 gap-y-6 sm:grid-cols-3 md:grid-cols-6"
        >
          {PIONEROS.map((p) => (
            <PioneroLogo key={p.id} name={p.name} />
          ))}
        </AnimatedSection>

        <p className="mt-8 text-center text-xs text-neutral-500">
          Los primeros comercios adheridos al programa. Cargá tu local y sumate.
        </p>
      </div>
    </section>
  )
}

function PioneroLogo({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')

  return (
    <div className="flex flex-col items-center gap-2 opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-sm font-black text-neutral-700 ring-1 ring-neutral-200">
        {initials.toUpperCase()}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {name}
      </span>
    </div>
  )
}
