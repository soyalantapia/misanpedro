import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, cityName } from '@/lib/tenant'

// LA1 (audit v8): esto es un ejemplo ILUSTRATIVO, no un testimonio real.
// Mientras no haya un comercio piloto que nos deje usar su nombre y números
// reales, lo presentamos claramente como hipotético (sin nombre propio ni
// comillas atribuidas a una persona).
export function UseCase() {
  const { config } = useTenant()

  return (
    <section id="casos-de-uso" className="scroll-mt-20 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <AnimatedSection className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
            Cómo se ve en la práctica
          </span>
          <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
            Un ejemplo para una heladería de barrio
          </h2>
        </AnimatedSection>

        <AnimatedSection
          delay={120}
          className="mt-12 grid gap-8 rounded-2xl bg-gradient-to-br from-neutral-50 to-white p-6 ring-1 ring-neutral-200 sm:p-10 md:grid-cols-[320px_1fr]"
        >
          {/* Ilustración (no es un comercio real) */}
          <figure className="space-y-3">
            <div
              className="grid aspect-[4/5] place-items-center rounded-2xl bg-gradient-to-br from-accent-100 via-accent-50 to-white ring-1 ring-neutral-200"
              aria-label="Ilustración de un comercio de ejemplo"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-neutral-200">
                🍦
              </span>
            </div>
            <figcaption className="text-xs leading-relaxed text-neutral-500">
              <strong className="block font-bold text-neutral-700">
                Ejemplo: una heladería de {cityName(config)}
              </strong>
              Caso ilustrativo
              <br />
              <span className="italic text-neutral-400">
                Números de referencia, no de un cliente real
              </span>
            </figcaption>
          </figure>

          {/* Narración hipotética + números de referencia */}
          <div className="flex flex-col">
            <p className="text-pretty text-xl leading-relaxed text-neutral-700 sm:text-2xl">
              Un martes a las 10 subís tu primer descuento —25% en helado hasta el viernes—.
              Los vecinos lo activan desde la app y empiezan a llegar al local. Para el
              finde podés acumular varias decenas de canjes, y parte de esa gente vuelve
              la semana siguiente.{' '}
              <strong className="text-neutral-900">Esa es la idea: que vuelvan solos.</strong>
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-neutral-200 pt-6">
              <Metric value="+40" label="canjes" hint="en una semana de promo" />
              <Metric value="~25%" label="vuelve" hint="sin remarketing" />
              <Metric value="0" label="volantes" hint="impresos" />
            </div>
            <p className="mt-4 text-[11px] text-neutral-400">
              Cifras ilustrativas para mostrar el potencial — no son resultados garantizados.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  )
}

function Metric({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div>
      <p className="bg-gradient-to-br from-accent-600 to-accent-800 bg-clip-text text-3xl font-bold tabular-nums text-transparent">
        {value}
      </p>
      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-neutral-700">
        {label}
      </p>
      <p className="text-[10px] text-neutral-500">{hint}</p>
    </div>
  )
}
