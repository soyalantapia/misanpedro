/** Minimal classNames concat — joins truthy strings. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Shared constants for CTAs + contact (single source of truth).
 *
 * Production targets:
 * - App: https://app.misanpedro.com/
 *
 * Para override del dominio en build, usá env vars:
 *   VITE_APP_URL=https://app.misanpedro.com pnpm build
 *
 * Routes verificadas que existen en el PWA (apps/web/src/App.tsx):
 *   /admin/registro      — signup del comercio
 *   /admin/login         — login del comercio
 *   /                    — home (catálogo de descuentos)
 *   /legal/terminos
 *   /legal/privacidad
 */

const APP_URL_RAW = import.meta.env.VITE_APP_URL ?? 'https://app.misanpedro.com'
// Strip trailing slash para que `${APP_URL}/#/...` no quede `//#/`
export const APP_URL = APP_URL_RAW.replace(/\/$/, '')

// El path real es /admin/registro, NO /admin/signup
export const SIGNUP_URL = `${APP_URL}/#/admin/registro`
export const LOGIN_URL = `${APP_URL}/#/admin/login`

export const SUPPORT_EMAIL = 'hola@misanpedro.com'
