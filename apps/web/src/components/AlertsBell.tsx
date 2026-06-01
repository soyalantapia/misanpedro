import { useEffect, useMemo, useState } from 'react'
import { Bell, X, Sparkles, Check, BellRing, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApiMerchants, useApiCoupons } from '@/lib/apiQueries'
import {
  useAlerts,
  setAlertCoupons,
  markAllSeen,
  setCategories,
  setPushEnabled,
  type AlertCoupon,
} from '@/lib/alerts'
import {
  getPushState,
  subscribePush,
  unsubscribePush,
  syncPushCategories,
  type PushState,
} from '@/lib/push'
import { CATEGORIAS, type Categoria } from '@/lib/types'
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

export function AlertsBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const merchantsRes = useApiMerchants()
  const couponsRes = useApiCoupons()
  const { feed, unread, categories } = useAlerts()

  // Construimos los AlertCoupon mapeando cada cupón a su comercio (categoría + nombre).
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
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-status-error px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <AlertsPanel
          feed={feed}
          categories={categories}
          onClose={() => setOpen(false)}
          onOpenCoupon={(id) => {
            setOpen(false)
            navigate(`/cupon/${id}`)
          }}
        />
      )}
    </>
  )
}

function AlertsPanel({
  feed,
  categories,
  onClose,
  onOpenCoupon,
}: {
  feed: AlertCoupon[]
  categories: Categoria[]
  onClose: () => void
  onOpenCoupon: (id: string) => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const followsAll = categories.length === 0
  const cats = useMemo(() => CATEGORIAS, [])

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
        const r = await subscribePush(categories)
        if (r.ok) {
          setPushEnabled(true)
          setPushState('subscribed')
          setPushMsg('Listo, te vamos a avisar cuando haya cupones nuevos.')
        } else {
          setPushMsg(r.error ?? 'No se pudo activar.')
        }
      }
    } finally {
      setPushBusy(false)
    }
  }

  function changeCategory(cat: Categoria) {
    const next = categories.includes(cat)
      ? categories.filter((c) => c !== cat)
      : [...categories, cat]
    setCategories(next)
    void syncPushCategories(next)
  }

  return (
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
            className="grid h-8 w-8 place-items-center rounded-full text-fin-faint hover:bg-fin-surface2 hover:text-neutral-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Toggle de notificaciones push */}
          {pushState !== 'unsupported' && (
            <div className="mb-4 rounded-2xl bg-fin-surface2 p-3 ring-1 ring-fin-line">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fin-bg text-fin-lime">
                  <BellRing size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-fin-ink">Notificaciones</p>
                  <p className="text-[11px] text-fin-soft">
                    Avisos al celular cuando haya un cupón nuevo.
                  </p>
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
                      'absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-all duration-200',
                      subscribed ? 'left-[22px]' : 'left-0.5',
                    )}
                  >
                    {pushBusy && <Loader2 size={11} className="animate-spin text-fin-lime2" />}
                  </span>
                </button>
              </div>
              {pushState === 'denied' && (
                <p className="mt-2 text-[11px] text-fin-danger">
                  Activá las notificaciones en los permisos del navegador para este sitio.
                </p>
              )}
              {pushMsg && <p className="mt-2 text-[11px] text-fin-soft">{pushMsg}</p>}
            </div>
          )}

          {/* Feed de novedades */}
          <p className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">
            Novedades para vos
          </p>
          {feed.length === 0 ? (
            <div className="mt-2 flex flex-col items-center gap-2 rounded-2xl bg-fin-surface2 px-4 py-8 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-fin-bg text-fin-faint">
                <Sparkles size={16} />
              </span>
              <p className="text-xs text-fin-soft">
                Cuando un comercio publique un cupón nuevo en tus categorías, te avisamos acá.
              </p>
            </div>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {feed.slice(0, 12).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCoupon(c.id)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-fin-surface2"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fin-lime text-xs font-extrabold text-fin-bg shadow-fin-glow">
                      {c.porcentaje}%
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-fin-ink">
                        {c.titulo}
                      </span>
                      <span className="block truncate text-[11px] text-fin-soft">
                        {c.merchantNombre} · {timeAgo(objectIdTime(c.id))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Preferencias */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">
                Tus intereses
              </p>
              {!followsAll && (
                <button
                  type="button"
                  onClick={() => setCategories([])}
                  className="text-[11px] font-semibold text-fin-lime hover:text-fin-lime2"
                >
                  Seguir todas
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-fin-soft">
              {followsAll
                ? 'Te avisamos de cupones nuevos de cualquier rubro. Elegí categorías para enfocar.'
                : 'Sólo te avisamos de cupones nuevos en estas categorías.'}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {cats.map((cat) => {
                const active = categories.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => changeCategory(cat.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                      active
                        ? 'bg-fin-lime text-fin-bg shadow-fin-glow'
                        : 'bg-fin-surface2 text-fin-soft ring-1 ring-fin-line hover:text-fin-ink',
                    )}
                  >
                    {active && <Check size={11} />}
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
