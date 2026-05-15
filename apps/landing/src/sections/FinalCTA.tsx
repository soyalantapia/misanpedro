import { ArrowRight, MessageCircle } from 'lucide-react'
import { SIGNUP_URL, WHATSAPP_URL } from '@/lib/cn'

export function FinalCTA() {
  return (
    <section className="px-6 pb-24 pt-12 sm:pb-32">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent-500 via-accent-600 to-accent-800 p-10 text-center text-white shadow-2xl shadow-accent-500/20 sm:p-16">
        {/* Decorative grain + orbs */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-10 h-48 w-48 rounded-full bg-accent-300/30 blur-2xl" />

        <div className="relative">
          <h2 className="text-balance text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.05] tracking-tight">
            Tu primer canje en menos de 10 minutos.
          </h2>

          <p className="mt-5 text-pretty text-lg leading-relaxed text-white/85">
            Precio fundador para los primeros 20 comercios. 14 días gratis. Sin tarjeta.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <a
              href={SIGNUP_URL}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-bold text-neutral-900 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-neutral-50"
            >
              Empezar gratis 14 días
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
            >
              <MessageCircle size={16} />
              O ver una demo de 15 min por WhatsApp →
            </a>
          </div>

          <p className="mt-8 text-xs text-white/60">
            Sin tarjeta · Cancelás cuando quieras · Soporte por WhatsApp
          </p>
        </div>
      </div>
    </section>
  )
}
