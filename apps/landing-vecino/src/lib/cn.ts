/** Minimal classNames concat — joins truthy strings. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/**
 * URLs de la app POR CIUDAD (tenant-aware). La landing del vecino vive en
 * <sub>.micuidad.com/vecino y la PWA en <sub>.micuidad.com/ — mismo host. El CTA
 * "Entrar" tiene que ir a la PWA de ESA ciudad, no a una fija.
 */
const PLATFORM_DOMAIN = 'micuidad.com'
type TenantLike = { subdomain?: string | null } | null

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
 * CTA del vecino: ENTRAR a la PWA de SU ciudad (sin registro, navega y mira los
 * descuentos). Reenvía las UTM/ref de la landing a la PWA para atribución (qué
 * comercio/QR/canal lo trajo). El query va ANTES del hash (location.search).
 */
export function enterUrl(t: TenantLike): string {
  const base = appBase(t)
  if (typeof window === 'undefined') return `${base}/#/`
  const incoming = new URLSearchParams(window.location.search)
  const fwd = new URLSearchParams()
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref']) {
    const v = incoming.get(k)
    if (v) fwd.set(k, v)
  }
  const qs = fwd.toString()
  return qs ? `${base}/?${qs}#/` : `${base}/#/`
}

// Landing del COMERCIO (captación): relativa al host actual (misma ciudad).
export const COMERCIOS_URL = (import.meta.env.VITE_COMERCIOS_URL as string | undefined) ?? '/comercios/'

export const SUPPORT_EMAIL = 'soporte@micuidad.com'
