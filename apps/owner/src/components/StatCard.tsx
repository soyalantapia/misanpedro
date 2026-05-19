import type { LucideIcon } from 'lucide-react'

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = 'accent',
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  accent?: 'accent' | 'success' | 'warning' | 'danger'
}) {
  const accentMap = {
    accent: 'bg-accent-50 text-accent-700',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
  } as const

  return (
    <article className="group rounded-2xl bg-white p-5 ring-1 ring-neutral-200 transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{label}</p>
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl transition-transform group-hover:scale-110 ${accentMap[accent]}`}
        >
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-neutral-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </article>
  )
}
