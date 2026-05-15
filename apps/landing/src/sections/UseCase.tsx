import { Quote } from 'lucide-react'

export function UseCase() {
  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
            Caso de uso
          </span>
          <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
            Un día en La Frutilla
          </h2>
        </div>

        <div className="mt-12 grid gap-8 rounded-3xl bg-gradient-to-br from-neutral-50 to-white p-6 ring-1 ring-neutral-200 sm:p-10 md:grid-cols-[320px_1fr]">
          {/* Foto placeholder */}
          <figure className="space-y-3">
            <div
              className="grid aspect-[4/5] place-items-center rounded-2xl bg-gradient-to-br from-accent-100 via-accent-50 to-white ring-1 ring-neutral-200"
              aria-label="Foto del comercio piloto"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-neutral-200">
                🍦
              </span>
            </div>
            <figcaption className="text-xs leading-relaxed text-neutral-500">
              <strong className="block font-bold text-neutral-700">
                Heladería La Frutilla
              </strong>
              Mariela Suárez, dueña
              <br />
              <span className="italic text-neutral-400">
                Comercio piloto · datos reemplazables
              </span>
            </figcaption>
          </figure>

          {/* Quote + numbers */}
          <div className="flex flex-col">
            <Quote size={24} className="text-accent-300" aria-hidden />
            <blockquote className="mt-4 text-pretty text-xl leading-relaxed text-neutral-700 sm:text-2xl">
              "Empezamos un martes a las 10 de la mañana. Subí el primer cupón —25% en
              pizzas hasta el viernes— y a las 11 ya tenía 3 canjes. Para el viernes 48.
              Pero lo que más me sorprendió fue que la semana siguiente volvieron 12 de
              esas 48 personas.{' '}
              <strong className="text-neutral-900">Sin que les manden nada.</strong>"
            </blockquote>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-neutral-200 pt-6">
              <Metric value="48" label="canjes" hint="primera semana" />
              <Metric value="12" label="volvieron" hint="sin remarketing" />
              <Metric value="0" label="volantes" hint="impresos desde entonces" />
            </div>
          </div>
        </div>
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
