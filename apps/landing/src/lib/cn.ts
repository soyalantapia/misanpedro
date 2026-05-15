/** Minimal classNames concat — joins truthy strings. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/** Shared constants for CTAs + contact (single source of truth). */
export const SIGNUP_URL = 'https://app.misanpedro.app/#/admin/signup'
export const APP_URL = 'https://app.misanpedro.app'
export const WHATSAPP_URL =
  'https://wa.me/5493329000000?text=Hola%2C%20quiero%20saber%20más%20de%20misanpedro%20para%20mi%20comercio'
export const SUPPORT_EMAIL = 'hola@misanpedro.app'
