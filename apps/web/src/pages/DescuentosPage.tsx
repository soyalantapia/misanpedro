import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, SlidersHorizontal, X, Sparkles } from 'lucide-react'
import { MERCHANTS, getMerchant } from '@/data/mockData'
import { useCoupons } from '@/lib/couponsStore'
import { type View } from '@/components/ViewToggle'
import { CategoryChips } from '@/components/CategoryChips'
import { CouponCard } from '@/components/CouponCard'
import { MerchantCard } from '@/components/MerchantCard'
import { EmptyState } from '@/components/EmptyState'
import { FilterSheet, type SortMode, type MinPct } from '@/components/FilterSheet'
import { useGeolocation, distanceKm } from '@/lib/geo'
import { CATEGORIAS, type Categoria, type Coupon, type Merchant } from '@/lib/types'
import { useApiMerchants, useApiCoupons } from '@/lib/apiQueries'
import type { ApiMerchant, ApiCoupon } from '@/lib/api'
import { SavingsWallet } from '@/components/features/SavingsWallet'
import { OCASIONES } from '@/lib/ocasiones'

/** Timestamp (ms) embebido en un ObjectId de Mongo — para ordenar "más nuevos". */
function objectIdTime(id: string): number {
  if (typeof id !== 'string' || id.length < 8) return 0
  const ts = parseInt(id.slice(0, 8), 16)
  return Number.isFinite(ts) ? ts * 1000 : 0
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
    imagenUrl: c.imagenUrl ?? undefined,
    estado: c.estado as Coupon['estado'],
    diasAplica: c.diasAplica,
  }
}

export function DescuentosPage({ mode = 'cupones' }: { mode?: 'cupones' | 'locales' }) {
  // La vista la define la ruta: "/" = cupones, "/locales" = locales.
  const view: View = mode === 'locales' ? 'local' : 'descuento'
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [categoria, setCategoria] = useState<Categoria | null>(null)
  const [minPct, setMinPct] = useState<MinPct>(0)
  const [sort, setSort] = useState<SortMode>('descuento')
  const [sheetOpen, setSheetOpen] = useState(false)
  const { state: geo, request: requestGeo } = useGeolocation()
  const localCoupons = useCoupons()
  const apiMerchantsRes = useApiMerchants()
  const apiCouponsRes = useApiCoupons()

  // Si el API responde, usamos sus datos; si está caído, fallback al store local.
  const { merchants, COUPONS, getMerchantById } = useMemo(() => {
    if (apiMerchantsRes.data && apiCouponsRes.data) {
      const apiMerchants = apiMerchantsRes.data.map(apiMerchantToLocal)
      const idToSlug = new Map(apiMerchantsRes.data.map((m) => [m.id, m.slug]))
      const apiCouponsLocal = apiCouponsRes.data
        .map((c) => {
          const slug = idToSlug.get(c.merchantId) ?? c.merchant?.slug
          if (!slug) return null
          return apiCouponToLocal(c, slug)
        })
        .filter((c): c is Coupon => c !== null)
      const map = new Map(apiMerchants.map((m) => [m.id, m]))
      return {
        merchants: apiMerchants,
        COUPONS: apiCouponsLocal,
        getMerchantById: (id: string) => map.get(id),
      }
    }
    return {
      merchants: MERCHANTS,
      COUPONS: localCoupons,
      getMerchantById: getMerchant,
    }
  }, [apiMerchantsRes.data, apiCouponsRes.data, localCoupons])

  const userCoords = geo.status === 'granted' ? geo.coords : null
  const geoAvailable = geo.status === 'granted'

  // Si elige "cerca" pero no hay geo, lo pasamos a descuento para no romper el orden.
  const effectiveSort: SortMode = sort === 'cerca' && !userCoords ? 'descuento' : sort

  function distOf(m: Merchant | undefined): number {
    if (!m || !userCoords || !m.lat || !m.lng) return Number.POSITIVE_INFINITY
    return distanceKm(userCoords, { lat: m.lat, lng: m.lng })
  }

  // ─── Filtro unificado: categoría + % mínimo + búsqueda ──────────────
  const passingByMerchant = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    const byMerchant = new Map<string, Coupon[]>()
    for (const c of COUPONS) {
      if (c.estado !== 'activo') continue
      const m = getMerchantById(c.merchantId)
      if (!m) continue
      if (categoria && m.categoria !== categoria) continue
      if (c.porcentaje < minPct) continue
      if (q) {
        const catLabel = CATEGORIAS.find((cat) => cat.id === m.categoria)?.label.toLowerCase() ?? ''
        const hit =
          c.titulo.toLowerCase().includes(q) ||
          c.descripcion.toLowerCase().includes(q) ||
          m.nombre.toLowerCase().includes(q) ||
          catLabel.includes(q)
        if (!hit) continue
      }
      const arr = byMerchant.get(m.id)
      if (arr) arr.push(c)
      else byMerchant.set(m.id, [c])
    }
    return byMerchant
  }, [deferredSearch, categoria, minPct, COUPONS, getMerchantById])

  const filteredCoupons = useMemo(() => {
    const all = [...passingByMerchant.values()].flat()
    all.sort((a, b) => {
      if (effectiveSort === 'descuento') return b.porcentaje - a.porcentaje
      if (effectiveSort === 'nuevos') return objectIdTime(b.id) - objectIdTime(a.id)
      return distOf(getMerchantById(a.merchantId)) - distOf(getMerchantById(b.merchantId))
    })
    return all
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passingByMerchant, effectiveSort, userCoords])

  const filteredMerchants = useMemo(() => {
    const list = merchants.filter((m) => passingByMerchant.has(m.id))
    list.sort((a, b) => {
      if (effectiveSort === 'cerca') return distOf(a) - distOf(b)
      const aC = passingByMerchant.get(a.id) ?? []
      const bC = passingByMerchant.get(b.id) ?? []
      if (effectiveSort === 'nuevos') {
        const aN = Math.max(0, ...aC.map((c) => objectIdTime(c.id)))
        const bN = Math.max(0, ...bC.map((c) => objectIdTime(c.id)))
        return bN - aN
      }
      const aMax = Math.max(0, ...aC.map((c) => c.porcentaje))
      const bMax = Math.max(0, ...bC.map((c) => c.porcentaje))
      return bMax - aMax
    })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchants, passingByMerchant, effectiveSort, userCoords])

  const visibleCouponsCount = useMemo(
    () =>
      COUPONS.filter((c) => c.estado === 'activo' && !!getMerchantById(c.merchantId)).length,
    [COUPONS, getMerchantById],
  )
  const isGlobalEmpty = merchants.length === 0 && visibleCouponsCount === 0
  const isLoading = apiMerchantsRes.loading || apiCouponsRes.loading

  const activeFilterCount = (minPct > 0 ? 1 : 0) + (sort !== 'descuento' ? 1 : 0)
  const resultCount = view === 'descuento' ? filteredCoupons.length : filteredMerchants.length

  if (isLoading && localCoupons.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-5 pb-8 sm:px-6 sm:pt-8">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-56 animate-pulse rounded-2xl bg-fin-surface2" />
          <div className="h-4 w-44 animate-pulse rounded-full bg-fin-surface" />
        </div>
        <div className="h-24 w-full animate-pulse rounded-3xl bg-fin-surface" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-fin-surface" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl bg-fin-surface" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-5 pb-8 sm:px-6 sm:pt-8">
      {/* Héroe: billetera de ahorro del vecino (solo en Cupones) */}
      {mode === 'cupones' && <SavingsWallet />}

      {mode === 'locales' && (
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-fin-ink">Locales</h1>
          <p className="text-sm text-fin-soft">Comercios adheridos de San Pedro.</p>
        </header>
      )}

      {isGlobalEmpty ? (
        <EmptyState
          icon={Search}
          title="Aún no hay comercios cargados"
          description="Estamos sumando los primeros comercios de tu ciudad. Volvé en unos días o avisanos qué local te gustaría ver."
        />
      ) : (
        <>
          <SearchBar search={search} onSearch={setSearch} />

          {/* Categorías a pantalla completa. Ubicación + Filtros ocultos por
              ahora — se reubican más adelante (NO borrar). */}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <CategoryChips selected={categoria} onChange={setCategoria} />
            </div>
            <div className="hidden">
              <GeoButton state={geo.status} onRequest={requestGeo} />
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full bg-fin-surface2 px-3.5 py-2 text-xs font-bold text-fin-ink ring-1 ring-fin-line transition-all hover:-translate-y-0.5"
              >
                <SlidersHorizontal size={13} className="text-fin-lime" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-fin-lime px-1 text-[10px] font-bold text-fin-bg">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Chips de filtros activos (removibles) */}
          {(categoria || minPct > 0) && (
            <div className="-mt-1 flex flex-wrap items-center gap-2">
              {categoria && (
                <FilterPill onClear={() => setCategoria(null)}>
                  {CATEGORIAS.find((c) => c.id === categoria)?.label ?? categoria}
                </FilterPill>
              )}
              {minPct > 0 && (
                <FilterPill onClear={() => setMinPct(0)}>{minPct}%+ off</FilterPill>
              )}
              <button
                type="button"
                onClick={() => {
                  setCategoria(null)
                  setMinPct(0)
                  setSort('descuento')
                }}
                className="text-xs font-semibold text-fin-soft hover:text-fin-ink"
              >
                Limpiar
              </button>
            </div>
          )}

        </>
      )}

      {/* Contenido por vista */}
      {!isGlobalEmpty &&
        (view === 'descuento' ? (
          filteredCoupons.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No encontramos descuentos"
              description={
                categoria || search || minPct > 0
                  ? 'Probá quitar algún filtro o cambiar la búsqueda.'
                  : 'Pronto vamos a sumar más comercios al programa.'
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(() => {
                const cards = filteredCoupons.flatMap((c, i) => {
                  const m = getMerchantById(c.merchantId)
                  if (!m) return []
                  const dist =
                    userCoords && m.lat && m.lng
                      ? distanceKm(userCoords, { lat: m.lat, lng: m.lng })
                      : undefined
                  return [
                    <CouponCard key={c.id} coupon={c} merchant={m} distanceKm={dist} index={i} />,
                  ]
                })
                // "Armá tu plan" como corte en la 3ª fila (tras ~4 cupones).
                cards.splice(
                  Math.min(4, cards.length),
                  0,
                  <div key="planner-carousel" className="sm:col-span-2">
                    <PlannerCarousel />
                  </div>,
                )
                return cards
              })()}
            </div>
          )
        ) : filteredMerchants.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No encontramos comercios"
            description={
              categoria || search || minPct > 0
                ? 'Probá quitar algún filtro o cambiar la búsqueda.'
                : 'Pronto vamos a sumar más comercios al programa.'
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredMerchants.map((m, i) => {
              const coupons = passingByMerchant.get(m.id) ?? []
              if (coupons.length === 0) return null
              const dist =
                userCoords && m.lat && m.lng
                  ? distanceKm(userCoords, { lat: m.lat, lng: m.lng })
                  : undefined
              return <MerchantCard key={m.id} merchant={m} coupons={coupons} distanceKm={dist} index={i} />
            })}
          </div>
        ))}

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        minPct={minPct}
        onMinPct={setMinPct}
        sort={sort}
        onSort={setSort}
        geoAvailable={geoAvailable}
        onClearAll={() => {
          setMinPct(0)
          setSort('descuento')
          setCategoria(null)
        }}
        resultCount={resultCount}
      />
    </div>
  )
}

/**
 * Corte "Armá tu plan" dentro de la grilla de cupones (≈3ª fila): muestra
 * directamente las ocasiones como carrusel horizontal. Tocás una y vas
 * derecho al planificador con esa ocasión ya elegida.
 */
function PlannerCarousel() {
  const navigate = useNavigate()
  return (
    <div className="bg-fin-mesh relative overflow-hidden rounded-3xl bg-fin-surface p-4 ring-1 ring-fin-lime/30 shadow-fin-card">
      <div className="bg-fin-grid absolute inset-0 opacity-60" />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fin-lime text-fin-bg shadow-fin-glow">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-fin-lime">
              Armá tu plan
            </p>
            <p className="text-base font-extrabold leading-tight text-fin-ink">
              ¿Qué querés hacer hoy?
            </p>
          </div>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {OCASIONES.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => navigate(`/plan?ocasion=${o.id}`)}
              className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-fin-surface2 px-3.5 py-2.5 text-xs font-bold text-fin-ink ring-1 ring-fin-line transition-all hover:-translate-y-0.5 hover:ring-fin-lime/40"
            >
              <span className="text-base leading-none">{o.emoji}</span>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function FilterPill({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-fin-surface2 py-1 pl-3 pr-1.5 text-xs font-semibold text-fin-ink ring-1 ring-fin-line">
      {children}
      <button
        type="button"
        onClick={onClear}
        aria-label="Quitar filtro"
        className="grid h-4 w-4 place-items-center rounded-full bg-fin-line text-fin-soft hover:text-fin-ink"
      >
        <X size={10} />
      </button>
    </span>
  )
}

function SearchBar({ search, onSearch }: { search: string; onSearch: (v: string) => void }) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fin-faint"
      />
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar comercio o descuento"
        aria-label="Buscar comercios o descuentos"
        className="w-full rounded-2xl bg-fin-surface py-3.5 pl-10 pr-12 text-sm text-fin-ink ring-1 ring-fin-line placeholder:text-fin-faint focus:outline-none focus:ring-2 focus:ring-fin-lime"
      />
      {search && (
        <button
          type="button"
          onClick={() => onSearch('')}
          className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-fin-surface2 text-fin-soft transition-colors hover:text-fin-ink"
          aria-label="Limpiar búsqueda"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

function GeoButton({
  state,
  onRequest,
}: {
  state: ReturnType<typeof useGeolocation>['state']['status']
  onRequest: () => void
}) {
  const granted = state === 'granted'
  const off = state === 'denied' || state === 'unavailable'
  const tone = granted
    ? 'bg-fin-lime/15 text-fin-lime ring-fin-lime/30'
    : off
      ? 'bg-fin-surface2 text-fin-faint ring-fin-line opacity-60'
      : 'bg-fin-surface2 text-fin-soft ring-fin-line hover:-translate-y-0.5 hover:text-fin-ink'
  return (
    <button
      type="button"
      onClick={onRequest}
      disabled={state === 'pending' || off}
      aria-label={granted ? 'Distancias activadas' : off ? 'Ubicación no disponible' : 'Ver distancias'}
      title={
        granted ? 'Mostrando distancias' : off ? 'Activá la ubicación en el navegador' : 'Ver distancias'
      }
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 transition-all duration-200 ${tone}`}
    >
      <MapPin size={15} className={state === 'pending' ? 'animate-pulse' : ''} />
    </button>
  )
}
