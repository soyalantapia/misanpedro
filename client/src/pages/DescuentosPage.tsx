import { useEffect, useMemo, useState } from 'react'
import { Search, MapPin, Sparkles, X } from 'lucide-react'
import { COUPONS, MERCHANTS, getMerchant } from '@/data/mockData'
import { ViewToggle, type View } from '@/components/ViewToggle'
import { CategoryChips } from '@/components/CategoryChips'
import { CouponCard } from '@/components/CouponCard'
import { MerchantCard } from '@/components/MerchantCard'
import { EmptyState } from '@/components/EmptyState'
import { useGeolocation, distanceKm } from '@/lib/geo'
import { CATEGORIAS, type Categoria } from '@/lib/types'

const VIEW_KEY = 'misanpedro.view'

export function DescuentosPage() {
  const [view, setView] = useState<View>(() => {
    if (typeof window === 'undefined') return 'descuento'
    return (window.localStorage.getItem(VIEW_KEY) as View) ?? 'descuento'
  })
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState<Categoria | null>(null)
  const { state: geo, request: requestGeo } = useGeolocation()

  useEffect(() => {
    window.localStorage.setItem(VIEW_KEY, view)
  }, [view])

  const userCoords = geo.status === 'granted' ? geo.coords : null

  const filteredCoupons = useMemo(() => {
    const q = search.trim().toLowerCase()
    return COUPONS.filter((c) => {
      if (c.estado !== 'activo') return false
      const m = getMerchant(c.merchantId)
      if (!m) return false
      if (categoria && m.categoria !== categoria) return false
      if (!q) return true
      return (
        c.titulo.toLowerCase().includes(q) ||
        m.nombre.toLowerCase().includes(q) ||
        (CATEGORIAS.find((cat) => cat.id === m.categoria)?.label.toLowerCase().includes(q) ?? false)
      )
    })
  }, [search, categoria])

  const filteredMerchants = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MERCHANTS.filter((m) => {
      if (categoria && m.categoria !== categoria) return false
      if (!q) return true
      return (
        m.nombre.toLowerCase().includes(q) ||
        (CATEGORIAS.find((cat) => cat.id === m.categoria)?.label.toLowerCase().includes(q) ?? false)
      )
    })
  }, [search, categoria])

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <div className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <Sparkles size={12} /> Descuentos vigentes
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Descubrí descuentos en San&nbsp;Pedro
        </h1>
        <p className="text-base text-neutral-500">
          {MERCHANTS.length} comercios adheridos · {COUPONS.length} cupones activos.
        </p>
      </div>

      <SearchBar search={search} onSearch={setSearch} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ViewToggle value={view} onChange={setView} />
        <GeoButton state={geo.status} onRequest={requestGeo} />
      </div>

      <CategoryChips selected={categoria} onChange={setCategoria} />

      {view === 'descuento' ? (
        filteredCoupons.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No encontramos descuentos"
            description={
              categoria || search
                ? 'Probá quitar el filtro o cambiar la búsqueda.'
                : 'Pronto vamos a sumar más comercios al programa.'
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredCoupons.map((c, i) => {
              const m = getMerchant(c.merchantId)!
              const dist = userCoords
                ? distanceKm(userCoords, { lat: m.lat, lng: m.lng })
                : undefined
              return (
                <CouponCard
                  key={c.id}
                  coupon={c}
                  merchant={m}
                  distanceKm={dist}
                  index={i}
                />
              )
            })}
          </div>
        )
      ) : filteredMerchants.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No encontramos comercios"
          description={
            categoria || search
              ? 'Probá quitar el filtro o cambiar la búsqueda.'
              : 'Pronto vamos a sumar más comercios al programa.'
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredMerchants.map((m, i) => {
            const coupons = COUPONS.filter(
              (c) => c.merchantId === m.id && c.estado === 'activo',
            )
            if (coupons.length === 0) return null
            const dist = userCoords
              ? distanceKm(userCoords, { lat: m.lat, lng: m.lng })
              : undefined
            return (
              <MerchantCard
                key={m.id}
                merchant={m}
                coupons={coupons}
                distanceKm={dist}
                index={i}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function SearchBar({
  search,
  onSearch,
}: {
  search: string
  onSearch: (v: string) => void
}) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
      />
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar comercios o rubros…"
        className="w-full rounded-2xl bg-white py-3.5 pl-10 pr-12 text-sm text-neutral-900 shadow-card ring-1 ring-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
      />
      {search && (
        <button
          type="button"
          onClick={() => onSearch('')}
          className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-primary-100 text-neutral-500 transition-colors hover:bg-primary-200 hover:text-neutral-800"
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
  if (state === 'granted') {
    return (
      <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-status-success-fg">
        <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
        Mostrando distancias
      </p>
    )
  }
  if (state === 'denied' || state === 'unavailable') {
    return (
      <p className="text-[11px] text-neutral-400">
        Sin ubicación · activala desde el navegador para ver distancias
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={onRequest}
      disabled={state === 'pending'}
      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-accent-700 shadow-card ring-1 ring-neutral-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-50 disabled:opacity-50"
    >
      <MapPin size={13} />
      {state === 'pending' ? 'Pidiendo…' : 'Ver distancias'}
    </button>
  )
}
