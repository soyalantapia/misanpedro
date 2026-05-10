import { useEffect, useRef, useState } from 'react'
import { Bell, ScanLine, Tag, X } from 'lucide-react'
import { useMerchantNotifications, type MerchantNotifEvent } from '@/lib/useMerchantNotifications'
import { useNavigate } from 'react-router-dom'

function timeAgo(ts: number) {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return 'recién'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

function eventLine(e: MerchantNotifEvent) {
  const nombre = e.payload?.userNombre ?? 'Un cliente'
  const cupon = e.payload?.couponTitulo ?? 'un cupón'
  if (e.type === 'redemption.created') return `${nombre} canjeó: ${cupon}`
  if (e.type === 'activation.created') return `${nombre} activó: ${cupon}`
  return 'Nuevo evento'
}

export function NotificationsBell({ compact = false }: { compact?: boolean }) {
  const { events, unread, markAllRead, clearAll } = useMerchantNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onClickOutside(ev: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(ev.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onClickOutside)
      return () => document.removeEventListener('mousedown', onClickOutside)
    }
  }, [open])

  function toggle() {
    setOpen((s) => {
      const next = !s
      if (next && unread > 0) {
        // Marcamos como leídas al abrir
        setTimeout(markAllRead, 200)
      }
      return next
    })
  }

  const sizeClass = compact ? 'h-9 w-9' : 'h-10 w-10'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notificaciones"
        className={`relative grid ${sizeClass} place-items-center rounded-full bg-primary-100 text-neutral-500 transition-colors hover:bg-primary-200 hover:text-neutral-900`}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-status-error-fg px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-3 shadow-floating ring-1 ring-neutral-100">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-sm font-bold text-neutral-900">Actividad reciente</p>
            <div className="flex items-center gap-2">
              {events.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-700"
                >
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="grid h-6 w-6 place-items-center rounded-full text-neutral-400 hover:bg-primary-100 hover:text-neutral-700"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-100 text-neutral-400">
                <Bell size={16} />
              </div>
              <p className="text-xs text-neutral-500">
                Sin actividad por ahora. Los canjes y activaciones aparecen acá en tiempo real.
              </p>
            </div>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {events.map((e) => {
                const Icon = e.type === 'redemption.created' ? ScanLine : Tag
                const goTo = () => {
                  setOpen(false)
                  if (e.type === 'redemption.created') navigate('/admin')
                  else navigate('/admin/clientes')
                }
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={goTo}
                      className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-primary-50"
                    >
                      <span
                        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                          e.type === 'redemption.created'
                            ? 'bg-accent-50 text-accent-600'
                            : 'bg-status-success-bg text-status-success-fg'
                        }`}
                      >
                        <Icon size={12} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-neutral-800">
                          {eventLine(e)}
                        </p>
                        <p className="text-[10px] text-neutral-400">{timeAgo(e.receivedAt)}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
