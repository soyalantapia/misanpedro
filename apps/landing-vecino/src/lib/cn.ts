/** Minimal classNames concat — joins truthy strings. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/**
 * CTA del vecino: ENTRAR a la PWA (sin registro — navega y mira los descuentos).
 * La PWA vive en https://soyalantapia.github.io/misanpedro/ (HashRouter).
 * Override con VITE_APP_URL al build cuando haya dominio propio.
 */
const APP_URL_RAW = import.meta.env.VITE_APP_URL ?? 'https://soyalantapia.github.io/misanpedro'
export const APP_URL = APP_URL_RAW.replace(/\/$/, '')

// Home del vecino = catálogo de descuentos (HashRouter → /#/).
export const ENTER_URL = `${APP_URL}/#/`

export const SUPPORT_EMAIL = 'hola@misanpedro.app'
