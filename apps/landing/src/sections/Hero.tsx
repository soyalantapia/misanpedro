import { ArrowRight, Ticket, ShieldCheck, Store } from 'lucide-react'
import { signupUrl } from '@/lib/cn'
import { useTenant, cityName, appName, cupos } from '@/lib/tenant'

export function Hero() {
  const { config } = useTenant()
  const { adheridos, total } = cupos(config)
  const ciudad = cityName(config)
  const marca = appName(config)
  const headlineOverride = config?.brand?.heroHeadline

  return (
    <section id="top" className="relative overflow-hidden px-6 pt-10 pb-16 sm:pt-20 sm:pb-24">
      {/* Background — soft accent gradient orbs */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-br from-accent-300/30 to-accent-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[400px] w-[700px] rounded-full bg-gradient-to-tl from-accent-200/30 to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-5xl">
        <div className="flex flex-col items-center text-center">
          {/* Eyebrow + escasez FUSIONADOS y ARRIBA del H1 (auditoría PM 25/07: el
              contador estaba debajo del botón, o sea sólo lo veía quien ya había
              decidido). El conteo es REAL: sale de merchantsActivos del backend. */}
          <span className="animate-fade-up inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-accent-700 shadow-sm ring-1 ring-accent-100">
            <span className="inline-flex items-center gap-1.5">
              <Store size={12} />
              Para comercios de {ciudad}
            </span>
            {config?.slug === 'sanpedro' && (
              <>
                <span aria-hidden className="text-accent-300">·</span>
                <span className="text-neutral-500">
                  ya van {adheridos} de {total}
                </span>
              </>
            )}
          </span>

          <h1
            className="animate-fade-up mt-6 text-balance text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[1.02] tracking-tight text-neutral-900"
            style={{ animationDelay: '60ms' }}
          >
            {headlineOverride ?? (
              <>
                Esos días que no vendés nada…
                <br />
                <span className="bg-gradient-to-br from-accent-500 to-accent-700 bg-clip-text text-transparent">
                  empezá a llenarlos.
                </span>
              </>
            )}
          </h1>

          {/* EL SUSTANTIVO (auditoría PM: a los 5 segundos el comerciante entendía su
              problema pero no QUÉ le estamos vendiendo). Va primero y en negrita. */}
          <p
            className="animate-fade-up mt-6 max-w-2xl text-balance text-lg font-semibold leading-snug text-neutral-900 sm:text-xl"
            style={{ animationDelay: '100ms' }}
          >
            {marca} es el club de ahorro de {ciudad}: una app gratis donde los vecinos
            buscan descuentos en comercios de acá.
          </p>

          <p
            className="animate-fade-up mt-3 max-w-2xl text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg"
            style={{ animationDelay: '140ms' }}
          >
            Vos publicás un descuento para tu día flojo y entran vecinos. Cada uno queda como
            cliente tuyo, con nombre y teléfono, para que vuelva.
          </p>

          {/* Los 2 argumentos que más destraban, arriba (estaban enterrados en Solución) */}
          <ul
            className="animate-fade-up mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold text-neutral-700"
            style={{ animationDelay: '170ms' }}
          >
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-accent-700" aria-hidden />
              No tocamos un peso de tu venta
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-accent-700" aria-hidden />
              Tu lista de clientes es tuya
            </li>
          </ul>

          <div
            className="animate-fade-up mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
            style={{ animationDelay: '200ms' }}
          >
            <a
              href={signupUrl(config)}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-600 to-accent-800 px-7 py-4 text-sm font-bold text-on-brand shadow-lg shadow-accent-500/25 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent-500/40 active:scale-[0.97] active:shadow-md"
            >
              Empezá gratis
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#precios"
              className="group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:text-neutral-900 active:scale-[0.97]"
            >
              Ver precio
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          {/* Acá vivían dos párrafos de letra chica (qué te pedimos en el alta y la
              línea de gratis/precio). Se sacaron a pedido: el Hero cerraba con dos
              bloques grises de 12px que nadie lee. Los datos NO se pierden: la
              escasez sigue en el eyebrow, el "sin tarjeta ni CUIT" está en el FAQ
              y en Precios, y el precio congelado en Precios. */}
        </div>

        {/* Hero visual — mockup compuesto */}
        <div
          className="animate-fade-up relative mx-auto mt-14 max-w-4xl"
          style={{ animationDelay: '300ms' }}
        >
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
            Ejemplo de pantalla · así se ve tu panel
          </p>
          <HeroMockup
            domain={config?.subdomain ? `${config.subdomain}.micuidad.com` : 'micuidad.com'}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * Mockup compuesto del panel del comercio. Hecho en JSX/Tailwind, sin imágenes.
 *
 * Auditoría PM 25/07 — dos correcciones:
 *  1. HONESTIDAD: los números están a escala de ILUSTRACIÓN (un día normal de un
 *     comercio chico), no a escala de promesa, y la sección lleva el rótulo
 *     "ejemplo de pantalla". Antes se leían como resultados reales.
 *  2. MOBILE: abajo de `sm` el panel de KPIs no se renderiza (a 375px quedaban
 *     ~58px por KPI = ilegible). En celular se muestra sólo la tarjeta de cupón,
 *     que es la que cuenta la historia.
 */
function HeroMockup({ domain }: { domain: string }) {
  return (
    <div className="relative">
      {/* Soft platform shadow */}
      <div className="absolute inset-x-12 -bottom-6 h-12 rounded-full bg-neutral-900/20 blur-2xl" />

      <div className="relative rounded-3xl bg-white p-3 shadow-2xl ring-1 ring-neutral-900/10 sm:p-5">
        <div className="rounded-2xl bg-gradient-to-br from-neutral-50 to-white p-4 ring-1 ring-neutral-200 sm:p-5">
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
            <span className="ml-3 text-[10px] text-neutral-500">{domain}</span>
          </div>

          {/* KPIs — sólo desde sm (en mobile no entran legibles) */}
          <div className="mt-5 hidden grid-cols-3 gap-2 sm:grid">
            {[
              { label: 'Canjes hoy', value: '3' },
              { label: 'Clientes nuevos', value: '2' },
              { label: 'Ahorro entregado', value: '$4.100' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  {kpi.label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Tarjeta de cupón — la que cuenta la historia, visible SIEMPRE */}
          <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-neutral-200">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent-700">
                <Ticket size={20} />
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-neutral-900 sm:text-base">
                    Pizza grande con bebida
                  </p>
                  <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-bold text-success">
                    Activo
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-600 sm:text-sm">
                  25% off · 9 canjes esta semana
                </p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-accent-400 to-accent-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Últimos canjes — sólo desde sm */}
          <div className="mt-3 hidden space-y-2 sm:block">
            {[
              { name: 'Carolina P.', time: 'hace 4 min', amount: '$5.000' },
              { name: 'Mario L.', time: 'hace 18 min', amount: '$3.200' },
            ].map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-200"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-600">
                    {r.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-900">{r.name}</p>
                    <p className="text-[10px] text-neutral-500">{r.time}</p>
                  </div>
                </div>
                <p className="text-[11px] font-bold tabular-nums text-neutral-700">{r.amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
