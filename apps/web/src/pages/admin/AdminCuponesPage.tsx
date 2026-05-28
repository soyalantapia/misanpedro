import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Tag,
  Plus,
  Activity,
  Pencil,
  Pause,
  Play,
  Trash2,
  MoreVertical,
} from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { couponsActions, useCouponsByMerchant } from '@/lib/couponsStore'
import { useRedemptionsForMerchant } from '@/lib/merchantQueries'
import { formatVigencia } from '@/lib/format'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { useApiMyCoupons, useApiRecentRedemptions } from '@/lib/apiQueries'
import { api, ApiError } from '@/lib/api'

export function AdminCuponesPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const localCupones = useCouponsByMerchant(merchantId)
  const localRedemptions = useRedemptionsForMerchant(merchantId)
  const apiCupones = useApiMyCoupons()
  const apiRedemptions = useApiRecentRedemptions(200)
  const toast = useToast()

  const cupones = apiCupones.data ?? localCupones
  const redemptions = apiRedemptions.data ?? localRedemptions
  const usingApi = apiCupones.data !== null

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmPause, setConfirmPause] = useState<{ id: string; isPausado: boolean } | null>(null)

  // Cerrar el dropdown con Escape
  useEffect(() => {
    if (!openMenuId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenuId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openMenuId])

  const canjesPorCupon = useMemo(() => {
    const map = new Map<string, number>()
    redemptions.forEach((r: any) => {
      const id = String(r.couponId)
      map.set(id, (map.get(id) ?? 0) + 1)
    })
    return map
  }, [redemptions])

  async function togglePause(id: string, isPausado: boolean) {
    if (usingApi) {
      try {
        await api.merchantCoupons.update(id, {
          estado: isPausado ? 'activo' : 'pausado',
        })
        apiCupones.refetch()
      } catch (err) {
        toast.error('No se pudo actualizar', err instanceof ApiError ? err.message : 'Sin conexión')
        return
      }
    } else {
      couponsActions.setEstado(id, isPausado ? 'activo' : 'pausado')
    }
    toast.success(
      isPausado ? 'Cupón reactivado' : 'Cupón pausado',
      isPausado ? 'Vuelve a estar visible para los vecinos.' : 'Ya no aparece en el listado.',
    )
    setOpenMenuId(null)
  }

  async function handleDelete(id: string) {
    if (usingApi) {
      try {
        await api.merchantCoupons.delete(id)
        apiCupones.refetch()
      } catch (err) {
        toast.error('No se pudo eliminar', err instanceof ApiError ? err.message : 'Sin conexión')
        setConfirmDelete(null)
        return
      }
    } else {
      couponsActions.remove(id)
    }
    toast.success('Cupón eliminado', 'No se podrá reactivar.')
    setConfirmDelete(null)
    setOpenMenuId(null)
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          {/* F13 — Glosario consistente:
              · "Descuento" = lo que el comercio crea (panel)
              · "Cupón"     = lo que el vecino activa (app vecino)
              · "Campaña"   = WhatsApp masivo
              Antes el chip decía "MIS CUPONES" pero el h1 "Descuentos del
              comercio" → dos palabras para lo mismo en la misma pantalla.
              Ahora ambos dicen "Descuentos" (palabra del lado comercio). */}
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
            <Tag size={12} /> Mis descuentos
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Descuentos del comercio
          </h1>
          <p className="text-sm text-neutral-500">
            Crear, editar, pausar o eliminar los descuentos que ofrecés a los vecinos.
          </p>
        </div>
        {/* F8: el botón "Crear nuevo" del header se oculta cuando hay empty state
            (el EmptyState ya tiene su propio CTA grande "Crear primer cupón"),
            evitando dos botones que hacen lo mismo. Sólo se muestra cuando hay
            cupones cargados. */}
        {cupones.length > 0 && (
          <Link
            to="/admin/cupones/nuevo"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-4 py-2.5 text-xs font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5"
          >
            <Plus size={14} /> Crear nuevo
          </Link>
        )}
      </header>

      {apiCupones.loading && localCupones.length === 0 ? (
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white ring-1 ring-neutral-100" />
          ))}
        </div>
      ) : cupones.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No tenés cupones cargados"
          description="Cuando crees tu primer descuento, va a aparecer en la app del vecino."
          action={
            <Link
              to="/admin/cupones/nuevo"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-5 py-2.5 text-sm font-bold text-white shadow-cta hover:-translate-y-0.5 transition-all"
            >
              <Plus size={14} /> Crear primer cupón
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {cupones.map((c) => {
            const canjes = canjesPorCupon.get(c.id) ?? 0
            const isPausado = c.estado === 'pausado'
            const menuOpen = openMenuId === c.id
            return (
              <div
                key={c.id}
                className={cn(
                  'rounded-2xl bg-white p-4 shadow-card ring-1 ring-neutral-100 transition-opacity',
                  isPausado && 'opacity-70',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 font-bold tabular-nums">
                    {c.porcentaje}%
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold leading-tight text-neutral-900">
                        {c.titulo}
                      </h3>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(menuOpen ? null : c.id)}
                          aria-label="Acciones"
                          className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 hover:bg-primary-100 hover:text-neutral-700"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {menuOpen && (
                          <>
                            <button
                              type="button"
                              aria-label="Cerrar menú"
                              className="fixed inset-0 z-30 cursor-default"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="animate-fade-in absolute right-0 top-9 z-40 flex w-48 flex-col overflow-hidden rounded-2xl bg-white py-1 shadow-floating ring-1 ring-neutral-100">
                              <Link
                                to={`/admin/cupones/${c.id}/editar`}
                                onClick={() => setOpenMenuId(null)}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-primary-50"
                              >
                                <Pencil size={12} /> Editar
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  setConfirmPause({ id: c.id, isPausado })
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-left text-xs font-semibold text-neutral-700 hover:bg-primary-50"
                              >
                                {isPausado ? <Play size={12} /> : <Pause size={12} />}
                                {isPausado ? 'Reactivar' : 'Pausar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  setConfirmDelete(c.id)
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-left text-xs font-semibold text-status-error-fg hover:bg-status-error-bg"
                              >
                                <Trash2 size={12} /> Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {c.diasAplica && (
                      <p className="text-[11px] text-neutral-500">{c.diasAplica}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StateBadge estado={c.estado} />
                      <span className="text-[11px] text-neutral-400">
                        {formatVigencia(c.vigenciaHasta)}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-neutral-700 tabular-nums">
                        <Activity size={10} /> {canjes} {canjes === 1 ? 'canje' : 'canjes'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-neutral-400">
        ¿Querés ver cómo se ven en la app del vecino?{' '}
        <Link to="/" className="font-bold text-accent-700">
          Abrir app del vecino
        </Link>
      </p>

      <ConfirmDialog
        open={!!confirmDelete}
        title="¿Eliminar este cupón?"
        description="No se podrá recuperar. Los canjes ya registrados se mantienen en el historial."
        confirmLabel="Sí, eliminar"
        cancelLabel="Volver"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />

      <ConfirmDialog
        open={!!confirmPause}
        title={confirmPause?.isPausado ? '¿Reactivar este cupón?' : '¿Pausar este cupón?'}
        description={
          confirmPause?.isPausado
            ? 'Volvés a hacerlo visible para los vecinos en la app.'
            : 'Dejará de aparecer para los vecinos hasta que lo reactives.'
        }
        confirmLabel={confirmPause?.isPausado ? 'Sí, reactivar' : 'Sí, pausar'}
        cancelLabel="Volver"
        onCancel={() => setConfirmPause(null)}
        onConfirm={() => {
          if (confirmPause) {
            void togglePause(confirmPause.id, confirmPause.isPausado)
            setConfirmPause(null)
          }
        }}
      />
    </div>
  )
}

function StateBadge({ estado }: { estado: string }) {
  const cls =
    estado === 'activo'
      ? 'bg-status-success-bg text-status-success-fg'
      : estado === 'pausado'
        ? 'bg-status-warning-bg text-status-warning-fg'
        : estado === 'agotado'
          ? 'bg-status-info-bg text-status-info-fg'
          : 'bg-primary-100 text-neutral-500'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${cls}`}
    >
      {estado}
    </span>
  )
}
