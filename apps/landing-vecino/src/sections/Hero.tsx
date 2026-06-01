import { ArrowRight, Check, Sparkles, Ticket } from 'lucide-react'
import { ENTER_URL } from '@/lib/cn'

export function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden px-5 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-24">
      {/* Fondo animado */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[70%] bg-grid opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="animate-blob absolute -left-28 -top-28 h-[34rem] w-[34rem] rounded-full bg-accent-300/35 blur-3xl" />
        <div className="animate-blob-2 absolute -right-32 top-0 h-[28rem] w-[28rem] rounded-full bg-accent-500/20 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Texto */}
        <div className="text-center lg:text-left">
          <span className="animate-reveal inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-accent-700 shadow-sm ring-1 ring-accent-100 backdrop-blur">
            <Sparkles size={12} /> El club de ahorro de San Pedro
          </span>

          <h1
            className="animate-reveal mt-6 text-[clamp(2.9rem,8vw,5.4rem)] font-black leading-[0.98] tracking-tight text-neutral-900"
            style={{ animationDelay: '80ms' }}
          >
            Tu plata
            <br />
            <span className="text-gradient animate-gradient">rinde más.</span>
          </h1>

          <p
            className="animate-reveal mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-neutral-600 sm:text-xl lg:mx-0"
            style={{ animationDelay: '160ms' }}
          >
            Ahorrá en la verdulería, la carnicería, el almacén y la farmacia de siempre.{' '}
            <span className="font-semibold text-neutral-800">Lo que ya comprás, más barato.</span> Gratis y
            sin registrarte.
          </p>

          <div
            className="animate-reveal mt-9 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:items-start"
            style={{ animationDelay: '240ms' }}
          >
            <a
              href={ENTER_URL}
              className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-accent-500/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-accent-500/50"
            >
              <span className="animate-pulse-ring absolute inset-0 rounded-full" />
              <span className="relative">Entrá y mirá los descuentos</span>
              <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-1" />
            </a>
          </div>

          <div
            className="animate-reveal mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-neutral-500 lg:justify-start"
            style={{ animationDelay: '320ms' }}
          >
            {['Gratis', 'Sin registrarte', 'Comercios de San Pedro'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-accent-600" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Mockup */}
        <div className="animate-reveal relative mx-auto w-full max-w-[20rem]" style={{ animationDelay: '300ms' }}>
          <PhoneMockup />
        </div>
      </div>
    </section>
  )
}

const CUPONES = [
  { n: 'Verdulería', s: 'Don Pedro', d: '−20%' },
  { n: 'Carnicería', s: 'La Estancia', d: '2x1' },
  { n: 'Panadería', s: 'La Esquina', d: '−25%' },
  { n: 'Farmacia', s: 'del Centro', d: '−15%' },
]

function PhoneMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-accent-400/30 to-accent-600/10 blur-3xl" />

      {/* Badges flotantes */}
      <div className="animate-float absolute -left-4 top-24 z-20 rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 ring-neutral-900/5 sm:-left-6">
        <p className="text-2xl font-black text-accent-600">−20%</p>
        <p className="text-[10px] font-semibold text-neutral-500">Verdulería</p>
      </div>
      <div className="animate-float-slow absolute -right-3 top-48 z-20 rounded-2xl bg-accent-600 px-4 py-3 text-white shadow-xl sm:-right-5">
        <p className="text-2xl font-black">2x1</p>
        <p className="text-[10px] font-semibold text-white/80">Carnicería</p>
      </div>

      {/* Device */}
      <div className="relative rounded-[2.7rem] bg-neutral-900 p-2.5 shadow-2xl">
        <div className="overflow-hidden rounded-[2.2rem] bg-white">
          <div className="relative h-6 bg-white">
            <span className="absolute left-1/2 top-1.5 h-4 w-20 -translate-x-1/2 rounded-full bg-neutral-900" />
          </div>
          <div className="bg-gradient-to-br from-accent-500 to-accent-700 px-5 pb-7 pt-3 text-white">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">El club de ahorro</p>
            <p className="mt-1 text-xl font-bold">Descuentos cerca tuyo</p>
          </div>
          <div className="space-y-2.5 p-4">
            {CUPONES.map((c, i) => (
              <div
                key={c.n}
                className="animate-reveal flex items-center justify-between rounded-2xl bg-neutral-50 px-3.5 py-3 ring-1 ring-neutral-200/70"
                style={{ animationDelay: `${520 + i * 130}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-50 text-accent-700">
                    <Ticket size={16} />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold leading-tight text-neutral-900">{c.n}</p>
                    <p className="text-[10px] text-neutral-400">{c.s}</p>
                  </div>
                </div>
                <span className="rounded-full bg-accent-600 px-2.5 py-1 text-[11px] font-black text-white">
                  {c.d}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
