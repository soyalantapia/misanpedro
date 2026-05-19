import { cn } from '@/lib/cn'

const VARIANTS = {
  active: 'bg-success-bg text-success',
  pending: 'bg-warning-bg text-warning',
  suspended: 'bg-danger-bg text-danger',
  archived: 'bg-neutral-100 text-neutral-500',
} as const

const LABELS: Record<string, string> = {
  active: 'Activa',
  pending: 'Pendiente',
  suspended: 'Suspendida',
  archived: 'Archivada',
  activo: 'Activo',
  pending_payment: 'Pago pendiente',
  suspendido: 'Suspendido',
  cancelado: 'Cancelado',
}

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'active' || status === 'activo'
      ? 'active'
      : status === 'pending' || status === 'pending_payment'
        ? 'pending'
        : status === 'suspended' || status === 'suspendido'
          ? 'suspended'
          : 'archived'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        VARIANTS[variant],
      )}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status] ?? status}
    </span>
  )
}
