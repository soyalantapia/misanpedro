import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Botón único de la app — variants semánticas.
 * Toda la apariencia (color, sombra, hover) vive ACÁ; cambiar marca = cambiar
 * los tokens del @theme. Página = elegir variant.
 *
 *   <Button>Guardar</Button>                  primary degradé verde
 *   <Button variant="secondary">Cancelar</Button>
 *   <Button variant="ghost">Volver</Button>
 *   <Button variant="danger">Borrar</Button>
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-2xl font-bold ' +
  'transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ' +
  'focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg'

const variants: Record<Variant, string> = {
  // Degradé verde de marca (decisión del usuario). Hover oscurece.
  primary:
    'bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta ' +
    'hover:-translate-y-0.5 hover:from-brand-strong hover:to-brand-strong active:translate-y-0 active:scale-[0.98]',
  secondary:
    'bg-surface-2 text-ink ring-1 ring-line hover:bg-line hover:-translate-y-0.5 active:translate-y-0',
  ghost:
    'bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink',
  danger:
    'bg-danger text-on-brand hover:opacity-90 active:opacity-95',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
}

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {children}
    </button>
  )
})
