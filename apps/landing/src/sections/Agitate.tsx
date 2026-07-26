import { AnimatedSection } from '@/components/AnimatedSection'

export function Agitate() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-accent-50 via-white to-accent-100 px-6 py-14 sm:py-16">
      <div className="pointer-events-none absolute -top-32 left-1/3 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-accent-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-[400px] w-[700px] rounded-full bg-accent-100 blur-3xl" />

      <AnimatedSection className="relative mx-auto max-w-4xl text-center">
        <h2 className="text-balance text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-neutral-900">
          Hoy atendiste 80 personas.
          <br className="hidden sm:inline" />
          {' '}¿Cuántas vuelven{' '}
          <span className="bg-gradient-to-br from-accent-500 to-accent-700 bg-clip-text text-transparent">
            mañana
          </span>
          ?
        </h2>
        <p className="mt-6 text-pretty text-base sm:text-lg leading-relaxed text-neutral-600">
          Vos no sabés. Y por eso ellas tampoco vuelven.
          <br className="hidden sm:inline" />
          {' '}El olvido es mutuo. Y cada cliente que se olvida es plata que se va.
        </p>
      </AnimatedSection>
    </section>
  )
}
