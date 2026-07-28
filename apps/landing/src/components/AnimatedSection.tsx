import type { HTMLAttributes, ReactNode } from 'react'
import { useInView } from '@/lib/useInView'

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  /** Opcional: aplica delay en ms a la animación. */
  delay?: number
  /** Tag — por defecto `div`. Usá `section` cuando reemplace el contenedor de la sección. */
  as?: 'div' | 'section' | 'article' | 'header' | 'footer'
  /**
   * Variante de entrada (sistema de motion, ver index.css):
   *   lead  → títulos y texto (recorrido largo, 520ms) — default
   *   card  → tarjetas de grilla (corto + escala, 420ms)
   *   media → mockups e imágenes (el más largo, 640ms)
   */
  variant?: 'lead' | 'card' | 'media'
}

/**
 * Aplica fade-up cuando el elemento entra al viewport.
 * Respeta `prefers-reduced-motion` (devuelve inView=true al toque).
 *
 * Tipo trick: cuando `as` es 'section' o 'article', usamos casting interno
 * para evitar tipar overload completo del JSX intrinsic. Simple por diseño.
 */
export function AnimatedSection({
  children,
  delay = 0,
  as = 'div',
  variant = 'lead',
  className = '',
  style,
  ...rest
}: Props) {
  const { ref, inView } = useInView<HTMLDivElement>()

  const combinedClass = [
    inView ? `enter-${variant}` : 'opacity-0',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const combinedStyle = {
    ...style,
    animationDelay: inView && delay ? `${delay}ms` : undefined,
  }

  const Comp = as as 'div'
  return (
    <Comp ref={ref} className={combinedClass} style={combinedStyle} {...rest}>
      {children}
    </Comp>
  )
}
