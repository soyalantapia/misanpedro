import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

/**
 * Marca el elemento como "visible" cuando entra al viewport por primera vez.
 *
 * Respeta `prefers-reduced-motion` de forma REACTIVA: si el usuario lo activa
 * con la página ya abierta, todo pasa a visible al instante. Antes se leía una
 * sola vez al montar (snapshot) y el cambio en caliente no se detectaba.
 *
 * Uso:
 *   const { ref, inView } = useInView<HTMLDivElement>()
 *   <div ref={ref} className={inView ? 'enter-lead' : 'opacity-0'}>
 */
export function useInView<T extends HTMLElement>(
  options: IntersectionObserverInit = { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Reduced-motion: mostrar YA, sin observer ni animación.
    if (prefersReduced) {
      setInView(true)
      return
    }

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(entry.target)
        }
      },
      options,
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReduced])

  return { ref, inView }
}
