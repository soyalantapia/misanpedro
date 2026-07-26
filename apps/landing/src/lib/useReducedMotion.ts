import { useSyncExternalStore } from 'react'

/**
 * `prefers-reduced-motion` REACTIVO.
 *
 * `useInView` ya lo consulta, pero una sola vez al montar: si el usuario activa
 * "reducir movimiento" en el sistema con la página abierta, el JS no se entera.
 * `useSyncExternalStore` sobre `matchMedia` sí: se suscribe al cambio y
 * re-renderiza. La regla CSS de `@media (prefers-reduced-motion)` apaga las
 * animaciones declarativas, pero no frena lo que decide JavaScript.
 */
const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

/** SSR/prerender: asumimos que SÍ hay movimiento (la CSS decide al hidratar). */
const getServerSnapshot = () => false

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
