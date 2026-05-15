import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { SIGNUP_URL } from '@/lib/cn'

const INCLUDED = [
  'Cupones ilimitados',
  'CRM completo (DNI, cumple, frecuencia)',
  'WhatsApp Business integrado',
  'Panel desde el celular',
  'Validación con código de 6 dígitos',
  'MercadoPago integrado',
  'Reportes en tiempo real',
  'Soporte por WhatsApp',
] as const

export function Pricing() {
  return (
    <section id="precios" className="scroll-mt-20 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-accent-700">
          Precios
        </span>
        <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
          Un solo plan. Sin sorpresas.
        </h2>
        <p className="mt-5 text-pretty text-lg leading-relaxed text-neutral-600">
          Plan único mensual. Cobramos por MercadoPago. Cancelás cuando quieras desde tu
          panel.
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-md">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-950 to-neutral-900 p-8 text-white shadow-2xl ring-1 ring-white/10">
          {/* Decorative gradient orb */}
          <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-accent-500/30 blur-3xl" />

          <div className="relative">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-200 ring-1 ring-accent-500/30">
              <Sparkles size={10} />
              Precio fundador
            </span>

            <div className="mt-5">
              <p className="font-bold">Plan Comercio</p>
              <p className="mt-1 text-sm text-white/60">Para PyMEs adheridas al programa</p>
            </div>

            <div className="mt-7 flex items-end gap-3">
              <span className="text-base font-bold text-white/40 line-through tabular-nums">
                $45.000
              </span>
              <p className="text-6xl font-bold tabular-nums leading-none">
                $25.000
                <span className="ml-1 text-base font-medium text-white/60">/mes</span>
              </p>
            </div>
            <p className="mt-3 text-xs font-semibold text-accent-200">
              Congelado por 12 meses si te sumás durante la beta
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check size={14} className="mt-0.5 shrink-0 text-accent-300" />
                  <span className="text-white/85">{item}</span>
                </li>
              ))}
            </ul>

            <a
              href={SIGNUP_URL}
              className="group mt-9 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-bold text-neutral-900 transition-all hover:-translate-y-0.5 hover:bg-neutral-100"
            >
              Empezar gratis 14 días
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>

            <p className="mt-4 text-center text-xs text-white/50">
              14 días gratis · Sin tarjeta · Cancelás cuando quieras
            </p>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-md text-center text-xs leading-relaxed text-neutral-500">
          Después del trial, $25.000/mes.{' '}
          <strong className="text-neutral-700">
            Si te sumás durante la beta, ese precio queda congelado durante 12 meses
          </strong>{' '}
          aunque después suba para nuevos comercios.
        </p>
      </div>
    </section>
  )
}
