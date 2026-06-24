import { ChevronDown } from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, priceLabel, isSanPedro, pagoLabel, type LandingTenant } from '@/lib/tenant'
import {
  COMERCIOS_ADHERIDOS,
  TOTAL_CUPOS,
  CUPOS_RESTANTES,
  MESES_GRATIS,
} from '@/lib/launch'

function buildFaqs(config: LandingTenant | null) {
  const precio = priceLabel(config)
  const sp = isSanPedro(config)
  const pago = pagoLabel(config)
  return [
  {
    q: '¿Qué necesito para empezar?',
    a: 'Sólo un celular con WhatsApp. No necesitás computadora, scanner ni hardware extra, y no cargás tarjeta ni medio de pago para arrancar. Te registrás, completás los datos del comercio, subís tu primer descuento y listo.',
  },
  {
    q: '¿El vecino paga algo por usar la app?',
    a: 'No, para el vecino es 100% gratis. La app del vecino es gratuita y siempre lo va a ser. Nosotros cobramos sólo a los comercios adheridos.',
  },
  {
    q: '¿Y si en mi local no anda bien internet?',
    a: 'Tu cajero valida con un código de 6 dígitos desde su propio celular. No necesitamos WiFi del local. Sólo hace falta señal del cajero (datos móviles funcionan).',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí. No hay contrato anual, no hay permanencia, no hay penalidad. Cancelás desde tu panel y la cuenta queda pausada el mes siguiente. Si volvés, conservás tu historial.',
  },
  {
    q: '¿Cómo cobro al cliente? ¿Ustedes se quedan con algo?',
    a: 'Vos cobrás directo al cliente en tu caja, en efectivo, débito, crédito o como quieras. Nosotros no nos quedamos con ningún porcentaje del ticket. Sólo cobramos la mensualidad fija.',
  },
  {
    q: '¿Puedo mandar campañas por WhatsApp a mis clientes?',
    a: 'Es la próxima función que estamos integrando, con la API oficial de WhatsApp Business. Mientras tanto ya construís tu base de clientes (nombre, cumpleaños, frecuencia de visita), que queda lista para usar el día que se active.',
  },
  {
    q: '¿Cómo son los 3 meses gratis?',
    a: sp
      ? `Los primeros ${TOTAL_CUPOS} comercios que se suman arrancan con ${MESES_GRATIS} meses sin pagar nada y sin cargar tarjeta. Recién al cuarto mes empezás a pagar ${precio}/mes por ${pago}, y ese precio te queda congelado de por vida. Hoy van ${COMERCIOS_ADHERIDOS} de ${TOTAL_CUPOS} lugares (quedan ${CUPOS_RESTANTES}).`
      : `Los comercios del programa de lanzamiento arrancan con ${MESES_GRATIS} meses sin pagar nada y sin cargar tarjeta. Recién al cuarto mes empezás a pagar ${precio}/mes por ${pago}, y ese precio te queda congelado de por vida.`,
  },
  {
    q: `¿El precio de ${precio}/mes es para siempre?`,
    a: sp
      ? `Sí. Los primeros ${TOTAL_CUPOS} comercios arrancan con ${MESES_GRATIS} meses gratis y, después, pagan ${precio}/mes congelado de por vida. Aunque subamos el precio para nuevos comercios, vos seguís pagando ${precio} mientras tu cuenta esté activa. Si pausás y volvés, conservás el precio.`
      : `Sí. Los comercios del lanzamiento arrancan con ${MESES_GRATIS} meses gratis y, después, pagan ${precio}/mes congelado de por vida. Aunque subamos el precio para nuevos comercios, vos seguís pagando ${precio} mientras tu cuenta esté activa. Si pausás y volvés, conservás el precio.`,
  },
  ] as const
}

export function FAQ() {
  const { config } = useTenant()
  const FAQS = buildFaqs(config)

  return (
    <section id="faq" className="scroll-mt-20 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <AnimatedSection className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
            FAQ
          </span>
          <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
            Preguntas frecuentes
          </h2>
        </AnimatedSection>

        <AnimatedSection
          delay={120}
          className="mt-12 divide-y divide-neutral-200 rounded-2xl bg-white px-6 ring-1 ring-neutral-200 sm:px-8"
          as="div"
        >
          <dl>
            {FAQS.map((qa, i) => (
              <details key={qa.q} className="group py-6 pr-2" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <dt className="text-base font-bold text-neutral-900 sm:text-lg">
                    {qa.q}
                  </dt>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500 transition-transform group-open:rotate-180">
                    <ChevronDown size={14} />
                  </span>
                </summary>
                <dd className="mt-3 text-pretty leading-relaxed text-neutral-600">
                  {qa.a}
                </dd>
              </details>
            ))}
          </dl>
        </AnimatedSection>
      </div>
    </section>
  )
}
