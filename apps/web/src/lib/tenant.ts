import { useSyncExternalStore } from 'react'
import { setMoneyLocale } from '@/lib/format'

/**
 * Tenant resolution para la PWA del vecino.
 *
 * Orden de resolución del slug:
 *   1. Query string ?tenant=  (override manual para preview)
 *   2. localStorage 'misanpedro.tenant.slug' (selección previa)
 *   3. Subdomain del host: ramallo.misanpedro.app → 'ramallo'
 *   4. Variable build VITE_TENANT_SLUG (deploy single-tenant)
 *   5. null → muestra selector de ciudades
 *
 * Reserved subdomains que NO se resuelven como tenant:
 *   www, api, admin, owner, app, comercios
 */

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'admin', 'owner', 'app', 'comercios'])

const STORAGE_KEY = 'misanpedro.tenant.slug'

/**
 * Email de soporte mostrado en footers y CTAs de ayuda.
 * Se puede sobrescribir con VITE_SUPPORT_EMAIL en build time.
 * Default: `soporte@misanpedro.app` (marca productiva del proyecto).
 */
export const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? 'soporte@misanpedro.app'

/** Número placeholder de soporte — NO es real. Si el env no se setea, el link
 *  de WhatsApp caería en este número muerto, así que lo detectamos para hacer
 *  fallback a email. */
const SUPPORT_WHATSAPP_PLACEHOLDER = '5493329000000'
const SUPPORT_WHATSAPP_DIGITS = (
  (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) ?? ''
).replace(/\D/g, '')

/**
 * Devuelve el link de soporte correcto y su label. Usa WhatsApp si hay un
 * número real configurado; si el env no está seteado o sigue siendo el
 * placeholder, cae a `mailto:` para no mandar al usuario a un número muerto.
 *
 * Compartido entre el panel del comercio (MerchantShell) y el perfil del
 * vecino (PerfilPage) para no duplicar la lógica del placeholder.
 */
export function getSupportLink(
  whatsappMessage: string,
  emailSubject = 'Soporte Mi San Pedro',
): { href: string; label: string; isWhatsapp: boolean } {
  const hasWhatsapp =
    SUPPORT_WHATSAPP_DIGITS.length > 0 &&
    SUPPORT_WHATSAPP_DIGITS !== SUPPORT_WHATSAPP_PLACEHOLDER
  if (hasWhatsapp) {
    return {
      href: `https://wa.me/${SUPPORT_WHATSAPP_DIGITS}?text=${encodeURIComponent(whatsappMessage)}`,
      label: 'Soporte por WhatsApp',
      isWhatsapp: true,
    }
  }
  return {
    href: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(emailSubject)}`,
    label: 'Soporte por email',
    isWhatsapp: false,
  }
}

export type TenantConfig = {
  slug: string
  nombre: string
  ciudad: string
  provincia?: string
  /** Nombre del país (display). Ej: "Argentina", "Colombia". Default "Argentina". */
  pais?: string
  /** Código de moneda ISO-4217. Ej: "ARS","COP","CLP","MXN". Default "ARS". */
  moneda?: string
  /** Locale BCP-47 para Intl (moneda/números/fechas). Ej: "es-AR","es-CO". Default "es-AR". */
  locale?: string
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
  /** Centro geográfico del tenant para coordenadas placeholder de nuevos comercios. */
  geoCenter?: { lat: number; lng: number }
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

  // 3. Subdomain — SOLO cuando el host termina en uno de los dominios "del
  //    producto" donde sí controlamos los subdomains. En GitHub Pages u otros
  //    hosts el primer label no es un tenant slug válido (sería 'soyalantapia',
  //    'vercel', etc.) y cae a la fallback.
  const host = window.location.hostname
  const TENANT_HOSTS = ['misanpedro.app']
  const isTenantHost = TENANT_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`),
  )
  if (isTenantHost) {
    const parts = host.split('.')
    if (parts.length >= 3) {
      const sub = parts[0].toLowerCase()
      if (!RESERVED_SUBDOMAINS.has(sub)) return sub
    }
  }

  // 4. Build-time fallback (VITE_TENANT_SLUG)
  const buildTime = import.meta.env.VITE_TENANT_SLUG as string | undefined
  if (buildTime) return buildTime

  // 5. Default para deploys "single-tenant" (Mi San Pedro):
  //    apuntamos al tenant 'sanpedro' por compatibilidad. Cuando se sirvan
  //    múltiples ciudades vía subdominios reales, este fallback aplica sólo
  //    al deploy de GH Pages de la PWA principal.
  return 'sanpedro'
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
    // Formateo de plata per-tenant: ciudades multi-país (país/moneda/locale).
    // Default es-AR/ARS si el tenant no trae estos campos.
    setMoneyLocale(json.tenant.locale ?? 'es-AR', json.tenant.moneda ?? 'ARS')
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
  // COLOR POR CIUDAD: --color-brand es el ÚNICO knob; toda la escala accent/* y los
  // tokens fin-* (lado vecino) se derivan de él vía color-mix. Seteándolo acá
  // re-tematizamos TODA la app con el color de la ciudad. Si el tenant no trae
  // primaryColor, queda el naranja de marca horneado en el build.
  if (t.brand?.primaryColor) {
    root.style.setProperty('--color-brand', t.brand.primaryColor)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', t.brand.primaryColor)
  }
  // <title> dinámico
  if (t.nombre) document.title = `${t.nombre} · Descuentos del barrio`
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
