import { ArrowRight } from 'lucide-react'
import { SIGNUP_URL } from '@/lib/cn'
import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, cityName } from '@/lib/tenant'
import { TOTAL_CUPOS, CUPOS_RESTANTES, MESES_GRATIS } from '@/lib/launch'

export function FinalCTA() {
  const { config } = useTenant()

  return (
    <section className="px-6 pb-20 pt-12 sm:pb-28">
      <AnimatedSection className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent-500 via-accent-600 to-accent-800 p-10 text-center text-white shadow-2xl shadow-accent-500/20 sm:p-16">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-10 h-48 w-48 rounded-full bg-accent-300/30 blur-2xl" />

        <div className="relative">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white ring-1 ring-white/30 backdrop-blur">
            ⏳ Quedan {CUPOS_RESTANTES} de {TOTAL_CUPOS} lugares
          </p>

          <h2 className="mt-6 text-balance text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.05] tracking-tight">
            Llená tus días flojos y quedate con tus clientes. Antes de que cierre el cupo.
          </h2>

          <p className="mt-5 text-pretty text-lg leading-relaxed text-white/85">
            Sumate al programa de lanzamiento: <strong>{MESES_GRATIS} meses gratis</strong> y,
            después, tu precio <strong>congelado de por vida</strong> mientras tu cuenta esté activa.
          </p>

          <div className="mt-9 flex justify-center">
            <a
              href={SIGNUP_URL}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-accent-700 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-neutral-50"
            >
              Empezá gratis
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          <p className="mt-8 text-xs text-white/70">
            3 meses gratis, sin tarjeta · Cancelás cuando quieras · Hecho en {cityName(config)}
          </p>
        </div>
      </AnimatedSection>
    </section>
  )
}
