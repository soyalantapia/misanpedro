import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ArrowRight, Minus, Plus, Sparkles, Store, Pencil } from 'lucide-react'
import { useApiCoupons, useApiMerchants } from '@/lib/apiQueries'
import { useCoupons } from '@/lib/couponsStore'
import { getMerchant } from '@/data/mockData'
import { OCASIONES, getOcasion } from '@/lib/ocasiones'
import { computePlanes, type Plan } from '@/lib/planner'
import type { Categoria, Coupon, Merchant } from '@/lib/types'
import type { ApiCoupon, ApiMerchant } from '@/lib/api'

type Step = 'ganas' | 'presupuesto' | 'resultados'

const MONTOS_RAPIDOS = [5000, 10000, 20000]

function ars(n: number) {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function apiMerchantToLocal(m: ApiMerchant): Merchant {
  return {
    id: m.slug,
    nombre: m.nombre,
    categoria: m.categoria as Categoria,
    direccion: m.direccion,
    lat: m.lat ?? 0,
    lng: m.lng ?? 0,
    telefono: m.telefono,
    horarios: m.horarios,
    horariosDetalle: m.horariosDetalle,
    cover: m.cover,
    coverImageUrl: m.coverImageUrl,
    mapsUrl: m.mapsUrl,
    logoSeed: m.logoSeed,
    destacado: m.destacado,
  }
}

function apiCouponToLocal(c: ApiCoupon, merchantSlug: string): Coupon {
  return {
    id: c.id,
    merchantId: merchantSlug,
    titulo: c.titulo,
    descripcion: c.descripcion,
    condiciones: c.condiciones ?? '',
    porcentaje: c.porcentaje,
    precioReferencia: c.precioReferencia,
    vigenciaHasta: c.vigenciaHasta,
    imagenSeed: 'custom',
    estado: c.estado as Coupon['estado'],
    diasAplica: c.diasAplica,
  }
}

export function PlanPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const montoParam = Number(params.get('monto'))
  // Si venís desde el carrusel del home con una ocasión ya elegida, saltamos
  // directo al paso de presupuesto.
  const presetOcasion = getOcasion(params.get('ocasion'))

  const [step, setStep] = useState<Step>(presetOcasion ? 'presupuesto' : 'ganas')
  const [ocasionId, setOcasionId] = useState<string | null>(presetOcasion?.id ?? null)
  const [presupuesto, setPresupuesto] = useState<number | null>(
    Number.isFinite(montoParam) && montoParam > 0 ? Math.round(montoParam) : null,
  )
  const [personas, setPersonas] = useState(1)

  const apiMerchantsRes = useApiMerchants()
  const apiCouponsRes = useApiCoupons()
  const localCoupons = useCoupons()

  const { coupons, getMerchantById } = useMemo(() => {
    if (apiMerchantsRes.data && apiCouponsRes.data) {
      const merchants = apiMerchantsRes.data.map(apiMerchantToLocal)
      const idToSlug = new Map(apiMerchantsRes.data.map((m) => [m.id, m.slug]))
      const map = new Map(merchants.map((m) => [m.id, m]))
      const cs = apiCouponsRes.data
        .map((c) => {
          const slug = idToSlug.get(c.merchantId) ?? c.merchant?.slug
          return slug ? apiCouponToLocal(c, slug) : null
        })
        .filter((c): c is Coupon => c !== null)
      return { coupons: cs, getMerchantById: (id: string) => map.get(id) }
    }
    return { coupons: localCoupons, getMerchantById: getMerchant }
  }, [apiMerchantsRes.data, apiCouponsRes.data, localCoupons])

  const ocasion = getOcasion(ocasionId)
  const loading = apiMerchantsRes.loading || apiCouponsRes.loading

  const result = useMemo(() => {
    if (!ocasion || !presupuesto) return null
    return computePlanes({ coupons, getMerchantById, ocasion, presupuesto, personas })
  }, [ocasion, presupuesto, personas, coupons, getMerchantById])

  function back() {
    if (step === 'presupuesto') setStep('ganas')
    else if (step === 'resultados') setStep('presupuesto')
    else navigate('/')
  }

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-xl flex-col px-4 pt-5 pb-12 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          aria-label="Volver"
          className="inline-flex items-center gap-1 text-sm font-semibold text-fin-soft hover:text-fin-ink"
        >
          <ChevronLeft size={18} /> {step === 'ganas' ? 'Inicio' : 'Atrás'}
        </button>
        <StepDots step={step} />
      </div>

      <div className="animate-fade-up mt-6 flex flex-1 flex-col">
        {step === 'ganas' && (
          <GanasStep
            onPick={(id) => {
              setOcasionId(id)
              setStep('presupuesto')
            }}
          />
        )}

        {step === 'presupuesto' && (
          <PresupuestoStep
            presupuesto={presupuesto}
            personas={personas}
            onPresupuesto={setPresupuesto}
            onPersonas={setPersonas}
            onNext={() => setStep('resultados')}
          />
        )}

        {step === 'resultados' && ocasion && presupuesto && (
          <ResultadosStep
            ocasionLabel={ocasion.label}
            presupuesto={presupuesto}
            personas={personas}
            loading={loading && coupons.length === 0}
            result={result}
            onEdit={() => setStep('presupuesto')}
            onChangeGanas={() => setStep('ganas')}
            onActivar={(id) => navigate(`/cupon/${id}`)}
          />
        )}
      </div>
    </div>
  )
}

function StepDots({ step }: { step: Step }) {
  const idx = step === 'ganas' ? 0 : step === 'presupuesto' ? 1 : 2
  return (
    <div className="flex items-center gap-1.5" aria-label={`Paso ${idx + 1} de 3`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === idx ? 'w-5 bg-fin-lime' : i < idx ? 'w-1.5 bg-fin-lime/50' : 'w-1.5 bg-fin-line'
          }`}
        />
      ))}
    </div>
  )
}

function GanasStep({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-fin-lime/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-fin-lime">
          <Sparkles size={12} /> Armá tu plan
        </span>
        <h1 className="text-3xl font-black leading-tight tracking-tight text-fin-ink">
          ¿Qué querés hacer hoy?
        </h1>
        <p className="text-sm text-fin-soft">
          Elegí el plan y, con la plata que tengas, te decimos qué te conviene en San Pedro.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {OCASIONES.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className="group flex flex-col items-start gap-2 rounded-3xl bg-fin-surface p-4 text-left ring-1 ring-fin-line shadow-fin-card transition-all hover:-translate-y-0.5 hover:ring-fin-lime/40"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-fin-surface2 text-2xl ring-1 ring-fin-line">
              {o.emoji}
            </span>
            <span className="text-sm font-bold leading-tight text-fin-ink">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PresupuestoStep({
  presupuesto,
  personas,
  onPresupuesto,
  onPersonas,
  onNext,
}: {
  presupuesto: number | null
  personas: number
  onPresupuesto: (n: number | null) => void
  onPersonas: (n: number) => void
  onNext: () => void
}) {
  const isCustom = presupuesto != null && !MONTOS_RAPIDOS.includes(presupuesto)
  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-black leading-tight tracking-tight text-fin-ink">
          ¿Cuánto tenés para gastar?
        </h1>
        <p className="text-sm text-fin-soft">Te mostramos solo planes que entran en ese monto.</p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {MONTOS_RAPIDOS.map((m) => {
          const active = presupuesto === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => onPresupuesto(m)}
              className={`rounded-2xl px-3 py-4 text-center text-base font-bold tabular-nums ring-1 transition-all ${
                active
                  ? 'bg-fin-lime text-fin-bg ring-fin-lime shadow-fin-glow'
                  : 'bg-fin-surface text-fin-ink ring-fin-line hover:-translate-y-0.5'
              }`}
            >
              ${ars(m)}
            </button>
          )
        })}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">
          Otro monto
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-fin-faint">
            $
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={isCustom ? String(presupuesto) : ''}
            onChange={(e) => {
              const v = Number(e.target.value)
              onPresupuesto(e.target.value.trim() && Number.isFinite(v) && v > 0 ? Math.round(v) : null)
            }}
            placeholder="Escribí cuánto tenés"
            className="w-full rounded-2xl bg-fin-surface py-3.5 pl-8 pr-4 text-base font-bold tabular-nums text-fin-ink ring-1 ring-fin-line placeholder:font-normal placeholder:text-fin-faint focus:outline-none focus:ring-2 focus:ring-fin-lime"
          />
        </div>
      </label>

      <div className="flex items-center justify-between rounded-2xl bg-fin-surface p-4 ring-1 ring-fin-line">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-fin-ink">¿Para cuántos?</span>
          <span className="text-[11px] text-fin-soft">Repartimos el gasto por persona.</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onPersonas(Math.max(1, personas - 1))}
            disabled={personas <= 1}
            aria-label="Menos personas"
            className="grid h-9 w-9 place-items-center rounded-full bg-fin-surface2 text-fin-ink ring-1 ring-fin-line disabled:opacity-40"
          >
            <Minus size={16} />
          </button>
          <span className="w-6 text-center text-lg font-black tabular-nums text-fin-ink">
            {personas}
          </span>
          <button
            type="button"
            onClick={() => onPersonas(Math.min(20, personas + 1))}
            disabled={personas >= 20}
            aria-label="Más personas"
            className="grid h-9 w-9 place-items-center rounded-full bg-fin-surface2 text-fin-ink ring-1 ring-fin-line disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="mt-auto pt-2">
        <button
          type="button"
          onClick={onNext}
          disabled={!presupuesto}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-fin-lime px-6 py-4 text-base font-black text-fin-bg shadow-fin-glow transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-fin-surface2 disabled:text-fin-faint disabled:shadow-none"
        >
          Ver mi plan <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}

function ResultadosStep({
  ocasionLabel,
  presupuesto,
  personas,
  loading,
  result,
  onEdit,
  onChangeGanas,
  onActivar,
}: {
  ocasionLabel: string
  presupuesto: number
  personas: number
  loading: boolean
  result: ReturnType<typeof computePlanes> | null
  onEdit: () => void
  onChangeGanas: () => void
  onActivar: (couponId: string) => void
}) {
  const primarios = result?.primarios ?? []
  const secundarios = result?.secundarios ?? []
  const vacio = !loading && primarios.length === 0 && secundarios.length === 0

  return (
    <div className="flex flex-col gap-4">
      {/* Recap editable */}
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center justify-between gap-3 rounded-2xl bg-fin-surface2 px-4 py-2.5 text-left ring-1 ring-fin-line"
      >
        <span className="text-sm text-fin-soft">
          <span className="font-bold text-fin-ink">{ocasionLabel}</span> · ${ars(presupuesto)} ·{' '}
          {personas} {personas === 1 ? 'persona' : 'personas'}
        </span>
        <Pencil size={14} className="shrink-0 text-fin-lime" />
      </button>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-3xl bg-fin-surface"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      ) : vacio ? (
        <EmptyPlan onEdit={onEdit} onChangeGanas={onChangeGanas} />
      ) : (
        <>
          {primarios.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-fin-lime">
                Tu plan entra justo
              </h2>
              {primarios.map((p) => (
                <PlanCard key={p.coupon.id} plan={p} personas={personas} onActivar={onActivar} primary />
              ))}
            </div>
          )}

          {secundarios.length > 0 && (
            <div className="mt-2 flex flex-col gap-3">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">
                También te puede servir
              </h2>
              {secundarios.map((p) => (
                <PlanCard key={p.coupon.id} plan={p} personas={personas} onActivar={onActivar} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PlanCard({
  plan,
  personas,
  onActivar,
  primary,
}: {
  plan: Plan
  personas: number
  onActivar: (couponId: string) => void
  primary?: boolean
}) {
  const { coupon, merchant, total, ahorro } = plan
  return (
    <div
      className={`overflow-hidden rounded-3xl bg-fin-surface ring-1 shadow-fin-card ${
        primary ? 'ring-fin-lime/30' : 'ring-fin-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-fin-soft">
            <Store size={11} className="text-fin-lime" /> {merchant.nombre}
          </p>
          <h3 className="mt-0.5 text-base font-bold leading-tight text-fin-ink">{coupon.titulo}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-fin-lime/15 px-2.5 py-1 text-xs font-black tabular-nums text-fin-lime ring-1 ring-fin-lime/30">
          {coupon.porcentaje}% OFF
        </span>
      </div>

      {total != null && ahorro != null && (
        <div className="flex items-center justify-between border-t border-fin-line px-4 py-2.5 text-sm">
          <span className="text-fin-soft">
            Te sale <span className="font-bold text-fin-ink tabular-nums">~${ars(total)}</span>
            {personas > 1 && <span className="text-fin-faint"> para {personas}</span>}
          </span>
          <span className="font-bold text-fin-up tabular-nums">Ahorrás ${ars(ahorro)}</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => onActivar(coupon.id)}
        className="flex w-full items-center justify-center gap-1.5 bg-fin-surface2 px-4 py-3 text-sm font-bold text-fin-ink transition-colors hover:text-fin-lime"
      >
        Activar este cupón <ArrowRight size={15} />
      </button>
    </div>
  )
}

function EmptyPlan({ onEdit, onChangeGanas }: { onEdit: () => void; onChangeGanas: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-fin-surface p-8 text-center ring-1 ring-fin-line">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-fin-surface2 text-3xl">🧐</span>
      <div>
        <p className="text-base font-bold text-fin-ink">No encontramos un plan para eso todavía</p>
        <p className="mt-1 text-sm text-fin-soft">
          Probá subir un poco el presupuesto o cambiar lo que querés hacer.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="w-full rounded-2xl bg-fin-lime px-4 py-3 text-sm font-bold text-fin-bg shadow-fin-glow transition-all hover:-translate-y-0.5"
        >
          Subir el presupuesto
        </button>
        <button
          type="button"
          onClick={onChangeGanas}
          className="w-full rounded-2xl bg-fin-surface2 px-4 py-3 text-sm font-bold text-fin-ink ring-1 ring-fin-line"
        >
          Cambiar las ganas
        </button>
      </div>
      <Link to="/" className="text-xs font-semibold text-fin-soft hover:text-fin-ink">
        Volver a ver todos los descuentos
      </Link>
    </div>
  )
}
