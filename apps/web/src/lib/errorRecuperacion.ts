/**
 * ¿De qué se puede recuperar el vecino cuando la app tira un error de render?
 *
 * Ninguna de las cuatro apps tenía ErrorBoundary: cualquier throw durante el
 * render dejaba la pantalla EN BLANCO, sin mensaje y sin salida. En la PWA es
 * peor de lo que parece, porque las rutas se cargan con `lazy()`: cuando se
 * deploya mientras alguien tiene la app abierta, los chunks hasheados viejos
 * dejan de existir y el próximo click a otra pestaña tira "Failed to fetch
 * dynamically imported module". El vecino ve blanco y lo único que le queda es
 * cerrar la app. [cazabug loop2]
 *
 * Los dos casos piden recuperaciones DISTINTAS:
 *
 *  · Chunk que no baja → recargar. El SW está en `registerType: 'autoUpdate'`
 *    con `skipWaiting`, así que la recarga trae el index.html nuevo con los
 *    hashes nuevos y queda arreglado. Un "reintentar" que sólo re-renderiza no
 *    sirve para nada acá: el módulo sigue sin existir.
 *  · Cualquier otro error → reintentar el render. Recargar también funcionaría,
 *    pero se lleva puesto lo que el vecino tenga a medio hacer.
 */

export type Recuperacion = 'recargar' | 'reintentar'

/**
 * Los navegadores no comparten un tipo de error para esto: Chrome tira
 * "Failed to fetch dynamically imported module", Firefox "error loading
 * dynamically imported module", Safari "Importing a module script failed", y
 * webpack/algunos bundlers "ChunkLoadError". Se matchea por mensaje porque no
 * hay nada mejor; si aparece una variante nueva cae en 'reintentar', que es el
 * default seguro (no recarga sola).
 */
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

/**
 * Recargar una sola vez por sesión. Sin este candado, un chunk que falla por
 * algo que la recarga NO arregla (estar sin señal, un asset que quedó roto en
 * el deploy) mete al vecino en un bucle de recargas del que no puede salir ni
 * para leer el mensaje.
 */
const CLAVE_YA_RECARGUE = 'msp:recarga-por-chunk'

export function puedeRecargarSola(storage: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  try {
    if (storage.getItem(CLAVE_YA_RECARGUE)) return false
    storage.setItem(CLAVE_YA_RECARGUE, '1')
    return true
  } catch {
    // Safari en privado tira al escribir en sessionStorage. Sin poder anotar que
    // ya recargamos no podemos garantizar que no se cicle → no recargamos sola.
    return false
  }
}
