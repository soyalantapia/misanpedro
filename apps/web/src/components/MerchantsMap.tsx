import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'
import { CATEGORIAS, type Coupon, type Merchant } from '@/lib/types'
import type { Coords } from '@/lib/geo'

const SANPEDRO: [number, number] = [-33.6797, -59.6669]

function merchantIcon(label: string) {
  return L.divIcon({
    className: 'msp-pin',
    html: `<div style="width:38px;height:38px;border-radius:9999px;background:linear-gradient(135deg,#7e74e7,#5347c8);box-shadow:0 4px 10px -2px rgba(105,94,222,.6);border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;font-family:Satoshi,system-ui,sans-serif;line-height:1;">${label}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  })
}

function userIcon() {
  return L.divIcon({
    className: 'msp-user',
    html: `<div style="width:18px;height:18px;border-radius:9999px;background:#0ea5e9;border:3px solid #fff;box-shadow:0 0 0 4px rgba(14,165,233,.3);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 15)
      return
    }
    map.fitBounds(points, { padding: [48, 48], maxZoom: 16 })
  }, [map, points])
  return null
}

export default function MerchantsMap({
  merchants,
  coupons,
  userCoords,
  center,
}: {
  merchants: Merchant[]
  coupons: Coupon[]
  userCoords: Coords | null
  center?: { lat: number; lng: number }
}) {
  const pins = useMemo(() => {
    return merchants
      .filter((m) => m.lat && m.lng)
      .map((m) => {
        const own = coupons.filter((c) => c.merchantId === m.id && c.estado === 'activo')
        const maxPct = own.reduce((mx, c) => Math.max(mx, c.porcentaje), 0)
        return { m, maxPct, count: own.length }
      })
      .filter((p) => p.count > 0)
  }, [merchants, coupons])

  const points = useMemo<[number, number][]>(
    () => pins.map((p) => [p.m.lat, p.m.lng]),
    [pins],
  )

  const initialCenter: [number, number] = userCoords
    ? [userCoords.lat, userCoords.lng]
    : center
      ? [center.lat, center.lng]
      : points[0] ?? SANPEDRO

  return (
    <div
      className="overflow-hidden rounded-3xl shadow-card ring-1 ring-neutral-100"
      style={{ height: 'min(68vh, 560px)' }}
    >
      <MapContainer
        center={initialCenter}
        zoom={14}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {userCoords && (
          <Marker position={[userCoords.lat, userCoords.lng]} icon={userIcon()}>
            <Popup>Estás acá</Popup>
          </Marker>
        )}
        {pins.map(({ m, maxPct, count }) => {
          const catLabel = CATEGORIAS.find((c) => c.id === m.categoria)?.label ?? m.categoria
          return (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={merchantIcon(maxPct > 0 ? `${maxPct}%` : '•')}>
              <Popup>
                <div className="min-w-[180px]">
                  <p className="text-sm font-bold text-neutral-900">{m.nombre}</p>
                  <p className="text-[11px] text-neutral-500">
                    {catLabel} · {count} {count === 1 ? 'cupón' : 'cupones'}
                  </p>
                  {maxPct > 0 && (
                    <p className="mt-1.5 inline-block rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-bold text-accent-700">
                      Hasta {maxPct}% OFF
                    </p>
                  )}
                  <Link
                    to={`/comercio/${m.id}`}
                    className="mt-2 block text-xs font-bold text-accent-600 hover:text-accent-700"
                  >
                    Ver local →
                  </Link>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
