import { AnimatedSection } from '@/components/AnimatedSection'

const FAQS = [
  {
    q: '¿Es gratis de verdad?',
    a: 'Sí, 100% gratis para el vecino, siempre. No pagás nada por usar la app. El que ahorra sos vos.',
  },
  {
    q: '¿Tengo que poner la tarjeta?',
    a: 'No. No te pedimos tarjeta ni datos de pago. Mostrás el código en la caja del comercio y listo.',
  },
  {
    q: '¿Anda en mi celular?',
    a: 'Sí. Es una web que abrís desde el celular, sin descargar nada de ninguna tienda. Funciona en cualquier teléfono con internet.',
  },
  {
    q: '¿En qué comercios la puedo usar?',
    a: 'En los comercios de San Pedro que están en la app: verdulería, carnicería, almacén, panadería, farmacia y más. Cada semana se suman nuevos.',
  },
  {
    q: '¿Tengo que registrarme para ver los descuentos?',
    a: 'No. Entrás y mirás todos los descuentos sin crear ninguna cuenta. Cuando canjeás por primera vez, te pedimos un dato para identificarte. Nada más.',
  },
  {
    q: '¿No es un descuento trucho?',
    a: 'No. Es un descuento real sobre lo que ya comprás. El comercio lo ofrece para que vuelvas: vos pagás menos, sin letra chica.',
  },
] as const

export function FAQ() {
  return (
    <section id="faq" className="px-5 py-20 sm:px-6 sm:py-28">
      <AnimatedSection className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-accent-700">Preguntas</span>
        <h2 className="mt-4 text-balance text-[clamp(2rem,5vw,3.2rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
          Lo que te estás preguntando
        </h2>
      </AnimatedSection>

      <AnimatedSection
        delay={120}
        className="mx-auto mt-12 max-w-3xl divide-y divide-neutral-200 overflow-hidden rounded-3xl bg-white px-6 ring-1 ring-neutral-200 sm:px-8"
      >
        <dl>
          {FAQS.map((qa, i) => (
            <details key={qa.q} className="group py-5" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <dt className="text-base font-bold text-neutral-900 sm:text-lg">{qa.q}</dt>
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-lg font-bold text-neutral-500 transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <dd className="mt-3 text-pretty leading-relaxed text-neutral-600">{qa.a}</dd>
            </details>
          ))}
        </dl>
      </AnimatedSection>
    </section>
  )
}
