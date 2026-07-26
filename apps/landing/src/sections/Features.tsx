import {
  Ticket,
  Hash,
  Users,
  MessageCircle,

} from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'
import { Stagger } from '@/components/Stagger'
import { useTenant, type LandingTenant } from '@/lib/tenant'

function buildFeatures(_config: LandingTenant | null) {
  return [
  {
    icon: Ticket,
    title: 'Descuentos en 5 minutos',
    body: 'Subí descuento, vigencia y condiciones. Listo para canjear.',
  },
  {
    icon: Hash,
    title: 'Código de 6 dígitos',
    body: 'Tu cajero lo valida desde su celular. Sin ningún aparato especial.',
  },
  {
    icon: Users,
    title: 'Tu lista de clientes, sola',
    body: 'Cada canje guarda el nombre, el cumpleaños y cuántas veces te visitó. La bajás cuando querés: si un día te vas, la lista te la llevás igual. Es tuya.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Business (pronto)',
    body: 'Campañas a tus clientes desde la plataforma. Todavía no está activo: lo estamos integrando con la API oficial de Meta.',
  },
  ] as const
}

export function Features() {
  const { config } = useTenant()
  const FEATURES = buildFeatures(config)
  return (
    <section id="funciones" className="scroll-mt-20 bg-neutral-50/60 px-6 py-16 sm:py-20">
      <AnimatedSection className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
          Todo lo que necesitás
        </span>
        <h2 className="mt-3 text-balance text-[length:var(--text-h2-soporte)] font-bold leading-[1.15] tracking-tight text-neutral-900">
          Con tu celular alcanza.
          <br className="hidden sm:inline" />
          {' '}No instalás nada.
        </h2>
      </AnimatedSection>

      <Stagger variant="card" className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <article
            key={f.title}
            className="group rounded-2xl bg-white p-6 ring-1 ring-neutral-200 transition-all hover:-translate-y-1 hover:shadow-lg hover:ring-accent-200"
          >
            <span className="inline-grid h-11 w-11 place-items-center rounded-xl bg-accent-50 text-accent-700 transition-all group-hover:bg-accent-100 group-hover:scale-110">
              <f.icon size={18} />
            </span>
            <h3 className="mt-5 text-[length:var(--text-card)] font-bold leading-snug text-neutral-900">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.body}</p>
          </article>
        ))}
      </Stagger>
    </section>
  )
}
