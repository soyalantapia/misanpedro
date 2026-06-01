import { Sparkles, Heart, BadgeCheck, Lock } from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'

const RAZONES = [
  { icon: Sparkles, title: 'Gratis, siempre', body: 'No pagás nada por usar la app. El que ahorra sos vos.' },
  { icon: Heart, title: 'De acá', body: 'Comercios de San Pedro de verdad, los que ya conocés.' },
  {
    icon: BadgeCheck,
    title: 'Sin vueltas',
    body: 'Sin tarjeta, sin puntos, sin letra chica. Mostrás el código y listo.',
  },
  {
    icon: Lock,
    title: 'Sin registrarte',
    body: 'Entrás y mirás los descuentos al toque. Solo dejás tus datos cuando canjeás.',
  },
] as const

export function PorQue() {
  return (
    <section className="bg-neutral-50/70 px-5 py-20 sm:px-6 sm:py-28">
      <AnimatedSection className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-accent-700">Por qué Mi San Pedro</span>
        <h2 className="mt-4 text-balance text-[clamp(2rem,5vw,3.2rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
          Ahorrar, fácil y sin trampa
        </h2>
      </AnimatedSection>

      <div className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {RAZONES.map((r, i) => (
          <AnimatedSection
            key={r.title}
            delay={80 + i * 90}
            className="group rounded-3xl bg-white p-6 ring-1 ring-neutral-200 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:ring-accent-200"
          >
            <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-lg shadow-accent-500/25 transition-transform duration-300 group-hover:scale-110">
              <r.icon size={20} />
            </span>
            <h3 className="mt-5 font-bold text-neutral-900">{r.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{r.body}</p>
          </AnimatedSection>
        ))}
      </div>
    </section>
  )
}
