import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Sparkles, Pencil, Search, WifiOff, RotateCw } from 'lucide-react'
import { useApiCoupons, useApiMerchants } from '@/lib/apiQueries'
import { useCoupons } from '@/lib/couponsStore'
import { getMerchant } from '@/data/mockData'
import { OCASIONES, getOcasion, type Ocasion } from '@/lib/ocasiones'
import { cuponesDeOcasion, type CuponMatch } from '@/lib/planner'
import { CouponCard } from '@/components/CouponCard'
import { EmptyState } from '@/components/EmptyState'
import type { Categoria, Coupon, Merchant } from '@/lib/types'
import type { ApiMerchant } from '@/lib/api'
import { apiCouponToLocal } from '@/lib/apiCoupon'

type Step = 'ganas' | 'resultados'

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

export function PlanPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Si venís desde el carrusel del home con una ocasión ya elegida, saltamos
  // directo a los resultados.
  const presetOcasion = getOcasion(params.get('ocasion'))

  const [step, setStep] = useState<Step>(presetOcasion ? 'resultados' : 'ganas')
  const [ocasionId, setOcasionId] = useState<string | null>(presetOcasion?.id ?? null)

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
  const apiError = apiMerchantsRes.error || apiCouponsRes.error
  // Backend caído sin datos para mostrar: no mentimos con "estamos sumando comercios".
  const sinConexion = !!apiError && coupons.length === 0

  function reintentar() {
    apiMerchantsRes.refetch()
    apiCouponsRes.refetch()
  }

  const matches = useMemo(() => {
    if (!ocasion) return []
    return cuponesDeOcasion({ coupons, getMerchantById, ocasion })
  }, [ocasion, coupons, getMerchantById])

  function back() {
    if (step === 'resultados') setStep('ganas')
    else navigate('/')
  }

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-2xl flex-col px-4 pt-5 pb-12 sm:px-6">
      {/* Header */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={back}
          aria-label="Volver"
          className="inline-flex items-center gap-1 text-sm font-semibold text-fin-soft hover:text-fin-ink"
        >
          <ChevronLeft size={18} /> {step === 'ganas' ? 'Inicio' : 'Atrás'}
        </button>
      </div>

      <div className="animate-fade-up mt-6 flex flex-1 flex-col">
        {step === 'ganas' && (
          <GanasStep
            onPick={(id) => {
              setOcasionId(id)
              setStep('resultados')
            }}
          />
        )}

        {step === 'resultados' && ocasion && (
          <ResultadosStep
            ocasion={ocasion}
            loading={loading && coupons.length === 0}
            sinConexion={sinConexion}
            onReintentar={reintentar}
            matches={matches}
            onChangeGanas={() => setStep('ganas')}
          />
        )}
      </div>
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
          Elegí qué tenés ganas de hacer y te mostramos los cupones que te sirven en San Pedro.
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

function ResultadosStep({
  ocasion,
  loading,
  sinConexion,
  onReintentar,
  matches,
  onChangeGanas,
}: {
  ocasion: Ocasion
  loading: boolean
  sinConexion: boolean
  onReintentar: () => void
  matches: CuponMatch[]
  onChangeGanas: () => void
}) {
  const vacio = !loading && !sinConexion && matches.length === 0

  return (
    <div className="flex flex-col gap-4">
      {/* Recap editable: qué estás buscando */}
      <button
        type="button"
        onClick={onChangeGanas}
        className="flex items-center justify-between gap-3 rounded-2xl bg-fin-surface2 px-4 py-2.5 text-left ring-1 ring-fin-line"
      >
        <span className="flex items-center gap-2 text-sm text-fin-soft">
          <span className="text-lg leading-none">{ocasion.emoji}</span>
          <span className="font-bold text-fin-ink">{ocasion.label}</span>
          {!loading && (
            <span className="text-fin-faint">
              · {matches.length} {matches.length === 1 ? 'cupón' : 'cupones'}
            </span>
          )}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-fin-lime">
          <Pencil size={13} /> Cambiar
        </span>
      </button>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-3xl bg-fin-surface"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      ) : sinConexion ? (
        <EmptyState
          icon={WifiOff}
          title="Sin conexión"
          description="No pudimos cargar los cupones. Revisá tu conexión y reintentá."
          action={
            <button
              type="button"
              onClick={onReintentar}
              className="inline-flex items-center gap-2 rounded-2xl bg-fin-lime px-5 py-3 text-sm font-bold text-fin-bg transition-all hover:-translate-y-0.5"
            >
              <RotateCw size={16} /> Reintentar
            </button>
          }
        />
      ) : vacio ? (
        <EmptyState
          icon={Search}
          title={`Todavía no hay cupones para "${ocasion.label}"`}
          description="Estamos sumando comercios. Probá con otra cosa o mirá todos los cupones disponibles."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-brand to-brand-strong px-5 py-2.5 text-sm font-bold text-on-brand shadow-cta transition-all duration-200 hover:-translate-y-0.5"
            >
              <Sparkles size={14} /> Ver todos los cupones
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-[11px] font-bold uppercase tracking-widest text-fin-lime">
            Los que más te rinden
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {matches.map((m, i) => (
              <CouponCard
                key={m.coupon.id}
                coupon={m.coupon}
                merchant={m.merchant}
                index={i}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
