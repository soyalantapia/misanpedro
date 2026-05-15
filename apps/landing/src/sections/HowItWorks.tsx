const STEPS = [
  {
    n: '01',
    title: 'Te registrás y publicás tu cupón',
    body: 'Completá los datos del comercio, subí tu logo y publicá el primer descuento. Aparece en la app del vecino al instante.',
  },
  {
    n: '02',
    title: 'El vecino activa el cupón',
    body: 'Carolina ve tu descuento en la app, lo activa con un toque. Le aparece un código de 6 dígitos válido por 30 minutos.',
  },
  {
    n: '03',
    title: 'Tu cajero valida y vos ves quién canjeó',
    body: 'Carolina llega al local, el cajero ingresa el código en su celular, descuento aplicado. Vos ves a Carolina en tu panel: nombre, edad, cumpleaños, qué canjeó.',
  },
] as const

export function HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-neutral-50 px-6 py-24 sm:py-32">
      {/* Soft accent backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-gradient-to-b from-accent-50 to-transparent" />

      <div className="relative mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
            Cómo funciona
          </span>
          <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
            En 10 minutos tenés tu primer canje
          </h2>
        </div>

        <ol className="mt-16 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="relative rounded-2xl bg-white p-7 shadow-sm ring-1 ring-neutral-200 transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="block bg-gradient-to-br from-accent-500 to-accent-700 bg-clip-text text-6xl font-bold leading-none text-transparent">
                {s.n}
              </span>
              <h3 className="mt-5 text-lg font-bold leading-snug text-neutral-900">
                {s.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-neutral-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
