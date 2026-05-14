import type { Coupon } from '@/lib/types'

/**
 * Catálogo de cupones — vacío en producción.
 *
 * El catálogo real vive en MongoDB (`coupons` collection) y se hidrata
 * vía `useApiCoupons()` desde el backend. Este array existe sólo por
 * compatibilidad con código legacy que importa `SEED_COUPONS`.
 */
export const SEED_COUPONS: Coupon[] = []
