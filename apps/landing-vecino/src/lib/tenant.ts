import { useSyncExternalStore } from 'react'

/**
 * Tenant resolution para la LANDING DEL VECINO. Multi-ciudad/dinámica.
 *
 * Modos:
 *   a) Marca paraguas (sin tenant): branding genérico "Mi Ciudad" / "tu ciudad".
 *   b) Tenant-specific (sanpedro.micuidad.com/vecino, o ?tenant=sanpedro):
 *      nombre, ciudad y COLOR salen del tenant — todo se re-tematiza solo
 *      (el color via el knob `--color-brand`). El vecino no paga: sin precio.
 *
 * Detección del slug:
 *   1. ?tenant=sanpedro   2. subdomain del host (excepto reserved)
 *   3. VITE_TENANT_SLUG (build-time)   4. null → modo paraguas
 */

const RESERVED = new Set(['www', 'api', 'admin', 'owner', 'app', 'comercios', 'administracion', 'ciudades', 'vecino'])

export type LandingTenant = {
  slug: string
  nombre: string
  ciudad: string
  provincia?: string
  pais?: string
  moneda?: string
  locale?: string
  subdomain: string
  brand: {
    logoUrl?: string
    primaryColor?: string
    accentColor?: string
    heroEyebrow?: string
    heroHeadline?: string
  }
}

type State = {
  slug: string | null
  config: LandingTenant | null
  loading: boolean
}

const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001'

function detectSlug(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const url = new URL(window.location.href)
    const q = url.searchParams.get('tenant')
    if (q) return q.toLowerCase()
  } catch {
    /* noop */
  }
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return (import.meta.env.VITE_TENANT_SLUG as string | undefined) ?? null
  }
  const parts = host.split('.')
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase()
    if (!RESERVED.has(sub)) return sub
  }
  return (import.meta.env.VITE_TENANT_SLUG as string | undefined) ?? null
}

let state: State = {
  slug: detectSlug(),
  config: null,
  loading: false,
}

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((fn) => fn())
}

export function getTenantSnapshot() {
  return state
}

export function useTenant() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    getTenantSnapshot,
    getTenantSnapshot,
  )
}

// Dedupe: main.tsx (eager) y App.tsx (useEffect, ×2 en StrictMode) llaman a esto.
// Sin guard se dispara el fetch del tenant 2-3 veces al cargar. El guard de
// in-flight + already-loaded lo hace idempotente sin importar el caller. El slug
// va encodeURIComponent (viene de ?tenant=/subdomain) para no armar una URL rara.
let inflight: Promise<void> | null = null
export function loadTenantConfig(): Promise<void> {
  const slug = state.slug
  if (!slug || state.config) return Promise.resolve()
  if (inflight) return inflight
  inflight = (async () => {
    state = { ...state, loading: true }
    notify()
    try {
      const res = await fetch(
        `${API_URL.replace(/\/$/, '')}/api/v1/tenant/${encodeURIComponent(slug)}/config`,
      )
      if (!res.ok) {
        state = { ...state, loading: false }
        notify()
        return
      }
      const json = (await res.json()) as { ok: boolean; tenant: LandingTenant }
      if (json.ok && json.tenant) {
        state = { ...state, config: json.tenant, loading: false }
        applyBrandingToDom(json.tenant)
      } else {
        state = { ...state, loading: false }
      }
      notify()
    } catch {
      state = { ...state, loading: false }
      notify()
    } finally {
      inflight = null
    }
  })()
  return inflight
}

function isHexColor(v?: string): v is string {
  return !!v && /^#[0-9a-fA-F]{3,8}$/.test(v)
}

/** Texto accesible (#fff o tinta oscura) SOBRE el color de marca, por luminancia
 *  relativa WCAG. Marcas claras → tinta; oscuras (naranja/teal) → blanco. */
function onBrandText(hex: string): string {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#ffffff'
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L =
    0.2126 * lin(parseInt(full.slice(0, 2), 16) / 255) +
    0.7152 * lin(parseInt(full.slice(2, 4), 16) / 255) +
    0.0722 * lin(parseInt(full.slice(4, 6), 16) / 255)
  return L > 0.4 ? '#241a14' : '#ffffff'
}

function applyBrandingToDom(t: LandingTenant) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const primary = t.brand?.primaryColor
  // COLOR POR CIUDAD: --color-brand es el ÚNICO knob; la escala accent-* se
  // deriva por color-mix. Seteándolo re-tematizamos TODA la landing del vecino.
  if (isHexColor(primary)) {
    root.style.setProperty('--color-brand', primary)
    root.style.setProperty('--color-on-brand', onBrandText(primary))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', primary)
  }
  if (t.nombre) document.title = `${t.nombre} · Descuentos para vecinos`
}

// ─── Helpers de copy (fallback a paraguas genérico) ─────────────────────────

/** Nombre de marca de la ciudad ("Mi San Pedro"). Fallback: "Mi Ciudad". */
export function appName(c: LandingTenant | null): string {
  return c?.nombre?.trim() || 'Mi Ciudad'
}

/** Localidad que ven los vecinos ("San Pedro"). Fallback: "tu ciudad". */
export function cityName(c: LandingTenant | null): string {
  return c?.ciudad?.trim() || 'tu ciudad'
}
