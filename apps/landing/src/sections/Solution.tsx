import { ArrowRight, Smartphone, Hash, Heart } from 'lucide-react'
import { signupUrl } from '@/lib/cn'
import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, appName, cityName } from '@/lib/tenant'

export function Solution() {
  const { config } = useTenant()

  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <AnimatedSection>
          <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
            La solución
          </span>
          <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
            {appName(config)} es el contacto directo con tu cliente
          </h2>

          <div className="mt-7 space-y-5 text-pretty text-lg leading-relaxed text-neutral-700">
            <p>
              Publicás un descuento desde tu celular. Carolina, una vecina de {cityName(config)},
              lo activa desde la app del barrio y le aparece un código de 6 dígitos.
              Cuando llega a tu local, tu cajero ingresa el código y listo: descuento
              aplicado, canje registrado, datos de Carolina guardados.
            </p>
            <p>
              A partir de ese momento sabés que Carolina existe, cuándo cumple años,
              qué descuento prefiere, cuántas veces te visitó.{' '}
              <strong className="text-neutral-900">
                Esos clientes son tuyos:
              </strong>{' '}
              cada canje queda en tu base con nombre, cumple y frecuencia, y la
              exportás cuando quieras. La base es tuya, no nuestra.
            </p>
            <p>
              Y cobramos una mensualidad fija, nada más.{' '}
              <strong className="text-neutral-900">
                No nos quedamos un peso de tu ticket.
              </strong>{' '}
              Lo que vendés es tuyo, entero. Sin spam, sin algoritmo, sin comisiones.
            </p>
          </div>

          <a
            href={signupUrl(config)}
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-6 py-3.5 text-sm font-bold text-on-brand shadow-lg shadow-accent-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent-500/40"
          >
            Empezá gratis
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </AnimatedSection>

        <AnimatedSection delay={120}>
          <FlowVisual />
        </AnimatedSection>
      </div>
    </section>
  )
}

const FLOW_STEPS = [
  {
    icon: Smartphone,
    title: 'Publicás',
    text: 'Desde tu celular subís un descuento.',
    bg: 'bg-accent-50',
    fg: 'text-accent-700',
  },
  {
    icon: Heart,
    title: 'El vecino activa',
    text: 'Carolina ve tu descuento y lo activa.',
    bg: 'bg-success-bg',
    fg: 'text-success',
  },
  {
    icon: Hash,
    title: 'Cajero valida',
    text: 'Código de 6 dígitos. Descuento aplicado.',
    bg: 'bg-neutral-900',
    fg: 'text-white',
  },
] as const

function FlowVisual() {
  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-neutral-50 to-white p-6 ring-1 ring-neutral-200">
      <div className="absolute left-12 top-12 bottom-12 w-px bg-gradient-to-b from-accent-300 via-success to-neutral-900 opacity-40" />

      <div className="relative space-y-4">
        {FLOW_STEPS.map((s, i) => (
          <div
            key={s.title}
            className="group flex items-start gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100 transition-all hover:-translate-x-1 hover:shadow-md"
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.bg} ${s.fg} transition-transform group-hover:scale-110`}
            >
              <s.icon size={18} />
            </span>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Paso 0{i + 1}
              </p>
              <p className="mt-0.5 font-bold text-neutral-900">{s.title}</p>
              <p className="text-sm text-neutral-600">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
