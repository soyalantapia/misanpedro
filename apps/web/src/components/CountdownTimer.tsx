import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { formatTimeRemaining } from '@/lib/format'
import { cn } from '@/lib/cn'

export function CountdownTimer({
  expiresAt,
  onExpire,
  className,
}: {
  expiresAt: string
  onExpire?: () => void
  className?: string
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining = new Date(expiresAt).getTime() - now
  const expired = remaining <= 0

  useEffect(() => {
    if (expired && onExpire) onExpire()
  }, [expired, onExpire])

  const isWarning = remaining > 0 && remaining < 5 * 60 * 1000

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold tabular-nums transition-colors',
        expired
          ? 'bg-status-error-bg text-status-error-fg'
          : isWarning
            ? 'bg-status-warning-bg text-status-warning-fg'
            : 'bg-accent-50 text-accent-700',
        className,
      )}
    >
      <Timer size={14} />
      {expired ? 'Cupón expirado' : `Expira en ${formatTimeRemaining(expiresAt, now)}`}
    </div>
  )
}
