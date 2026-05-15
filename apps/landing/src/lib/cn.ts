/** Minimal classNames concat — joins truthy strings. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Shared constants for CTAs + contact (single source of truth).
 *
 * ⚠️ Verificar antes del deploy a producción:
 * - SIGNUP_URL apunta al subdominio correcto
 * - SUPPORT_EMAIL es la casilla real
 */

export const SIGNUP_URL = 'https://app.misanpedro.app/#/admin/signup'
export const APP_URL = 'https://app.misanpedro.app'
export const SUPPORT_EMAIL = 'hola@misanpedro.app'
