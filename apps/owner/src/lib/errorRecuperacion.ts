/**
 * ESPEJO de `apps/web/src/lib/errorRecuperacion.ts` — mismo criterio, mismo
 * comentario canónico allá.
 *
 * Por convención del repo los fronts no comparten paquete: la lógica chica se
 * duplica con un puntero al canónico (igual que `launch.ts` o `cuponValor.ts`).
 * Si cambiás las señales de acá, cambialas TAMBIÉN en la PWA.
 *
 * El panel del owner no usa `lazy()`, así que el caso del chunk viejo es menos
 * probable que en la PWA — pero el default importa igual: sin ErrorBoundary,
 * cualquier throw en render dejaba al super-admin con la pantalla en blanco.
 * [cazabug loop2]
 */

export type Recuperacion = 'recargar' | 'reintentar'

const SENIALES_DE_CHUNK = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'chunkloaderror',
  'loading chunk',
  'failed to load module script',
]

export function clasificarError(err: unknown): Recuperacion {
  const texto = [
    (err as { name?: unknown })?.name,
    (err as { message?: unknown })?.message,
  ]
    .filter((p): p is string => typeof p === 'string')
    .join(' ')
    .toLowerCase()

  return SENIALES_DE_CHUNK.some((s) => texto.includes(s)) ? 'recargar' : 'reintentar'
}

const CLAVE_YA_RECARGUE = 'msp:recarga-por-chunk'

export function puedeRecargarSola(storage: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  try {
    if (storage.getItem(CLAVE_YA_RECARGUE)) return false
    storage.setItem(CLAVE_YA_RECARGUE, '1')
    return true
  } catch {
    return false
  }
}
