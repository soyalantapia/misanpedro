import type { User } from '@/lib/types'

/**
 * Vecinos demo — vacío en producción.
 *
 * Los usuarios reales viven en MongoDB (`users` collection). Los datos
 * de clientes que un comercio puede ver se obtienen via
 * `GET /redemptions/clientes` (sólo los que canjearon en su local).
 */
export const SEED_DEMO_USERS: User[] = []
