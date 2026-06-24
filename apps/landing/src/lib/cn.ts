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

export const signupUrl = (t: TenantLike) => `${appBase(t)}/#/admin/registro`
export const loginUrl = (t: TenantLike) => `${appBase(t)}/#/admin/login`
export const legalUrl = (t: TenantLike, path: 'terminos' | 'privacidad') => `${appBase(t)}/#/legal/${path}`

export const SUPPORT_EMAIL = 'soporte@micuidad.com'
