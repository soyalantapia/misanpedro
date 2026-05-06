import { useEffect, useState } from 'react'

export type Coords = { lat: number; lng: number }

export type GeoState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'granted'; coords: Coords }
  | { status: 'denied' }
  | { status: 'unavailable' }

const STORAGE_KEY = 'misanpedro.geo.v1'

function loadCached(): GeoState {
  if (typeof window === 'undefined') return { status: 'idle' }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { status: 'idle' }
    const parsed = JSON.parse(raw) as GeoState
    if (parsed.status === 'granted' || parsed.status === 'denied') return parsed
    return { status: 'idle' }
  } catch {
    return { status: 'idle' }
  }
}

function persist(s: GeoState) {
  if (typeof window === 'undefined') return
  if (s.status === 'granted' || s.status === 'denied') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  }
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>(loadCached)

  useEffect(() => {
    if (state.status !== 'idle') return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'unavailable' })
      return
    }
  }, [state.status])

  function request() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const next: GeoState = { status: 'unavailable' }
      setState(next)
      return
    }
    setState({ status: 'pending' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: GeoState = {
          status: 'granted',
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }
        setState(next)
        persist(next)
      },
      () => {
        const next: GeoState = { status: 'denied' }
        setState(next)
        persist(next)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
  }

  return { state, request }
}

export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
