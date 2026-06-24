import { ArrowRight, Heart, Store } from 'lucide-react'
import { ENTER_URL, COMERCIOS_URL } from '@/lib/cn'
import { AnimatedSection } from '@/components/AnimatedSection'

// TODO: cargar comercios reales (nombre + logo opcional) cuando estén confirmados.
// NO inventar nombres: dejar vacío hasta tener data real → cae al copy honesto de abajo.
type Comercio = { nombre: string; logo?: string }
const COMERCIOS: Comercio[] = []

export function Comercios() {
  return (
    <section id="comercios" className="px-5 py-20 sm:px-6 sm:py-28">
      <AnimatedSection className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-accent-700">
          <Heart size={12} /> De acá
        </span>
        <h2 className="mt-4 text-balance text-[clamp(2rem,5vw,3.2rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
          Los comercios de tu barrio, con descuentos nuevos cada semana
        </h2>
        <p className="mt-6 text-pretty text-lg leading-relaxed text-neutral-600">
          Los de siempre, los que ya conocés. Los descuentos cambian todas las semanas: entrá y mirá los de
          esta semana, cerca tuyo.
        </p>

        {COMERCIOS.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {COMERCIOS.map((c) => (
              <span
                key={c.nombre}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-200"
              >
                {c.nombre}
              </span>
            ))}
          </div>
        )}

        {/* TODO: cuando esté confirmado, activar el respaldo institucional (usar cityName(config)):
            <p className="mt-6 text-sm font-medium text-neutral-500">Con el apoyo de la Cámara de Comercio de {city}</p> */}

        {/* Dual CTA: el vecino va a la app; el comercio va a su landing de captación. */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ENTER_URL}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-accent-500/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-accent-500/50"
          >
            Ir a la app
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href={COMERCIOS_URL}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-neutral-800 shadow-sm ring-1 ring-neutral-300 transition-all hover:-translate-y-0.5 hover:ring-neutral-400"
          >
            <Store size={16} /> Soy un comercio
          </a>
        </div>
      </AnimatedSection>
    </section>
  )
}
