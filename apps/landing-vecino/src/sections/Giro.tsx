import { ArrowRight } from 'lucide-react'
import { ENTER_URL } from '@/lib/cn'
import { AnimatedSection } from '@/components/AnimatedSection'

export function Giro() {
  return (
    <section className="px-5 py-16 sm:px-6 sm:py-20">
      <AnimatedSection className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-accent-50 to-white px-6 py-14 text-center ring-1 ring-accent-100 sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-60 w-[36rem] -translate-x-1/2 rounded-full bg-accent-200/40 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-accent-700">La vuelta de tuerca</p>
          <h2 className="mt-5 text-balance text-[clamp(2rem,5vw,3.2rem)] font-black leading-[1.05] tracking-tight text-neutral-900">
            No necesitás ganar más para que <span className="text-gradient">te alcance más.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-neutral-600">
            No cambiás nada de lo que comprás. Solo lo comprás más barato, en los comercios de tu ciudad.
            Así de simple.
          </p>
          <a
            href={ENTER_URL}
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-accent-500/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-accent-500/50"
          >
            Quiero que mi plata rinda más
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </AnimatedSection>
    </section>
  )
}
