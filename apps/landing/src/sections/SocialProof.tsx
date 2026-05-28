import { Sparkles, Lock, BadgeCheck, Headphones } from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'

// LA1 (audit v8): reemplazamos los "logos de pioneros" inventados por los
// beneficios reales del programa fundador. No fabricamos clientes — la prueba
// social verdadera la sumamos cuando haya comercios adheridos con su permiso.
const BENEFICIOS = [
  {
    icon: Lock,
    title: 'Precio congelado',
    text: '$25.000/mes de por vida, aunque después suba para nuevos comercios.',
  },
  {
    icon: BadgeCheck,
    title: 'Sin permanencia',
    text: 'Cancelás cuando quieras desde tu panel, sin penalidad.',
  },
  {
    icon: Headphones,
    title: 'Soporte directo',
    text: 'Hablás con nosotros, gente de San Pedro. No con un bot.',
  },
] as const

export function SocialProof() {
  return (
    <section className="border-y border-neutral-200/70 bg-neutral-50/60 px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <AnimatedSection className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent-700">
            <Sparkles size={11} />
            Programa fundador · Primeros 20 comercios de San Pedro
          </span>
          <h2 className="text-balance text-base font-semibold leading-snug text-neutral-700 sm:text-lg">
            Sé de los primeros en sumarte y quedate con el{' '}
            <strong className="text-neutral-900">precio fundador $25.000/mes congelado de por vida</strong>
          </h2>
        </AnimatedSection>

        <AnimatedSection delay={120} className="mt-10 grid gap-4 sm:grid-cols-3">
          {BENEFICIOS.map((b) => (
            <div
              key={b.title}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white p-5 text-center ring-1 ring-neutral-200"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-50 text-accent-700">
                <b.icon size={18} />
              </span>
              <p className="text-sm font-bold text-neutral-900">{b.title}</p>
              <p className="text-xs leading-relaxed text-neutral-500">{b.text}</p>
            </div>
          ))}
        </AnimatedSection>

        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-neutral-500">
            El cupo fundador es para los primeros 20. Después el precio sube para nuevos comercios.
          </p>
          <a
            href="#precios"
            className="inline-flex items-center gap-1 text-xs font-bold text-accent-700 underline-offset-4 transition-colors hover:text-accent-900 hover:underline"
          >
            Ver precio fundador →
          </a>
        </div>
      </div>
    </section>
  )
}
