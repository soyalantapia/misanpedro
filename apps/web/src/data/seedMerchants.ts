import type { Merchant } from '@/lib/types'

/**
 * Catálogo de comercios — vacío en producción.
 *
 * Los comercios reales viven en MongoDB (`merchants` collection) y se
 * hidratan vía `useApiMerchants()` desde el backend. Este array existe
 * sólo por compatibilidad con código legacy que importa `SEED_MERCHANTS`.
 */
export const SEED_MERCHANTS: Merchant[] = []
