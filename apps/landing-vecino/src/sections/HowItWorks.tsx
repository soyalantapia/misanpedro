import { Ticket, Hash, Check } from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, cityName } from '@/lib/tenant'

const STEPS = [
  {
    icon: Ticket,
    n: '1',
    title: 'Elegís el descuento',
    body: (city: string) =>
      `Mirá los descuentos de los comercios de ${city} y elegí el que quieras. Sin registrarte.`,
  },
  {
    icon: Hash,
    n: '2',
    title: 'Mostrás tu código',
    body: () =>
      'Te aparece un código para mostrar en la caja del local. La primera vez te pedimos un dato para identificarte; después, directo.',
  },
  {
    icon: Check,
    n: '3',
    title: 'Pagás menos',
    body: () => 'El comercio aplica el descuento y pagás menos por lo mismo. Listo.',
  },
] as const

export function HowItWorks() {
  const { config } = useTenant()
  const city = cityName(config)
  return (
    <section id="como-funciona" className="bg-neutral-50/70 px-5 py-20 sm:px-6 sm:py-28">
      <AnimatedSection className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-accent-700">Cómo funciona</span>
        <h2 className="mt-4 text-balance text-[clamp(2rem,5vw,3.2rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
          Ahorrar es en 3 pasos
        </h2>
        <p className="mt-5 text-lg text-neutral-600">Sin vueltas, sin registrarte. Lo usás en 30 segundos.</p>
      </AnimatedSection>

      <div className="relative mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-3">
        <div className="pointer-events-none absolute inset-x-[16%] top-12 hidden h-px bg-gradient-to-r from-accent-200 via-accent-400 to-accent-200 sm:block" />
        {STEPS.map((s, i) => (
          <AnimatedSection
            key={s.n}
            as="article"
            delay={100 + i * 120}
            className="group relative rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-neutral-200 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:ring-accent-200"
          >
            <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 text-on-brand shadow-lg shadow-accent-500/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
              <s.icon size={22} />
              <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-neutral-900 text-[10px] font-black text-white ring-2 ring-white">
                {s.n}
              </span>
            </div>
            <h3 className="mt-6 text-lg font-bold text-neutral-900">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.body(city)}</p>
          </AnimatedSection>
        ))}
      </div>

      <p className="mx-auto mt-12 max-w-xl text-center text-sm leading-relaxed text-neutral-500">
        ¿Por qué te hacen el descuento? Porque al comercio le conviene que vuelvas. Vos pagás menos; ellos
        te ganan como cliente. Ganan los dos.
      </p>
    </section>
  )
}
