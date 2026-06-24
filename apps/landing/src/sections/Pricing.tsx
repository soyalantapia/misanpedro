import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { signupUrl } from '@/lib/cn'
import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, priceLabel, isArgentina, pagoLabel } from '@/lib/tenant'
import {
  COMERCIOS_ADHERIDOS,
  TOTAL_CUPOS,
  CUPOS_RESTANTES,
  MESES_GRATIS,
} from '@/lib/launch'

export function Pricing() {
  const { config } = useTenant()
  // Lo incluido en el plan. El medio de pago se gatea por país (MercadoPago solo
  // donde aplica) y el CRM usa "documento" neutro en vez de "DNI" (AR-específico).
  const included = [
    'Descuentos ilimitados',
    'CRM completo (cumpleaños, frecuencia, visitas)',
    'WhatsApp Business (próximamente)',
    'Panel desde el celular',
    'Validación con código de 6 dígitos',
    isArgentina(config) ? 'MercadoPago integrado' : 'Cobro mensual online',
    'Reportes en tiempo real',
    'Soporte dedicado',
  ]

  return (
    <section id="precios" className="scroll-mt-20 bg-neutral-50/60 px-6 py-20 sm:py-28">
      <AnimatedSection className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
          Precios
        </span>
        <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
          Un solo plan. Sin sorpresas.
        </h2>
        <p className="mt-5 text-pretty text-lg leading-relaxed text-neutral-600">
          Empezás con {MESES_GRATIS} meses gratis y sin tarjeta. Después, un plan único
          mensual por {pagoLabel(config)}. Cancelás cuando quieras desde tu panel.
        </p>
      </AnimatedSection>

      {/* Billboard horizontal */}
      <AnimatedSection delay={100} className="mx-auto mt-12 max-w-6xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent-600 via-accent-700 to-accent-800 shadow-2xl shadow-accent-500/20">
          {/* Decorative orbs */}
          <div className="pointer-events-none absolute -top-32 -left-20 h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-20 h-[500px] w-[500px] rounded-full bg-accent-300/30 blur-3xl" />

          <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16 lg:p-14">
            {/* LEFT */}
            <div className="text-on-brand">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white ring-1 ring-white/30 backdrop-blur">
                <Sparkles size={11} />
                {config?.slug === 'sanpedro'
                  ? `Lanzamiento · quedan ${CUPOS_RESTANTES} de ${TOTAL_CUPOS} lugares`
                  : 'Programa de lanzamiento'}
              </span>

              <h3 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Plan Comercio
              </h3>
              <p className="mt-2 text-base text-white/75 sm:text-lg">
                Todo lo que necesitás para que tus clientes vuelvan.
                <br className="hidden sm:inline" />
                Sin tiers, sin add-ons, sin sorpresas.
              </p>

              <ul className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {included.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm text-white/90"
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* RIGHT */}
            <div className="flex flex-col justify-center rounded-2xl bg-white p-8 shadow-xl sm:p-10">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                Primeros {MESES_GRATIS} meses
              </p>

              <p className="mt-2 flex items-baseline gap-2">
                <span className="bg-gradient-to-br from-accent-600 to-accent-800 bg-clip-text text-6xl font-bold text-transparent sm:text-7xl">
                  Gratis
                </span>
              </p>
              <p className="mt-1 text-sm font-medium text-neutral-500">
                Sin tarjeta. No cargás nada para empezar.
              </p>

              <div className="mt-4 rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                <p className="flex items-baseline gap-1.5 text-sm text-neutral-600">
                  Después
                  <strong className="text-lg tabular-nums text-neutral-900">
                    {priceLabel(config)}
                  </strong>
                  <span className="text-neutral-500">/mes</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-accent-700">
                  <span aria-hidden>🔒</span> Congelado de por vida
                  {isArgentina(config) ? ' · sin IVA (factura C)' : ''}
                </p>
              </div>

              <a
                href={signupUrl(config)}
                className="group mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-accent-600 to-accent-800 px-6 py-4 text-sm font-bold text-on-brand shadow-lg shadow-accent-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent-500/40"
              >
                Empezá gratis
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </a>

              <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
                Sin tarjeta ahora · Cancelás cuando quieras desde tu panel
              </p>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-neutral-500">
          {config?.slug === 'sanpedro' ? (
            <>
              <strong className="text-neutral-700">
                Los {MESES_GRATIS} meses gratis y el precio congelado valen para los primeros{' '}
                {TOTAL_CUPOS} comercios.
              </strong>{' '}
              Ya van {COMERCIOS_ADHERIDOS} — quedan {CUPOS_RESTANTES} lugares. Después, el
              precio sube para nuevos comercios.
            </>
          ) : (
            <>
              <strong className="text-neutral-700">
                Los {MESES_GRATIS} meses gratis y el precio congelado son parte del programa de
                lanzamiento.
              </strong>{' '}
              Sumate ahora y tu precio queda congelado de por vida. Después, el precio sube para
              nuevos comercios.
            </>
          )}
        </p>
      </AnimatedSection>
    </section>
  )
}
