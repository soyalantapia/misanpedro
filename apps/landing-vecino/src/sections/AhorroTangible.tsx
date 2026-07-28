import { ArrowRight, Check } from 'lucide-react'
import { enterUrl } from '@/lib/cn'
import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, appName } from '@/lib/tenant'

const EJEMPLOS = [
  { c: 'Verdulería', d: '20% off' },
  { c: 'Carnicería', d: '2x1' },
  { c: 'Panadería', d: '25% off' },
  { c: 'Almacén', d: '15% off' },
  { c: 'Farmacia', d: '15% off' },
] as const

const PUNTOS = [
  'En la verdu, la carni, el almacén y la farmacia de todos los días',
  'En lo que comprás todas las semanas',
  'Se suma solo, sin que cambies nada',
] as const

export function AhorroTangible() {
  const { config } = useTenant()
  const brand = appName(config)
  return (
    <section id="ahorro" className="px-5 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <AnimatedSection>
          <span className="text-xs font-bold uppercase tracking-widest text-accent-700">Cuánto ahorrás</span>
          <h2 className="mt-4 text-balance text-[clamp(2rem,5vw,3.2rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
            Un poco en cada compra. <span className="text-gradient">Un montón a fin de mes.</span>
          </h2>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-neutral-600">
            La docena de facturas del domingo. El asado del finde. Los remedios del mes. La verdura de la
            semana. En todo eso pagás menos, y a fin de mes se nota en el bolsillo.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
            <div>
              <p className="text-3xl font-black text-accent-700 sm:text-4xl">Hasta 2x1</p>
              <p className="mt-0.5 text-sm font-medium text-neutral-500">en los comercios de siempre</p>
            </div>
            <div className="hidden h-10 w-px bg-neutral-200 sm:block" />
            <div>
              <p className="text-3xl font-black text-accent-700 sm:text-4xl">Cada semana</p>
              <p className="mt-0.5 text-sm font-medium text-neutral-500">descuentos nuevos</p>
            </div>
          </div>
          <ul className="mt-7 space-y-3">
            {PUNTOS.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-neutral-700">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-100 text-accent-700">
                  <Check size={12} strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <a
            href={enterUrl(config)}
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-7 py-3.5 text-sm font-bold text-on-brand shadow-xl shadow-accent-500/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-accent-500/50"
          >
            Entrá y mirá los descuentos
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </a>
        </AnimatedSection>

        <AnimatedSection delay={140} className="relative">
          <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-accent-200/40 to-accent-400/10 blur-2xl" />
          <div className="rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-neutral-900/5">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              Tu mandado, con {brand}
            </p>
            <div className="mt-4 space-y-2.5">
              {EJEMPLOS.map((e) => (
                <div
                  key={e.c}
                  className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3 ring-1 ring-neutral-200/70"
                >
                  <span className="font-semibold text-neutral-800">{e.c}</span>
                  <span className="rounded-full bg-accent-600 px-3 py-1 text-xs font-black text-on-brand">{e.d}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 px-4 py-4 text-on-brand">
              <span className="text-sm font-semibold text-white/85">Tu plata, a fin de mes</span>
              <span className="text-lg font-black">rinde más</span>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  )
}
