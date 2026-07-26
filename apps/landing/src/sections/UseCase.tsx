import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, cityName } from '@/lib/tenant'

// Esto es una DEMO de producto, no un testimonio: muestra cómo se vería tu
// primer descuento en {appName}. Sin nombre propio ni números atribuidos a un
// comercio real (no hay piloto público todavía); un solo disclaimer fino abajo.
export function UseCase() {
  const { config } = useTenant()

  return (
    <section id="casos-de-uso" className="scroll-mt-20 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <AnimatedSection className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
            Demo del producto
          </span>
          <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
            Así se vería tu primer descuento
          </h2>
        </AnimatedSection>

        <AnimatedSection
          delay={120}
          className="mt-12 grid gap-8 rounded-2xl bg-gradient-to-br from-neutral-50 to-white p-6 ring-1 ring-neutral-200 sm:p-10 md:grid-cols-[320px_1fr]"
        >
          {/* Demo de producto (ejemplo de una heladería de la ciudad) */}
          <figure className="space-y-3">
            <div
              className="grid aspect-[4/5] place-items-center rounded-2xl bg-gradient-to-br from-accent-100 via-accent-50 to-white ring-1 ring-neutral-200"
              aria-label="Ejemplo de un comercio en la app"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-neutral-200">
                🍦
              </span>
            </div>
            <figcaption className="text-xs leading-relaxed text-neutral-500">
              <strong className="block font-bold text-neutral-700">
                Ejemplo: una heladería de {cityName(config)}
              </strong>
              Así se ve un descuento en la app
            </figcaption>
          </figure>

          {/* Narración hipotética. Los 3 números son VERDADES del producto (lo que
              cuesta y lo que tarda), no resultados prometidos: la auditoría PM del
              25/07 sacó "+40 canjes" y "~25% vuelve", que eran inventados y se leían
              como datos reales. */}
          <div className="flex flex-col">
            <p className="mb-4 text-[13px] font-semibold text-neutral-500">
              Esto es un ejemplo inventado para que veas cómo funciona, no un caso real.
            </p>
            <p className="text-pretty text-lg leading-relaxed text-neutral-700 sm:text-xl">
              Un martes flojo a las 10 subís tu primer descuento, 25% en helado hasta el
              viernes. Los vecinos cerca lo activan desde la app y empiezan a llegar al
              local. Cada uno que canjea te queda en tu base, con nombre y frecuencia.{' '}
              <strong className="text-neutral-900">Así llenás el día que no entraba nadie.</strong>
            </p>

            <div className="mt-7 grid grid-cols-3 gap-4 border-t border-neutral-200 pt-6">
              <Metric value="5 min" label="publicar" hint="un descuento, desde el celular" />
              <Metric value="$0" label="en imprenta" hint="ni un volante" />
              <Metric value="0%" label="de comisión" hint="sobre lo que vendés" />
            </div>
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
