import { useSyncExternalStore } from 'react'
import { PRECIO_MENSUAL, TOTAL_CUPOS } from './launch'

/**
 * Tenant resolution para la LANDING DEL COMERCIO. Multi-ciudad/dinámica.
 *
 * Modos:
 *   a) Marca paraguas (sin tenant): branding genérico "Mi Ciudad" / "tu ciudad".
 *   b) Tenant-specific (sanpedro.micuidad.com/comercios, o ?tenant=sanpedro):
 *      nombre, ciudad, precio, moneda y COLOR salen del tenant — todo se
 *      re-tematiza solo (el color via el knob `--color-brand`).
 *
 * Detección del slug:
 *   1. ?tenant=sanpedro   2. subdomain del host (excepto reserved)
 *   3. VITE_TENANT_SLUG (build-time)   4. null → modo paraguas
 */

const RESERVED = new Set(['www', 'api', 'admin', 'owner', 'app', 'comercios', 'administracion', 'ciudades'])

export type LandingTenant = {
  slug: string
  nombre: string
  ciudad: string
  provincia?: string
  pais?: string
  /** ISO-4217 (ARS, COP, …) y BCP-47 (es-AR, es-CO). Para formatear el precio. */
  moneda?: string
  locale?: string
  /** Precio mensual del comercio en `moneda`. Si no está, cae al default de launch. */
  precioMensual?: number
  /** Conteo REAL de comercios adheridos (estado activo) en esta ciudad — del
   *  backend (GET /tenant/:slug/config). Alimenta el contador de escasez de la
   *  landing en vez de una constante hardcodeada. */
  merchantsActivos?: number
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

/** Solo HEX válido (#RGB…#RRGGBBAA). Un valor inesperado dejaría --color-brand
 *  inválido y colapsaría toda la escala accent que se deriva por color-mix. */
function isHexColor(v?: string): v is string {
  return !!v && /^#[0-9a-fA-F]{3,8}$/.test(v)
}

/** Texto accesible (#fff o tinta oscura) SOBRE el color de marca, por luminancia
 *  relativa WCAG. Para marcas claras (amarillo/lima) devuelve tinta para que el
 *  texto de los CTA no quede ilegible; para oscuras (naranja/teal), blanco. */
function onBrandText(hex: string): string {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#ffffff'
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L =
    0.2126 * lin(parseInt(full.slice(0, 2), 16) / 255) +
    0.7152 * lin(parseInt(full.slice(2, 4), 16) / 255) +
    0.0722 * lin(parseInt(full.slice(4, 6), 16) / 255)
  // Umbral sesgado a blanco: el CTA usa un gradiente MÁS oscuro que el color crudo,
  // así que solo marcas claras (L alto) necesitan texto en tinta.
  return L > 0.4 ? '#241a14' : '#ffffff'
}

function applyBrandingToDom(t: LandingTenant) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const primary = t.brand?.primaryColor
  // COLOR POR CIUDAD: --color-brand es el ÚNICO knob; toda la escala accent-* se
  // deriva de él por color-mix. Seteándolo acá re-tematizamos TODA la landing.
  if (isHexColor(primary)) {
    root.style.setProperty('--color-brand', primary)
    // Texto de los CTA accesible según la luminancia de la marca (def. blanco).
    root.style.setProperty('--color-on-brand', onBrandText(primary))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', primary)
  }
  if (t.nombre) document.title = `${t.nombre} · Sumá tu comercio`
}

// ─── Helpers de copy/precio (fallback a paraguas genérico) ──────────────────

/** Nombre de marca de la ciudad ("Mi San Pedro"). Fallback: "Mi Ciudad". */
export function appName(c: LandingTenant | null): string {
  return c?.nombre?.trim() || 'Mi Ciudad'
}

/** Localidad que ven los vecinos/comercios ("San Pedro"). Fallback: "tu ciudad". */
export function cityName(c: LandingTenant | null): string {
  return c?.ciudad?.trim() || 'tu ciudad'
}

/** ¿Es San Pedro? El contador de escasez del lanzamiento es SOLO de esa ciudad. */
export const isSanPedro = (c: LandingTenant | null): boolean => c?.slug === 'sanpedro'

/** Contador de escasez del lanzamiento con el conteo REAL de comercios adheridos
 *  (del backend, `merchantsActivos`). `total` = cupos del programa; `restantes`
 *  nunca baja de 0. Sin conteo del backend → 0 adheridos (no inventa un número). */
export function cupos(c: LandingTenant | null): { adheridos: number; total: number; restantes: number } {
  const total = TOTAL_CUPOS
  const adheridos = Math.max(0, Math.min(total, c?.merchantsActivos ?? 0))
  return { adheridos, total, restantes: Math.max(0, total - adheridos) }
}

/** ¿El tenant es de Argentina? Gatea copy fiscal/medio-de-pago AR (factura C, IVA,
 *  MercadoPago). Si no hay tenant (paraguas), se asume NO-AR → copy neutro. */
export const isArgentina = (c: LandingTenant | null): boolean => c?.pais === 'Argentina'

/** Medio de pago a mostrar: MercadoPago en AR, neutro en el resto. */
export const pagoLabel = (c: LandingTenant | null): string =>
  isArgentina(c) ? 'MercadoPago' : 'pago online'

/** Precio mensual formateado en la moneda/locale del tenant (ej. "$50.000" o
 *  "$ 50.000" en COP). Si el tenant no trae precioMensual, usa el default. */
export function priceLabel(c: LandingTenant | null): string {
  const amount = c?.precioMensual && c.precioMensual > 0 ? c.precioMensual : PRECIO_MENSUAL
  const moneda = c?.moneda || 'ARS'
  const locale = c?.locale || 'es-AR'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `$${amount.toLocaleString('es-AR')}`
  }
}
