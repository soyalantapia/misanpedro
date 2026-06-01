import { ArrowRight, Heart } from 'lucide-react'
import { ENTER_URL } from '@/lib/cn'
import { AnimatedSection } from '@/components/AnimatedSection'

export function Comercios() {
  return (
    <section id="comercios" className="px-5 py-20 sm:px-6 sm:py-28">
      <AnimatedSection className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-accent-700">
          <Heart size={12} /> De acá
        </span>
        <h2 className="mt-4 text-balance text-[clamp(2rem,5vw,3.2rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
          Cada semana se suman más comercios de San Pedro
        </h2>
        <p className="mt-6 text-pretty text-lg leading-relaxed text-neutral-600">
          Los comercios que ya conocés, con descuentos para vos. Entrá a la app y mirá los que tenés cerca, hoy.
        </p>
        <a
          href={ENTER_URL}
          className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-accent-500/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-accent-500/50"
        >
          Ver los descuentos cerca tuyo
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </a>
      </AnimatedSection>
    </section>
  )
}
