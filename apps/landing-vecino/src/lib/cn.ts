/** Minimal classNames concat — joins truthy strings. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/**
 * CTA del vecino: ENTRAR a la PWA (sin registro — navega y mira los descuentos).
 * La PWA vive en https://app.misanpedro.com/ (HashRouter).
 * Override con VITE_APP_URL al build cuando haya dominio propio.
 */
const APP_URL_RAW = import.meta.env.VITE_APP_URL ?? 'https://app.misanpedro.com'
export const APP_URL = APP_URL_RAW.replace(/\/$/, '')

// Home del vecino = catálogo de descuentos (HashRouter → /#/).
// MEDICIÓN: reenvía las UTM/ref de la landing a la PWA, para atribuir qué comercio/QR/canal
// trajo al vecino. El query va ANTES del hash para que la app lo lea desde location.search.
function buildEnterUrl(): string {
  if (typeof window === 'undefined') return `${APP_URL}/#/`
  const incoming = new URLSearchParams(window.location.search)
  const fwd = new URLSearchParams()
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref']) {
    const v = incoming.get(k)
    if (v) fwd.set(k, v)
  }
  const qs = fwd.toString()
  return qs ? `${APP_URL}/?${qs}#/` : `${APP_URL}/#/`
}

export const ENTER_URL = buildEnterUrl()

// Landing del COMERCIO (captación). Por default relativa a la raíz del dominio
// (misanpedro.com/comercios/) — robusta también en www. Override con
// VITE_COMERCIOS_URL al build si hace falta una URL absoluta.
export const COMERCIOS_URL = import.meta.env.VITE_COMERCIOS_URL ?? '/comercios/'

export const SUPPORT_EMAIL = 'hola@misanpedro.com'
