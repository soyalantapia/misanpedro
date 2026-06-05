import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, X, Sparkles, BellRing, Loader2, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApiMerchants, useApiCoupons } from '@/lib/apiQueries'
import {
  useAlerts,
  setAlertCoupons,
  markAllSeen,
  setPushEnabled,
  pushCategories,
  type AlertCoupon,
} from '@/lib/alerts'
import {
  getPushState,
  subscribePush,
  unsubscribePush,
  type PushState,
} from '@/lib/push'
import { type Categoria } from '@/lib/types'
import { cn } from '@/lib/cn'

function objectIdTime(id: string): number {
  if (typeof id !== 'string' || id.length < 8) return 0
  const ts = parseInt(id.slice(0, 8), 16)
  return Number.isFinite(ts) ? ts * 1000 : 0
}

function timeAgo(ms: number): string {
  if (!ms) return ''
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'recién'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

/** Mantiene el store de alert-coupons sincronizado con la API. Lo llama el bell
 *  (siempre montado en el AppShell) → el feed queda disponible para el panel y
 *  para la página /alertas sin duplicar el mapeo. */
export function useAlertCouponsSync() {
  const merchantsRes = useApiMerchants()
  const couponsRes = useApiCoupons()
  useEffect(() => {
    if (!merchantsRes.data || !couponsRes.data) return
    const byId = new Map(
      merchantsRes.data.map((m) => [m.id, { slug: m.slug, nombre: m.nombre, categoria: m.categoria }]),
    )
    const list: AlertCoupon[] = []
    for (const c of couponsRes.data) {
      if (c.estado !== 'activo') continue
      const m = byId.get(c.merchantId) ?? c.merchant
      if (!m) continue
      list.push({
        id: c.id,
        titulo: c.titulo,
        porcentaje: c.porcentaje,
        merchantSlug: m.slug,
        merchantNombre: m.nombre,
        categoria: m.categoria as Categoria,
      })
    }
    setAlertCoupons(list)
  }, [merchantsRes.data, couponsRes.data])
}

export function AlertsBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { unread } = useAlerts()
  useAlertCouponsSync()

  function openPanel() {
    setOpen(true)
    setTimeout(markAllSeen, 400)
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={unread > 0 ? `Alertas: ${unread} nuevos` : 'Alertas'}
        className="relative grid h-9 w-9 place-items-center rounded-full bg-fin-surface2 text-fin-soft ring-1 ring-fin-line transition-colors hover:text-fin-ink"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-status-error px-1 text-[10px] font-bold text-on-brand ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <AlertsPanel
          onClose={() => setOpen(false)}
          onOpenCoupon={(id) => {
            setOpen(false)
            navigate(`/cupon/${id}`)
          }}
          onManage={() => {
            setOpen(false)
            navigate('/alertas')
          }}
        />
      )}
    </>
  )
}

function AlertsPanel({
  onClose,
  onOpenCoupon,
  onManage,
}: {
  onClose: () => void
  onOpenCoupon: (id: string) => void
  onManage: () => void
}) {
  const { feed } = useAlerts()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:justify-end sm:p-4">
      <button
        type="button"
        aria-label="Cerrar alertas"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Alertas"
        className="animate-toast-in-mobile relative flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-fin-surface ring-1 ring-fin-line shadow-fin-card sm:max-w-sm sm:rounded-3xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-fin-line px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-fin-lime/15 text-fin-lime">
              <Bell size={15} />
            </span>
            <h2 className="text-base font-bold text-fin-ink">Alertas</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-8 w-8 place-items-center rounded-full text-fin-faint hover:bg-fin-surface2 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <PushToggle />
          <p className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">
            Coinciden con tus alertas
          </p>
          <MatchFeed coupons={feed} onOpen={onOpenCoupon} className="mt-2" />
          <button
            type="button"
            onClick={onManage}
            className="mt-4 flex w-full items-center justify-between rounded-2xl bg-fin-surface2 px-4 py-3 text-sm font-bold text-fin-ink ring-1 ring-fin-line transition-colors hover:bg-fin-surface2/70"
          >
            Gestionar mis alertas
            <ChevronRight size={16} className="text-fin-lime" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Toggle de notificaciones push. Reutilizado por el panel del header y /alertas. */
export function PushToggle() {
  const [pushState, setPushState] = useState<PushState | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  useEffect(() => {
    getPushState().then(setPushState)
  }, [])

  const subscribed = pushState === 'subscribed'

  async function togglePush() {
    if (pushBusy) return
    setPushBusy(true)
    setPushMsg(null)
    try {
      if (subscribed) {
        await unsubscribePush()
        setPushEnabled(false)
        setPushState('ready')
      } else {
        const r = await subscribePush(pushCategories())
        if (r.ok) {
          setPushEnabled(true)
          setPushState('subscribed')
          setPushMsg('Listo, te avisamos al celular cuando haya un cupón de tus alertas.')
        } else {
          setPushMsg(r.error ?? 'No se pudo activar.')
        }
      }
    } finally {
      setPushBusy(false)
    }
  }

  if (pushState === 'unsupported') return null

  return (
    <div className="mb-4 rounded-2xl bg-fin-surface2 p-3 ring-1 ring-fin-line">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fin-bg text-fin-lime">
          <BellRing size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-fin-ink">Notificaciones</p>
          <p className="text-[11px] text-fin-soft">Avisos al celular cuando salte una alerta.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={subscribed}
          aria-label="Activar notificaciones"
          disabled={pushBusy || pushState === 'denied'}
          onClick={togglePush}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50',
            subscribed ? 'bg-fin-lime' : 'bg-fin-line',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-surface shadow transition-all duration-200',
              subscribed ? 'left-[22px]' : 'left-0.5',
            )}
          >
            {pushBusy && <Loader2 size={11} className="animate-spin text-fin-lime2" />}
          </span>
        </button>
      </div>
      {pushState === 'denied' && (
        <p className="mt-2 text-[11px] text-fin-soft">
          Las notificaciones están bloqueadas en tu navegador. Activalas desde los permisos del
          sitio para recibir los avisos.
        </p>
      )}
      {pushMsg && <p className="mt-2 text-[11px] text-fin-soft">{pushMsg}</p>}
    </div>
  )
}

/** Lista de cupones que matchean (badge % + título + comercio·tiempo). */
export function MatchFeed({
  coupons,
  onOpen,
  emptyText = 'Cuando salga un cupón que coincida con tus alertas, lo vas a ver acá.',
  className,
}: {
  coupons: AlertCoupon[]
  onOpen: (id: string) => void
  emptyText?: string
  className?: string
}) {
  if (coupons.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-2 rounded-2xl bg-fin-surface2 px-4 py-8 text-center',
          className,
        )}
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-fin-bg text-fin-faint">
          <Sparkles size={16} />
        </span>
        <p className="text-xs text-fin-soft">{emptyText}</p>
      </div>
    )
  }
  return (
    <ul className={cn('flex flex-col gap-1.5', className)}>
      {coupons.slice(0, 20).map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-fin-surface2"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fin-lime text-xs font-extrabold text-fin-bg shadow-fin-glow">
              {c.porcentaje}%
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-fin-ink">{c.titulo}</span>
              <span className="block truncate text-[11px] text-fin-soft">
                {c.merchantNombre} · {timeAgo(objectIdTime(c.id))}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
