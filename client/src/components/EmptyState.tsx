import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="animate-fade-in mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-card ring-1 ring-neutral-100">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-100 text-neutral-500">
        <Icon size={26} />
      </div>
      <div>
        <h3 className="text-base font-bold text-neutral-900">{title}</h3>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
