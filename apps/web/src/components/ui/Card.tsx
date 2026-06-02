import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Card de superficie estándar (panel sobre fondo). Variants:
 *   default — fondo elevado claro (admin: bg-surface)
 *   plain   — sin sombra ni ring, solo padding semántico
 *   brand   — acento de marca suave (bg-brand-soft) para destacar
 */

type Variant = 'default' | 'plain' | 'brand'
type Padding = 'sm' | 'md' | 'lg' | 'none'

const variants: Record<Variant, string> = {
  default: 'bg-surface ring-1 ring-line shadow-surface-card',
  plain: 'bg-surface',
  brand: 'bg-brand-soft ring-1 ring-brand/15',
}

const paddings: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant
  padding?: Padding
  children: ReactNode
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padding = 'lg', className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('rounded-3xl', variants[variant], paddings[padding], className)}
      {...rest}
    >
      {children}
    </div>
  )
})
