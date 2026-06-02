import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Input + Textarea + Field (wrapper con label/error/help).
 * Color y sombra viven acá; las páginas pasan props de comportamiento.
 *
 *   <Field label="Nombre" required error={errors.nombre}>
 *     <Input value={x} onChange={…} placeholder="…" />
 *   </Field>
 */

export const inputClasses =
  'w-full rounded-2xl bg-surface px-4 py-3 text-sm text-ink ' +
  'ring-1 ring-line placeholder:text-ink-faint ' +
  'focus:outline-none focus:ring-2 focus:ring-brand'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(inputClasses, className)} {...rest} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(inputClasses, 'resize-none', className)} {...rest} />
  },
)

export type FieldProps = {
  label: string
  children: ReactNode
  required?: boolean
  hint?: string
  /** Texto rojo abajo (validación al submit). */
  error?: string
  /** Texto informativo abajo (longitud, tip). */
  help?: string
  /** Para scroll-to-error en submit. */
  fieldKey?: string
  className?: string
}

export function Field({
  label,
  children,
  required,
  hint,
  error,
  help,
  fieldKey,
  className,
}: FieldProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)} data-field={fieldKey}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </span>
        {hint && <span className="text-[11px] tabular-nums text-ink-faint">{hint}</span>}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-[11px] font-semibold text-danger">
          {error}
        </p>
      ) : (
        help && <p className="text-[11px] text-ink-faint">{help}</p>
      )}
    </label>
  )
}
