import { Children, isValidElement, cloneElement, type ReactNode, type ReactElement } from 'react'
import { useInView } from '@/lib/useInView'

type Variant = 'lead' | 'card' | 'media'

/**
 * Stagger de verdad: UN observer para todo el grupo, y el índice de cada hijo
 * viaja como la custom property `--i` que el CSS usa para el delay.
 *
 * Antes había tres fórmulas de delay incompatibles conviviendo (`60 + i*40`,
 * `80 + i*80`, y valores sueltos escritos a mano), cada una con su propio
 * IntersectionObserver por elemento. Resultado: N observers por grilla y un
 * ritmo distinto en cada sección. Acá el delay lo decide el CSS (capeado con
 * `min()`, ver index.css) y el observer es uno solo.
 *
 * Uso:
 *   <Stagger variant="card" className="grid gap-5 sm:grid-cols-3">
 *     {items.map((x) => <article key={x.id}>…</article>)}
 *   </Stagger>
 */
export function Stagger({
  children,
  variant = 'card',
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  variant?: Variant
  className?: string
  as?: 'div' | 'ul'
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const enterClass = `enter-${variant}`

  return (
    <Tag ref={ref as never} className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child
        const el = child as ReactElement<{ className?: string; style?: React.CSSProperties }>
        return cloneElement(el, {
          className: [el.props.className, inView ? enterClass : 'opacity-0']
            .filter(Boolean)
            .join(' '),
          style: { ...el.props.style, ['--i' as string]: i },
        })
      })}
    </Tag>
  )
}
