/** Minimal classNames concat — joins truthy strings. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/**
 * URLs de la app POR CIUDAD (tenant-aware). La landing vive en
 * <sub>.micuidad.com/comercios y la app (PWA) en <sub>.micuidad.com/ — mismo host.
 * El CTA/login/legales tienen que ir a la app de ESA ciudad, no a una fija.
 *
 * Rutas reales del PWA (apps/web/src/App.tsx): /admin/registro · /admin/login ·
 * / (catálogo) · /legal/terminos · /legal/privacidad.
 */
const PLATFORM_DOMAIN = 'micuidad.com'
type TenantLike = { subdomain?: string | null } | null

/**
 * Origin de la app de la ciudad del tenant. Prioridad:
 *   1. subdomain del tenant → https://<sub>.micuidad.com
 *   2. origin actual (en prod la landing ya está en el host de la ciudad)
 *   3. VITE_APP_URL (build) o fallback sanpedro.
 */
export function appBase(t: TenantLike): string {
  if (t?.subdomain) return `https://${String(t.subdomain).toLowerCase()}.${PLATFORM_DOMAIN}`
  if (typeof window !== 'undefined') {
    const h = window.location.host
    if (h && !/^(localhost|127\.0\.0\.1)/.test(h)) return window.location.origin
  }
  const env = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '')
  return env || `https://sanpedro.${PLATFORM_DOMAIN}`
}

/**
 * Reenvía las UTM/ref de la landing a la PWA para no perder la atribución en la
 * conversión (qué QR/canal/campaña trajo al comercio). El query va ANTES del hash
 * (location.search) para que la PWA lo lea. Devuelve "" o "?utm_...".
 */
function fwdQuery(): string {
  if (typeof window === 'undefined') return ''
  const incoming = new URLSearchParams(window.location.search)
  const fwd = new URLSearchParams()
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref']) {
    const v = incoming.get(k)
    if (v) fwd.set(k, v)
  }
  const qs = fwd.toString()
  return qs ? `?${qs}` : ''
}

export const signupUrl = (t: TenantLike) => `${appBase(t)}/${fwdQuery()}#/admin/registro`
export const loginUrl = (t: TenantLike) => `${appBase(t)}/${fwdQuery()}#/admin/login`
export const legalUrl = (t: TenantLike, path: 'terminos' | 'privacidad') => `${appBase(t)}/#/legal/${path}`

export const SUPPORT_EMAIL = 'soporte@micuidad.com'
