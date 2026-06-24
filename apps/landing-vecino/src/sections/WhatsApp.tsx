import { MessageCircle } from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, cityName } from '@/lib/tenant'

// TODO: pegá acá el link del canal/grupo de WhatsApp de la ciudad.
// Mientras esté vacío, la sección NO se muestra (no dejamos un botón muerto en vivo).
const WHATSAPP_URL: string = ''

export function WhatsApp() {
  const { config } = useTenant()
  const city = cityName(config)
  if (!WHATSAPP_URL) return null

  return (
    <section id="whatsapp" className="px-5 py-20 sm:px-6 sm:py-24">
      <AnimatedSection className="relative mx-auto max-w-3xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-accent-50 to-white px-6 py-12 text-center ring-1 ring-accent-100 sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 right-0 h-52 w-52 rounded-full bg-accent-200/40 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-accent-700">
            <MessageCircle size={12} /> Los descuentos de la semana
          </span>
          <h2 className="mt-4 text-balance text-[clamp(1.8rem,5vw,3rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
            Enterate primero, por WhatsApp
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-neutral-600">
            Cada semana cargamos descuentos nuevos en los comercios de {city}. Sumate y te avisamos los de
            tu barrio — sin spam, solo los descuentos.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-accent-500/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-accent-500/50"
          >
            <MessageCircle size={16} />
            Sumate al WhatsApp
          </a>
          <p className="mt-5 text-xs text-neutral-500">
            Gratis · Sin spam · No compartimos tus datos · Te salís cuando quieras
          </p>
        </div>
      </AnimatedSection>
    </section>
  )
}
