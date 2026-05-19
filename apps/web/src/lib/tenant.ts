import { useSyncExternalStore } from 'react'

/**
 * Tenant resolution para la PWA del vecino.
 *
 * Orden de resolución del slug:
 *   1. Query string ?tenant=  (override manual para preview)
 *   2. localStorage 'cuponcito.tenant.slug' (selección previa)
 *   3. Subdomain del host: sanpedro.cuponcito.app → 'sanpedro'
 *   4. Variable build VITE_TENANT_SLUG (deploy single-tenant)
 *   5. null → muestra selector de ciudades
 *
 * Reserved subdomains que NO se resuelven como tenant:
 *   www, api, admin, owner, app, comercios
 */

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'admin', 'owner', 'app', 'comercios'])

const STORAGE_KEY = 'cuponcito.tenant.slug'

export type TenantConfig = {
  slug: string
  nombre: string
  ciudad: string
  provincia?: string
  pais?: string
  subdomain: string
  customDomain?: string
  brand: {
    logoUrl?: string
    primaryColor?: string
    accentColor?: string
    heroEyebrow?: string
    heroHeadline?: string
  }
  settings: {
    publicCatalog?: boolean
    whatsappEnabled?: boolean
    showOnboarding?: boolean
  }
  status: 'pending' | 'active' | 'suspended' | 'archived'
}

type TenantState = {
  slug: string | null
  config: TenantConfig | null
  loading: boolean
  error: string | null
}

let state: TenantState = {
  slug: detectInitialSlug(),
  config: null,
  loading: false,
  error: null,
}

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

function setState(next: Partial<TenantState>) {
  state = { ...state, ...next }
  notify()
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

/** Setea manualmente el tenant (selector de ciudades). Persiste en localStorage. */
export function setTenantSlug(slug: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, slug)
  }
  setState({ slug, config: null, loading: false, error: null })
  void loadTenantConfig(slug)
}

/** Limpia el tenant (vuelve al selector). */
export function clearTenantSlug() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
  }
  setState({ slug: null, config: null, loading: false, error: null })
}

function detectInitialSlug(): string | null {
  if (typeof window === 'undefined') return null

  // 1. Query string
  try {
    const url = new URL(window.location.href)
    const q = url.searchParams.get('tenant')
    if (q) {
      window.localStorage.setItem(STORAGE_KEY, q.toLowerCase())
      return q.toLowerCase()
    }
  } catch {
    /* noop */
  }

  // 2. localStorage
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored) return stored

  // 3. Subdomain
  const host = window.location.hostname
  // Sub-host count 3+ (sub.domain.tld). En localhost saltea esta vía.
  if (host === 'localhost' || host === '127.0.0.1' || /^\d/.test(host)) {
    // dev: usar build-time slug si está
    return (import.meta.env.VITE_TENANT_SLUG as string | undefined) ?? null
  }
  const parts = host.split('.')
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase()
    if (!RESERVED_SUBDOMAINS.has(sub)) return sub
  }

  // 4. Build-time fallback
  return (import.meta.env.VITE_TENANT_SLUG as string | undefined) ?? null
}

/**
 * Carga la config del tenant desde el API público `/tenant/:slug/config`.
 * Aplica branding (CSS vars) al :root cuando responde.
 */
export async function loadTenantConfig(slug: string): Promise<TenantConfig | null> {
  const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001'
  setState({ loading: true, error: null })
  try {
    const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/v1/tenant/${slug}/config`)
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      setState({
        loading: false,
        error: errJson?.error ?? `tenant '${slug}' no encontrado`,
        config: null,
      })
      return null
    }
    const json = (await res.json()) as { ok: boolean; tenant: TenantConfig }
    if (!json.ok || !json.tenant) {
      setState({ loading: false, error: 'respuesta inválida', config: null })
      return null
    }
    setState({ loading: false, config: json.tenant, error: null })
    applyBrandingToDom(json.tenant)
    return json.tenant
  } catch (err: any) {
    setState({ loading: false, error: err?.message ?? 'error de red', config: null })
    return null
  }
}

/**
 * Aplica branding del tenant al :root como CSS custom props.
 * El CSS de las páginas las consume via var(--tenant-primary) etc.
 */
function applyBrandingToDom(t: TenantConfig) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (t.brand?.primaryColor) root.style.setProperty('--tenant-primary', t.brand.primaryColor)
  if (t.brand?.accentColor) root.style.setProperty('--tenant-accent', t.brand.accentColor)
  // <title> dinámico
  if (t.nombre) document.title = `${t.nombre} · Descuentos del barrio`
  // theme-color del manifest/safari
  if (t.brand?.primaryColor) {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', t.brand.primaryColor)
  }
}

/**
 * Lista pública de tenants (para el selector de ciudades).
 */
export async function listAvailableTenants(): Promise<TenantConfig[]> {
  const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/v1/tenant/`)
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json?.tenants) ? json.tenants : []
  } catch {
    return []
  }
}
