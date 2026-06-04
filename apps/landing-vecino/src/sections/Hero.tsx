import { ArrowRight, Check, Sparkles, Search, TicketCheck, Croissant, ShoppingCart, Pill } from 'lucide-react'
import { ENTER_URL } from '@/lib/cn'

export function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden px-5 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-24">
      {/* Fondo animado */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
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
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-accent-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent-500/40"
            >
              Entrá y mirá los descuentos
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
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
        <div
          aria-hidden
          className="animate-reveal relative mx-auto w-[15.5rem] sm:w-[16.5rem] lg:w-[17.5rem]"
          style={{ animationDelay: '300ms' }}
        >
          <PhoneMockup />
        </div>
      </div>
    </section>
  )
}

// Cupones de ejemplo del mockup — replican la CouponCard real de la app: imagen
// tinteada por categoría + ícono lucide (mismos tintes/íconos que `CardImage`),
// badge "% OFF" y "Ahorrás ~$" en verde. Sin nombres de comercio (nada trucho).
const MOCK_CUPONES = [
  { cat: 'Panadería', titulo: 'Docena de facturas', pct: '25', ahorro: '$900', tint: 'bg-yellow-100', ink: 'text-yellow-900', Icon: Croissant },
  { cat: 'Almacén', titulo: 'La compra de la semana', pct: '20', ahorro: '$2.400', tint: 'bg-teal-100', ink: 'text-teal-900', Icon: ShoppingCart },
  { cat: 'Farmacia', titulo: 'Los remedios del mes', pct: '15', ahorro: '$1.500', tint: 'bg-green-100', ink: 'text-green-900', Icon: Pill },
]

const MOCK_CHIPS = ['Todas', 'Gastronomía', 'Panadería', 'Almacén', 'Farmacia']

/**
 * Mockup del celular — réplica fiel del home de la app del vecino: billetera de
 * ahorro + buscador + chips de categoría + CouponCards tinteadas por rubro (mismos
 * tintes e íconos que la app). Tema claro, acento naranja, "Ahorrás" en verde.
 * Proporción de teléfono real (aspect 9/19, bezel fino + dynamic island).
 */
function PhoneMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-accent-400/30 to-accent-600/10 blur-3xl" />

      {/* Badge flotante "Gratis" — mensaje de la landing (no vive dentro de la app). */}
      <div className="animate-float absolute -right-4 -top-3 z-20 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 shadow-xl ring-1 ring-neutral-900/5 sm:-right-6">
        <Check size={15} strokeWidth={3} className="text-accent-600" />
        <p className="text-sm font-black text-neutral-900">Gratis</p>
      </div>

      {/* Device — alto y angosto (proporción real), bezel fino + dynamic island */}
      <div className="relative rounded-[2.6rem] bg-neutral-950 p-[3px] shadow-2xl ring-1 ring-black/5">
        <div className="relative aspect-[9/19] overflow-hidden rounded-[2.4rem] bg-white">
          {/* Dynamic island */}
          <div className="absolute left-1/2 top-2 z-30 h-[1.05rem] w-[4.5rem] -translate-x-1/2 rounded-full bg-neutral-950" />

          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-2 text-[9px] font-bold text-neutral-900">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="flex items-end gap-px">
                <span className="h-1 w-0.5 rounded-sm bg-neutral-900/70" />
                <span className="h-1.5 w-0.5 rounded-sm bg-neutral-900/70" />
                <span className="h-2 w-0.5 rounded-sm bg-neutral-900/70" />
              </span>
              <span className="ml-0.5 flex h-2 w-3.5 items-center rounded-[2px] border border-neutral-900/50 p-px">
                <span className="block h-full w-2/3 rounded-[1px] bg-neutral-900/70" />
              </span>
            </span>
          </div>

          {/* App */}
          <div className="px-3 pb-4 pt-1.5">
            {/* Top bar */}
            <div className="flex items-center justify-between pb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-accent-500 to-accent-700 text-[9px] font-black text-white">
                  M
                </span>
                <span className="text-[11px] font-extrabold tracking-tight text-neutral-900">Mi San Pedro</span>
              </div>
              <span className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">San Pedro</span>
            </div>

            {/* Billetera de ahorro */}
            <div className="relative overflow-hidden rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200/80">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-accent-600">
                    Ahorrado en San Pedro
                  </p>
                  <p className="mt-0.5 flex items-baseline gap-0.5 font-black tracking-tight text-neutral-900">
                    <span className="text-xs text-neutral-400">$</span>
                    <span className="text-[1.7rem] leading-none">14.300</span>
                  </p>
                </div>
                <svg width="54" height="24" viewBox="0 0 54 24" className="mt-1 overflow-visible">
                  <defs>
                    <linearGradient id="mkspark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ea580c" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 20 L13 15 L27 17 L40 8 L54 3 L54 24 L0 24 Z" fill="url(#mkspark)" />
                  <path
                    d="M0 20 L13 15 L27 17 L40 8 L54 3"
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="54" cy="3" r="2.4" fill="#ea580c" />
                </svg>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[8px] font-bold text-neutral-700 ring-1 ring-neutral-200">
                  <TicketCheck size={9} className="text-accent-600" /> 12 canjes
                </span>
                <span className="inline-flex items-center rounded-full bg-accent-50 px-2 py-0.5 text-[8px] font-bold text-accent-700 ring-1 ring-accent-100">
                  Ahorrador Plata
                </span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full w-[62%] rounded-full bg-accent-500" />
              </div>
            </div>

            {/* Buscador */}
            <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-neutral-100 px-2.5 py-1.5 ring-1 ring-neutral-200/70">
              <Search size={11} className="text-neutral-400" />
              <span className="text-[9px] font-medium text-neutral-400">Buscar comercio o descuento</span>
            </div>

            {/* Chips de categoría */}
            <div className="mt-2 flex gap-1.5 overflow-hidden">
              {MOCK_CHIPS.map((chip, i) => (
                <span
                  key={chip}
                  className={
                    i === 0
                      ? 'shrink-0 rounded-full bg-accent-500 px-2.5 py-1 text-[8px] font-bold text-white shadow-sm'
                      : 'shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[8px] font-semibold text-neutral-500 ring-1 ring-neutral-200'
                  }
                >
                  {chip}
                </span>
              ))}
            </div>

            {/* Cupones — CouponCards tinteadas por categoría (fieles a la app) */}
            <div className="mt-2.5 space-y-2.5">
              {MOCK_CUPONES.map((c, i) => (
                <div
                  key={c.cat}
                  className="animate-reveal overflow-hidden rounded-2xl bg-neutral-50 ring-1 ring-neutral-200/80"
                  style={{ animationDelay: `${600 + i * 130}ms` }}
                >
                  <div className={`relative grid h-16 place-items-center ${c.tint}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),transparent_60%)]" />
                    <c.Icon size={26} strokeWidth={2} className={`relative ${c.ink}`} />
                    <span className="absolute left-2 top-2 inline-flex items-baseline rounded-full bg-white px-1.5 py-0.5 font-black text-accent-600 shadow-sm ring-1 ring-neutral-200">
                      <span className="text-[11px] tabular-nums">{c.pct}%</span>
                      <span className="ml-0.5 text-[6px] font-extrabold tracking-widest">OFF</span>
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-[7px] font-bold uppercase tracking-widest text-neutral-400">{c.cat}</p>
                    <p className="mt-0.5 text-[11px] font-bold leading-tight text-neutral-900">{c.titulo}</p>
                    <p className="mt-0.5 text-[10px] font-extrabold text-[#059669]">Ahorrás ~{c.ahorro}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fade inferior — sensación de scroll */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
        </div>
      </div>
    </div>
  )
}
