import { ArrowDown } from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'

// Alturas = ilustración del gasto en el mismo mandado: sube mes a mes (gris) y
// baja con Mi San Pedro (naranja). La etiqueta "−20%" remata el ahorro.
const BARS = [
  { l: 'Antes', h: 'h-20', fill: 'bg-gradient-to-t from-neutral-200 to-neutral-300', save: false },
  { l: 'Hace un mes', h: 'h-36', fill: 'bg-gradient-to-t from-neutral-200 to-neutral-300', save: false },
  { l: 'Hoy', h: 'h-52', fill: 'bg-gradient-to-t from-neutral-300 to-neutral-400', save: false },
  { l: 'Con Mi San Pedro', h: 'h-32', fill: 'bg-gradient-to-t from-accent-600 to-accent-400', save: true },
] as const

export function Problema() {
  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-6 sm:py-28">
      <AnimatedSection className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-accent-700">La realidad</span>
        <h2 className="mt-4 text-balance text-[clamp(2rem,5.5vw,3.4rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
          Todas las semanas, el mismo mandado <span className="text-gradient">sale más caro.</span>
        </h2>
        <p className="mt-6 text-pretty text-lg leading-relaxed text-neutral-600">
          Vas con la misma plata y volvés con menos bolsas. La verdura, la carne, el pan… todo subió otra
          vez, y el sueldo no. Y encima pagás de más sin darte cuenta, en los mismos lugares de siempre.
        </p>
      </AnimatedSection>

      <AnimatedSection delay={120} className="mx-auto mt-14 max-w-md sm:max-w-lg">
        {/* Qué representa el alto de las barras (si no, el gráfico no se entiende) */}
        <p className="mb-5 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
          Lo que gastás en el mismo mandado
        </p>

        <div aria-hidden className="flex items-end justify-center gap-3 sm:gap-4">
          {BARS.map((b) => (
            <div key={b.l} className="flex flex-1 flex-col items-center justify-end gap-2">
              {/* Remate de ahorro, sobre la barra de Mi San Pedro */}
              {b.save && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-500 px-2.5 py-1 text-xs font-black text-white shadow-md shadow-accent-500/30">
                  <ArrowDown size={13} strokeWidth={3} />
                  20%
                </span>
              )}
              <div
                className={`${b.h} w-full rounded-t-2xl ${b.fill} ${
                  b.save ? 'shadow-lg shadow-accent-500/30' : ''
                }`}
              />
              <span
                className={`text-center text-xs font-bold leading-tight ${
                  b.save ? 'text-accent-700' : 'text-neutral-400'
                }`}
              >
                {b.l}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-7 text-center text-base font-semibold text-neutral-700">
          El mismo mandado — pero con Mi San Pedro{' '}
          <span className="font-extrabold text-accent-700">pagás menos</span>.
        </p>
      </AnimatedSection>
    </section>
  )
}
