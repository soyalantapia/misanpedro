import {
  Ticket,
  Hash,
  Users,
  MessageCircle,
  Smartphone,
  CreditCard,
} from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'

const FEATURES = [
  {
    icon: Ticket,
    title: 'Cupones en 5 minutos',
    body: 'Subí descuento, vigencia y condiciones. Listo para canjear.',
  },
  {
    icon: Hash,
    title: 'Código de 6 dígitos',
    body: 'Tu cajero valida desde el celular. Sin escáner, sin hardware.',
  },
  {
    icon: Users,
    title: 'CRM automático',
    body: 'Cada canje guarda nombre, DNI, cumpleaños y frecuencia del cliente.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Business (pronto)',
    body: 'Campañas a tus clientes desde la plataforma. Lo estamos integrando con la API oficial de Meta.',
  },
  {
    icon: Smartphone,
    title: 'Panel desde el celular',
    body: 'No necesitás computadora. Todo desde tu teléfono.',
  },
  {
    icon: CreditCard,
    title: 'MercadoPago integrado',
    body: 'Cobramos la mensualidad por MP. Sin tarjeta en formularios.',
  },
] as const

export function Features() {
  return (
    <section id="funciones" className="scroll-mt-20 bg-neutral-50/60 px-6 py-20 sm:py-28">
      <AnimatedSection className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
          Todo lo que necesitás
        </span>
        <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
          Cero código. Cero hardware extra.
          <br className="hidden sm:inline" />
          {' '}Solo tu celular.
        </h2>
      </AnimatedSection>

      <div className="mx-auto mt-16 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <AnimatedSection
            key={f.title}
            delay={60 + i * 40}
            as="article"
            className="group rounded-2xl bg-white p-6 ring-1 ring-neutral-200 transition-all hover:-translate-y-1 hover:shadow-lg hover:ring-accent-200"
          >
            <span className="inline-grid h-11 w-11 place-items-center rounded-xl bg-accent-50 text-accent-700 transition-all group-hover:bg-accent-100 group-hover:scale-110">
              <f.icon size={18} />
            </span>
            <h3 className="mt-5 font-bold text-neutral-900">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.body}</p>
          </AnimatedSection>
        ))}
      </div>
    </section>
  )
}
