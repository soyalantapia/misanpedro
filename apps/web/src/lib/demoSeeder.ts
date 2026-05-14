import type { User } from './types'
import { demoStoreActions, getUserSnapshot } from './stores'

/**
 * Demo seeder — DEPRECATED EN PRODUCCIÓN.
 *
 * Toda la data real (comercios, cupones, vecinos, activaciones, canjes) vive
 * en MongoDB y se hidrata vía el API. Este módulo conserva sólo dos helpers
 * legacy:
 *
 * - `purgeDemoDataForApiUser()`: vacía cualquier resto de seed local cuando
 *   un vecino se loguea contra el API real (usado por Login/Registro).
 * - `isDemoLoaded()`: stub que siempre devuelve false (la app ya no carga
 *   datos demo automáticamente).
 *
 * Los demás exports (`loadDemoData`, `ensureDemoDataLoaded`,
 * `refreshDemoActiveCoupon`, `DEMO_ACTIVE_CODE`) quedan como no-ops para no
 * romper imports que aún existan en componentes legacy.
 */

/** @deprecated No-op. La app ya no expone un "cupón demo" hardcoded. */
export const DEMO_ACTIVE_CODE = ''

/** @deprecated No-op. La data demo ya no se carga automáticamente. */
export function loadDemoData(_currentUser: User | null) {
  return { users: 0, redemptions: 0, campaigns: 0 }
}

/** @deprecated Stub que siempre devuelve false. */
export function isDemoLoaded(): boolean {
  return false
}

/** @deprecated No-op. */
export function ensureDemoDataLoaded() {
  /* no-op */
}

/**
 * Vacía las activations + demoUsers locales cuando detectamos que la app pasó
 * de "público anónimo" a "vecino logueado vía API". Conserva el user actual.
 *
 * Idempotente: si ya no hay nada que limpiar, no hace nada.
 */
export function purgeDemoDataForApiUser() {
  if (typeof window === 'undefined') return
  const current = getUserSnapshot()
  demoStoreActions.bulkSeed({ user: current, demoUsers: [], activations: [] })
}

/** @deprecated No-op. La validación real va contra el API. */
export function refreshDemoActiveCoupon() {
  /* no-op */
}
