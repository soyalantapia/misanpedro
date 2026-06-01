import { AnimatedSection } from '@/components/AnimatedSection'

export function Problema() {
  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-6 sm:py-28">
      <AnimatedSection className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-accent-700">La realidad</span>
        <h2 className="mt-4 text-balance text-[clamp(2rem,5.5vw,3.4rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
          Todas las semanas, el mismo mandado <span className="text-gradient">sale más caro.</span>
        </h2>
        <p className="mt-6 text-pretty text-lg leading-relaxed text-neutral-600">
          Trabajás igual, pero la plata rinde menos. La verdura, la carne, el pan… todo subió otra vez. Y
          pagás de más sin darte cuenta, en los mismos lugares de siempre.
        </p>
      </AnimatedSection>

      <AnimatedSection
        delay={120}
        className="mx-auto mt-12 flex max-w-md items-end justify-center gap-3 sm:max-w-lg"
      >
        {[
          { l: 'Antes', h: 'h-16' },
          { l: 'Hace un mes', h: 'h-24' },
          { l: 'Hoy', h: 'h-36' },
        ].map((b) => (
          <div key={b.l} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={`${b.h} w-full rounded-t-2xl bg-gradient-to-t from-neutral-200 to-neutral-300 transition-all`}
            />
            <span className="text-[11px] font-semibold text-neutral-400">{b.l}</span>
          </div>
        ))}
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-44 w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 px-2 text-center text-white shadow-lg shadow-accent-500/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">Con</span>
            <span className="text-base font-black leading-tight">Mi San Pedro</span>
            <span className="mt-1 text-[11px] font-semibold text-white/80">pagás menos</span>
          </div>
          <span className="text-[11px] font-semibold text-accent-700">la vuelta</span>
        </div>
      </AnimatedSection>
    </section>
  )
}
