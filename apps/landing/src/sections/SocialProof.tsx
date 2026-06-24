import { Sparkles, Gift, Lock, Headphones } from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'
import { useTenant, cityName, priceLabel, type LandingTenant } from '@/lib/tenant'
import {
  COMERCIOS_ADHERIDOS,
  TOTAL_CUPOS,
  CUPOS_RESTANTES,
  MESES_GRATIS,
} from '@/lib/launch'

// LA1 (audit v8): reemplazamos los "logos de pioneros" inventados por los
// beneficios reales del programa de lanzamiento. No fabricamos clientes — la prueba
// social verdadera la sumamos cuando haya comercios adheridos con su permiso.
function buildBeneficios(config: LandingTenant | null) {
  const isSanPedro = config?.slug === 'sanpedro'
  return [
    {
      icon: Gift,
      title: `${MESES_GRATIS} meses gratis`,
      text: isSanPedro
        ? `Sin tarjeta. Los primeros ${TOTAL_CUPOS} comercios entran sin pagar los primeros ${MESES_GRATIS} meses.`
        : `Sin tarjeta. Los comercios del programa de lanzamiento entran sin pagar los primeros ${MESES_GRATIS} meses.`,
    },
    {
      icon: Lock,
      title: 'Precio congelado',
      text: `Después, ${priceLabel(config)}/mes de por vida, aunque suba para nuevos comercios.`,
    },
    {
      icon: Headphones,
      title: 'Soporte directo',
      text: `Hablás con nosotros, gente de ${cityName(config)}. No con un bot.`,
    },
  ] as const
}

export function SocialProof() {
  const { config } = useTenant()
  const BENEFICIOS = buildBeneficios(config)

  return (
    <section className="border-y border-neutral-200/70 bg-neutral-50/60 px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <AnimatedSection className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent-700">
            <Sparkles size={11} />
            {config?.slug === 'sanpedro'
              ? `Programa de lanzamiento · Primeros ${TOTAL_CUPOS} comercios de ${cityName(config)}`
              : `Programa de lanzamiento · Comercios de ${cityName(config)}`}
          </span>
          <h2 className="text-balance text-base font-semibold leading-snug text-neutral-700 sm:text-lg">
            {config?.slug === 'sanpedro' ? (
              <>Los primeros {TOTAL_CUPOS} comercios entran con{' '}</>
            ) : (
              <>Los comercios del lanzamiento entran con{' '}</>
            )}
            <strong className="text-neutral-900">{MESES_GRATIS} meses gratis</strong> y, después,{' '}
            <strong className="text-neutral-900">{priceLabel(config)}/mes congelado de por vida</strong>
          </h2>
        </AnimatedSection>

        <AnimatedSection delay={120} className="mt-10 grid gap-4 sm:grid-cols-3">
          {BENEFICIOS.map((b) => (
            <div
              key={b.title}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white p-5 text-center ring-1 ring-neutral-200"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-50 text-accent-700">
                <b.icon size={18} />
              </span>
              <p className="text-sm font-bold text-neutral-900">{b.title}</p>
              <p className="text-xs leading-relaxed text-neutral-500">{b.text}</p>
            </div>
          ))}
        </AnimatedSection>

        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-neutral-500">
            {config?.slug === 'sanpedro'
              ? `Ya van ${COMERCIOS_ADHERIDOS} de ${TOTAL_CUPOS} comercios — quedan ${CUPOS_RESTANTES} lugares. Cuando se completen, cierra la oferta de lanzamiento.`
              : 'Sumate ahora: cuando se completen los cupos, cierra la oferta de lanzamiento.'}
          </p>
          <a
            href="#precios"
            className="inline-flex items-center gap-1 text-xs font-bold text-accent-700 underline-offset-4 transition-colors hover:text-accent-900 hover:underline"
          >
            Ver precio de lanzamiento →
          </a>
        </div>
      </div>
    </section>
  )
}
