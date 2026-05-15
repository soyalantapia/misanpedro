import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: '¿Qué necesito para empezar?',
    a: 'Sólo un celular con WhatsApp y MercadoPago. No necesitás computadora, scanner ni hardware extra. Te registrás, completás los datos del comercio, subís tu primer cupón y listo.',
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
    q: '¿Funciona con WhatsApp de verdad o es un link?',
    a: 'WhatsApp Business integrado de verdad: usás tu propio número, mandás mensajes desde la plataforma, ves quién leyó y quién respondió. No es un "compartir por WhatsApp" — es una herramienta de campaña real.',
  },
] as const

export function FAQ() {
  return (
    <section id="faq" className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
            FAQ
          </span>
          <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
            Preguntas frecuentes
          </h2>
        </div>

        <dl className="mt-12 divide-y divide-neutral-200 rounded-3xl bg-white px-6 ring-1 ring-neutral-200 sm:px-8">
          {FAQS.map((qa, i) => (
            <details key={qa.q} className="group py-6" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <dt className="text-base font-bold text-neutral-900 sm:text-lg">{qa.q}</dt>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500 transition-transform group-open:rotate-180">
                  <ChevronDown size={14} />
                </span>
              </summary>
              <dd className="mt-3 text-pretty leading-relaxed text-neutral-600">{qa.a}</dd>
            </details>
          ))}
        </dl>
      </div>
    </section>
  )
}
