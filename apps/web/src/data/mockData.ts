import type { Merchant, MerchantUser } from '@/lib/types'
import { SEED_MERCHANTS } from './seedMerchants'

/**
 * Datos mock — vacíos en producción.
 *
 * Toda la data real (comercios, usuarios de comercio, cupones, vecinos) vive
 * en MongoDB y se hidrata vía el API. Estos exports existen sólo por
 * compatibilidad con código legacy que aún los importa.
 *
 * - Para comercios usar `useApiMerchants()` / `useMerchant()` / `getMerchantSync()`
 * - Para usuarios de comercio usar el endpoint `POST /auth/merchant/login`
 * - Para cupones usar `useApiCoupons()`
 */

/** @deprecated Vacío. Usar `useApiMerchants()` o `getMerchantSync()`. */
export const MERCHANTS: Merchant[] = SEED_MERCHANTS

/** @deprecated Vacío. La auth de comercios va por `POST /auth/merchant/login`. */
export const MERCHANT_USERS: MerchantUser[] = []

/** @deprecated Stub legacy. La auth real va por API. Devuelve undefined siempre. */
export function findMerchantUser(_email: string, _password: string): MerchantUser | undefined {
  return undefined
}

/** @deprecated Stub legacy. La auth real va por API. Devuelve undefined siempre. */
export function findMerchantUserByEmail(_email: string): MerchantUser | undefined {
  return undefined
}

/** @deprecated Stub legacy. No-op. */
export function addMerchantUser(_user: MerchantUser) {
  /* no-op: el alta de comercios va por POST /auth/merchant/signup */
}

/** @deprecated Stub legacy. Devuelve [] siempre. */
export function getAllMerchantUsers(): MerchantUser[] {
  return []
}

/**
 * @deprecated Fallback legacy. Devuelve undefined en producción porque
 * SEED_MERCHANTS está vacío. Para datos reales usar `getMerchantSync()` del
 * merchantsStore (hidratado desde API) o `useApiMerchants()`.
 */
export function getMerchant(id: string): Merchant | undefined {
  return SEED_MERCHANTS.find((m) => m.id === id)
}
