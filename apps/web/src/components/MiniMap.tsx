import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Mini-mapa de SOLO LECTURA con un único pin — para la ficha pública del
 * comercio (micro-sitio). Sin drag ni zoom: es una vista previa de ubicación.
 * Para elegir/mover el pin está LocationPicker (panel del comercio).
 */
const pin = L.divIcon({
  className: 'msp-mini-pin',
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="#c3ff3e" stroke="#14211B" stroke-width="1.4" style="filter:drop-shadow(0 3px 4px rgba(0,0,0,.5))"><path d="M12 21.5s7-6.4 7-11.5a7 7 0 1 0-14 0c0 5.1 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.5" fill="#14211B" stroke="none"/></svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
})

export default function MiniMap({
  lat,
  lng,
  height = 200,
}: {
  lat: number
  lng: number
  height?: number
}) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-fin-line" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={pin} />
      </MapContainer>
    </div>
  )
}
