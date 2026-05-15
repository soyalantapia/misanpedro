import { useEffect, useRef, useState } from 'react'

/**
 * Marca el elemento como "visible" cuando entra al viewport por primera vez.
 * Respeta `prefers-reduced-motion`: si el usuario lo tiene, devuelve `true`
 * inmediatamente para que el contenido aparezca sin animación.
 *
 * Uso:
 *   const { ref, inView } = useInView<HTMLDivElement>()
 *   <div ref={ref} className={inView ? 'animate-fade-up' : 'opacity-0'}>
 */
export function useInView<T extends HTMLElement>(
  options: IntersectionObserverInit = { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Respeta reduced-motion: skip animation, mostrá ya
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
  }, [])

  return { ref, inView }
}
