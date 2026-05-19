import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="grid place-items-center rounded-2xl bg-white p-10 ring-1 ring-neutral-200">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-500">
          <Icon size={20} />
        </span>
        <h3 className="text-base font-bold text-neutral-900">{title}</h3>
        {description && <p className="max-w-sm text-sm text-neutral-500">{description}</p>}
        {action}
      </div>
    </div>
  )
}
