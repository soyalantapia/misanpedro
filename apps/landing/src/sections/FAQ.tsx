import { ChevronDown } from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, priceLabel, isSanPedro, pagoLabel, cupos, cityName, type LandingTenant } from '@/lib/tenant'
import { TOTAL_CUPOS } from '@/lib/launch'

function buildFaqs(config: LandingTenant | null) {
  const precio = priceLabel(config)
  const sp = isSanPedro(config)
  const pago = pagoLabel(config)
  const { adheridos, restantes } = cupos(config)
  const ciudad = cityName(config)
  return [
  {
    q: '¿Qué necesito para empezar?',
    a: 'Sólo un celular. No necesitás computadora ni ningún aparato especial, y no cargás tarjeta ni medio de pago para arrancar. Te registrás, completás los datos del comercio, subís tu primer descuento y listo.',
  },
  {
    // La pregunta #1 del comerciante ("¿a cuánta gente le llega?") — contestada de
    // frente y sin inflar. Auditoría PM 25/07: no estaba en ningún lado.
    q: `¿Cuánta gente de ${ciudad} está usando la app hoy?`,
    a: sp
      ? `Te contesto de frente: estamos arrancando. No te vamos a mentir con un número inflado. Hoy hay ${adheridos} comercios adentro y los vecinos se van sumando a medida que hay descuentos para usar — por eso los primeros ${TOTAL_CUPOS} entran gratis: estamos construyendo esto juntos. El que entra ahora no paga nada mientras se llena; el que espera a que esté lleno arranca pagando ${precio}/mes.`
      : `Estamos arrancando en ${ciudad} y no te vamos a mentir con un número inflado: los vecinos se suman a medida que hay descuentos para usar. Por eso los primeros ${TOTAL_CUPOS} comercios entran gratis — estamos construyendo esto juntos.`,
  },
  {
    q: '¿Qué me van a pedir para registrarme?',
    a: 'Tres pantallas y dos minutos: el nombre y el rubro de tu comercio, la dirección y los horarios, tu nombre, tu teléfono y tu mail. No te pedimos tarjeta, ni CUIT, ni contraseña (para entrar al panel te mandamos un código al mail). El logo y las fotos los cargás después, cuando tengas tiempo.',
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
    a: 'Sí. No hay contrato, no hay permanencia, no hay multa. Lo cancelás vos desde tu celular, en el panel, y no te cobramos el mes siguiente. Tu lista de clientes te la llevás igual, y si volvés conservás tu historial.',
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
    q: '¿Cómo es el período gratis?',
    a: sp
      ? `Los primeros ${TOTAL_CUPOS} comercios que se suman usan la plataforma gratis hasta que se complete el cupo, sin cargar tarjeta. Cuando lleguemos a los ${TOTAL_CUPOS}, empezás a pagar ${precio}/mes por ${pago}, y ese precio te queda congelado de por vida. Antes de empezar a cobrarte te avisamos con 30 días de anticipación, así decidís tranquilo. Hoy van ${adheridos} de ${TOTAL_CUPOS} lugares (quedan ${restantes}).`
      : `Los comercios del programa de lanzamiento usan la plataforma gratis hasta que se complete el cupo, sin cargar tarjeta. Después empezás a pagar ${precio}/mes por ${pago}, y ese precio te queda congelado de por vida. Antes de empezar a cobrarte te avisamos con 30 días de anticipación, así decidís tranquilo.`,
  },
  {
    q: `¿El precio de ${precio}/mes es para siempre?`,
    a: sp
      ? `Sí. Los primeros ${TOTAL_CUPOS} comercios arrancan gratis y, después, pagan ${precio}/mes congelado de por vida. Aunque subamos el precio para nuevos comercios, vos seguís pagando ${precio} mientras tu cuenta esté activa. Si pausás y volvés, conservás el precio.`
      : `Sí. Los comercios del lanzamiento arrancan gratis y, después, pagan ${precio}/mes congelado de por vida. Aunque subamos el precio para nuevos comercios, vos seguís pagando ${precio} mientras tu cuenta esté activa. Si pausás y volvés, conservás el precio.`,
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
