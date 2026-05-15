/** Minimal classNames concat — joins truthy strings. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Shared constants for CTAs + contact (single source of truth).
 *
 * ⚠️ TODO antes del deploy a producción:
 * - Cambiar WHATSAPP_NUMBER al número real de soporte de misanpedro
 * - Verificar que SIGNUP_URL apunte al subdominio correcto
 * - Confirmar SUPPORT_EMAIL
 */

// ⚠️ PLACEHOLDER — reemplazar con el WhatsApp real antes de deployar
const WHATSAPP_NUMBER = '5493329000000'
const WHATSAPP_MESSAGE = encodeURIComponent(
  'Hola, quiero saber más de misanpedro para mi comercio',
)

export const SIGNUP_URL = 'https://app.misanpedro.app/#/admin/signup'
export const APP_URL = 'https://app.misanpedro.app'
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`
export const SUPPORT_EMAIL = 'hola@misanpedro.app'

// Aviso en consola en dev para que nadie se olvide de cambiar el WA placeholder
if (import.meta.env.DEV && WHATSAPP_NUMBER === '5493329000000') {
  // eslint-disable-next-line no-console
  console.warn(
    '⚠️ [landing] WhatsApp es un placeholder. Cambiar WHATSAPP_NUMBER en src/lib/cn.ts antes de producción.',
  )
}
