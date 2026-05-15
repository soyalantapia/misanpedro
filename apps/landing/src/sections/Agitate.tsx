export function Agitate() {
  return (
    <section className="relative overflow-hidden bg-neutral-950 px-6 py-24 text-white sm:py-32">
      {/* Subtle radial gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(105,94,222,0.18),transparent_60%)]" />

      <div className="relative mx-auto max-w-4xl text-center">
        <h2 className="text-balance text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-tight">
          Cada cliente que entra a tu local
          <br />
          es una relación que{' '}
          <span className="bg-gradient-to-br from-accent-300 to-accent-500 bg-clip-text text-transparent">
            se evapora
          </span>{' '}
          apenas cruza la puerta de salida.
        </h2>
        <p className="mt-8 text-pretty text-lg leading-relaxed text-white/60">
          Y vos seguís bajando la persiana sin saber si Carlos vuelve mañana o no.
        </p>
      </div>
    </section>
  )
}
