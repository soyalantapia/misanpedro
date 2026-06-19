import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search, Loader2, MapPin } from 'lucide-react'

export type LatLng = { lat: number; lng: number }

/**
 * Picker de ubicación para el alta de comercio (panel admin, tema claro).
 *
 * El comercio escribe su dirección arriba (campo `direccion`), toca "Buscar
 * dirección" para geocodificarla vía Nominatim/OSM y luego arrastra el pin
 * hasta la puerta exacta. Si la geocodificación falla, igual puede tocar el
 * mapa para soltar el pin a mano. Las coordenadas resultantes se guardan en
 * el form del signup y viajan al backend — así cada comercio cae en su punto
 * real y no todos apilados en el centro de la ciudad.
 */

/** Pin tipo "gota" en color de marca (consistente con el resto del panel). */
const locationIcon = L.divIcon({
  className: 'msp-loc-pin',
  html: `<svg width="38" height="38" viewBox="0 0 24 24" stroke="#ffffff" stroke-width="1.6" style="fill:var(--color-brand);filter:drop-shadow(0 3px 5px color-mix(in srgb, var(--color-brand) 45%, transparent))"><path d="M12 21.5s7-6.4 7-11.5a7 7 0 1 0-14 0c0 5.1 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.6" fill="#ffffff" stroke="none"/></svg>`,
  iconSize: [38, 38],
  iconAnchor: [19, 36],
})

/** Recentra el mapa sólo cuando llega una nueva geocodificación (no al arrastrar). */
function FlyTo({ target }: { target: { lat: number; lng: number; nonce: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], 16)
  }, [target, map])
  return null
}

/** Soltar/mover el pin tocando el mapa. */
function ClickToPlace({ onPick }: { onPick: (ll: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

/** El contenedor del mapa puede montar con tamaño 0 (animación de entrada); forzamos un relayout. */
function InvalidateOnMount() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 220)
    return () => clearTimeout(t)
  }, [map])
  return null
}

export function LocationPicker({
  value,
  onChange,
  address,
  center,
  cityHint,
}: {
  value: LatLng | null
  onChange: (ll: LatLng) => void
  /** Dirección tipeada arriba en el form, para geocodificar. */
  address: string
  /** Centro del tenant — centro inicial del mapa cuando no hay pin todavía. */
  center: LatLng
  /** Ciudad/provincia para sesgar la búsqueda (ej: "San Pedro, Buenos Aires"). */
  cityHint: string
}) {
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; nonce: number } | null>(null)
  const autoTriedRef = useRef<string>('')

  async function geocode() {
    if (address.trim().length < 4) {
      setError('Escribí primero la dirección arriba para buscarla.')
      return
    }
    setGeocoding(true)
    setError(null)
    try {
      const q = [address.trim(), cityHint, 'Argentina'].filter(Boolean).join(', ')
      const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
      const arr = (await res.json()) as Array<{ lat: string; lon: string }>
      const hit = Array.isArray(arr) ? arr[0] : undefined
      if (hit) {
        const ll = { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) }
        onChange(ll)
        setFlyTo({ ...ll, nonce: Date.now() })
      } else {
        setError('No encontramos esa dirección. Tocá el mapa para marcar el punto a mano.')
      }
    } catch {
      setError('No pudimos buscar la dirección. Tocá el mapa para marcar el punto a mano.')
    } finally {
      setGeocoding(false)
    }
  }

  // PM-elite T2: geocodificamos SOLA la dirección (debounce). Si todavía no hay
  // pin y la dirección es razonable, la buscamos automáticamente para que el
  // comercio no tenga que tocar el mapa. Una vez por dirección; si ya hay pin
  // (lo marcó o lo movió) no lo pisamos.
  useEffect(() => {
    const q = address.trim()
    if (value || q.length < 6) return
    if (autoTriedRef.current === q) return
    const t = setTimeout(() => {
      autoTriedRef.current = q
      void geocode()
    }, 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, value])

  const initialCenter: [number, number] = value ? [value.lat, value.lng] : [center.lat, center.lng]

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={geocode}
        disabled={geocoding}
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[11px] font-bold text-brand-strong ring-1 ring-line transition-colors hover:bg-brand-soft disabled:opacity-60"
      >
        {geocoding ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
        {geocoding ? 'Buscando…' : 'Buscar dirección en el mapa'}
      </button>

      <div className="overflow-hidden rounded-2xl ring-1 ring-line">
        <MapContainer
          center={initialCenter}
          zoom={value ? 16 : 14}
          scrollWheelZoom={false}
          style={{ height: 240, width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <InvalidateOnMount />
          <FlyTo target={flyTo} />
          <ClickToPlace onPick={onChange} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={locationIcon}
              draggable
              eventHandlers={{
                dragend(e) {
                  const ll = e.target.getLatLng()
                  onChange({ lat: ll.lat, lng: ll.lng })
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {error ? (
        <p role="alert" className="text-[11px] font-semibold text-status-error-fg">
          {error}
        </p>
      ) : value ? (
        <p className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
          <MapPin size={11} className="text-brand-strong" />
          Arrastrá el pin para ajustarlo a la puerta exacta de tu comercio.
        </p>
      ) : (
        <p className="text-[11px] text-ink-soft">
          Buscá tu dirección o tocá el mapa para marcar dónde está tu comercio.
        </p>
      )}
    </div>
  )
}
