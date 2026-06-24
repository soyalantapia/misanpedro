import { ArrowRight, Sparkles } from 'lucide-react'
import { enterUrl } from '@/lib/cn'
import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, cityName } from '@/lib/tenant'

export function FinalCTA() {
  const { config } = useTenant()
  const city = cityName(config)
  return (
    <section className="px-5 pb-24 pt-8 sm:px-6 sm:pb-32">
      <AnimatedSection className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-accent-500 via-accent-600 to-accent-800 px-6 py-16 text-center text-on-brand shadow-2xl shadow-accent-500/30 sm:px-12 sm:py-24">
        <div aria-hidden className="animate-blob pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden className="animate-blob-2 pointer-events-none absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-accent-300/30 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest ring-1 ring-white/25 backdrop-blur">
            <Sparkles size={11} /> Gratis para vecinos
          </span>
          <h2 className="mt-6 text-balance text-[clamp(2.2rem,5.5vw,3.8rem)] font-black leading-[1.02] tracking-tight">
            Tu plata rinde más en {city}.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-white/85">
            Entrá gratis y empezá a ahorrar hoy en los comercios de siempre.
          </p>
          <div className="mt-9 flex justify-center">
            <a
              href={enterUrl(config)}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-accent-700 shadow-xl transition-all hover:-translate-y-0.5 hover:bg-neutral-50"
            >
              Entrá y mirá los descuentos
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>
          <p className="mt-8 text-xs text-white/70">Sin registrarte · Sin tarjeta · Hecho en {city}</p>
        </div>
      </AnimatedSection>
    </section>
  )
}
