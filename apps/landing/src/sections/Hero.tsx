import { ArrowRight, MessageCircle, ShoppingBag, Ticket, User } from 'lucide-react'
import { signupUrl } from '@/lib/cn'
import { useTenant, cityName, priceLabel, cupos } from '@/lib/tenant'

export function Hero() {
  const { config } = useTenant()
  const { adheridos, total, restantes } = cupos(config)
  const eyebrow = config?.brand?.heroEyebrow
    ? config.brand.heroEyebrow
    : config?.ciudad
      ? `Para comercios de ${cityName(config)}`
      : 'Para comercios PyME del barrio'
  const headlineOverride = config?.brand?.heroHeadline

  return (
    <section id="top" className="relative overflow-hidden px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* Background — soft accent gradient orbs */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-br from-accent-300/30 to-accent-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[400px] w-[700px] rounded-full bg-gradient-to-tl from-accent-200/30 to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <span className="animate-fade-up inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-accent-700 shadow-sm ring-1 ring-accent-100">
            <ShoppingBag size={12} />
            {eyebrow}
          </span>

          {headlineOverride ? (
            <h1
              className="animate-fade-up mt-7 text-balance text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[1.02] tracking-tight text-neutral-900"
              style={{ animationDelay: '60ms' }}
            >
              {headlineOverride}
            </h1>
          ) : (
            <h1
              className="animate-fade-up mt-7 text-balance text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[1.02] tracking-tight text-neutral-900"
              style={{ animationDelay: '60ms' }}
            >
              Esos días que no vendés nada…
              <br />
              <span className="bg-gradient-to-br from-accent-500 to-accent-700 bg-clip-text text-transparent">
                empezá a llenarlos.
              </span>
            </h1>
          )}

          <p
            className="animate-fade-up mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-neutral-600 sm:text-xl"
            style={{ animationDelay: '120ms' }}
          >
            Ponés tu descuento el día flojo, los vecinos cerca se enteran y entran.
            El descuento lo elegís vos, así que no regalás margen. Cada persona que
            canjea te queda como cliente tuyo y no nos quedamos un peso de tu ticket.
            Sin contratos. Sin app que aprender. {config?.ciudad ? `Hecho para ${cityName(config)}.` : 'Hecho para vos.'}
          </p>

          <div
            className="animate-fade-up mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
            style={{ animationDelay: '180ms' }}
          >
            <a
              href={signupUrl(config)}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-600 to-accent-800 px-7 py-4 text-sm font-bold text-on-brand shadow-lg shadow-accent-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent-500/40"
            >
              Empezá gratis
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#precios"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:text-neutral-900"
            >
              Ver precio
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          {/* Oferta de lanzamiento: los primeros 20 comercios entran con 3 meses
              gratis y sin tarjeta; después el precio mensual del tenant queda
              congelado de por vida (priceLabel sale del tenant, fuente: @/lib/tenant).
              El contador "X de 20" sale de @/lib/launch (fuente única). */}
          <p
            className="animate-fade-up mt-5 inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-700 ring-1 ring-accent-100"
            style={{ animationDelay: '210ms' }}
          >
            {config?.slug === 'sanpedro'
              ? `🔥 Ya van ${adheridos} de ${total} comercios · quedan ${restantes} lugares`
              : '🔥 Programa de lanzamiento · 3 meses gratis y precio congelado'}
          </p>
          <p
            className="animate-fade-up mt-4 text-xs text-neutral-500"
            style={{ animationDelay: '240ms' }}
          >
            3 meses gratis, sin tarjeta · Después {priceLabel(config)}/mes congelado de por vida · Hecho en {cityName(config)}
          </p>
        </div>

        {/* Hero visual — mockup compuesto */}
        <div
          className="animate-fade-up relative mx-auto mt-16 max-w-4xl"
          style={{ animationDelay: '300ms' }}
        >
          <HeroMockup
            domain={config?.subdomain ? `${config.subdomain}.micuidad.com` : 'micuidad.com'}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * Mockup compuesto: dashboard del comercio (a la izquierda) + tarjeta de canje
 * y mini-CRM del cliente (a la derecha). Hecho en pure JSX/Tailwind, sin
 * imagenes externas — convertible a screenshot real cuando el equipo
 * de diseño lo genere.
 */
function HeroMockup({ domain }: { domain: string }) {
  return (
    <div className="relative">
      {/* Soft platform shadow */}
      <div className="absolute inset-x-12 -bottom-6 h-12 rounded-full bg-neutral-900/20 blur-2xl" />

      {/* Main dashboard card */}
      <div className="relative grid gap-4 rounded-3xl bg-white p-3 shadow-2xl ring-1 ring-neutral-900/10 sm:p-5 md:grid-cols-[1fr_320px]">
        {/* Left: dashboard */}
        <div className="rounded-2xl bg-gradient-to-br from-neutral-50 to-white p-5 ring-1 ring-neutral-200">
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
            <span className="ml-3 text-[10px] text-neutral-400">{domain}</span>
          </div>

          {/* KPIs row */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { label: 'Canjes hoy', value: '12' },
              { label: 'Clientes nuevos', value: '7' },
              { label: 'Ahorro entregado', value: '$8.4k' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                  {kpi.label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Coupon row */}
          <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-neutral-200">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent-700">
                <Ticket size={18} />
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-neutral-900">Pizza grande con bebida</p>
                  <span className="rounded-full bg-success-bg px-2 py-0.5 text-[9px] font-bold text-success">
                    Activo
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-neutral-500">
                  25% off · 48 canjes esta semana
                </p>
                {/* Mini-bar */}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-accent-400 to-accent-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Recent canjes mini-list */}
          <div className="mt-3 space-y-2">
            {[
              { name: 'Carolina P.', time: 'hace 4 min', amount: '$5.000' },
              { name: 'Mario L.', time: 'hace 18 min', amount: '$3.200' },
              { name: 'Florencia R.', time: 'hace 32 min', amount: '$6.800' },
            ].map((r) => (
              <div
                key={r.name + r.time}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-200"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-neutral-100 text-[9px] font-bold text-neutral-600">
                    {r.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-900">{r.name}</p>
                    <p className="text-[9px] text-neutral-400">{r.time}</p>
                  </div>
                </div>
                <p className="text-[11px] font-bold tabular-nums text-neutral-700">{r.amount}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: CRM card del cliente */}
        <div className="rounded-2xl bg-gradient-to-br from-accent-600 to-accent-800 p-5 text-on-brand">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">
            Cliente recurrente
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur">
              <User size={16} />
            </span>
            <div>
              <p className="font-bold">Carolina Pérez</p>
              <p className="text-[10px] text-white/80">35 años · cumple en julio</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <Stat label="Visitas" value="3" />
            <Stat label="Día más frecuente" value="Jueves" />
            <Stat label="Descuento favorito" value="Pizza 25%" />
            <Stat label="Cumple" value="11 abr" hint="Próximo en 14 días" />
          </div>

          {/* Decorativo: simula el botón del panel del comercio. NO interactivo
              en la landing — el flujo real vive en la app. */}
          <div
            aria-hidden
            className="pointer-events-none mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-accent-700"
          >
            <MessageCircle size={14} />
            Mandarle un WhatsApp
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-2 last:border-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">{label}</p>
      <div className="text-right">
        <p className="text-sm font-bold">{value}</p>
        {hint && <p className="text-[9px] text-white/50">{hint}</p>}
      </div>
    </div>
  )
}
