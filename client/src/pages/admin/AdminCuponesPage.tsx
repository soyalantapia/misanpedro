import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Tag, Plus, Activity } from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { COUPONS } from '@/data/mockData'
import { useRedemptionsForMerchant } from '@/lib/merchantQueries'
import { formatVigencia } from '@/lib/format'
import { EmptyState } from '@/components/EmptyState'

export function AdminCuponesPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const cupones = useMemo(() => COUPONS.filter((c) => c.merchantId === merchantId), [merchantId])
  const redemptions = useRedemptionsForMerchant(merchantId)

  const canjesPorCupon = useMemo(() => {
    const map = new Map<string, number>()
    redemptions.forEach((r) => {
      map.set(r.couponId, (map.get(r.couponId) ?? 0) + 1)
    })
    return map
  }, [redemptions])

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
            <Tag size={12} /> Mis cupones
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Descuentos del comercio
          </h1>
          <p className="text-sm text-neutral-500">
            Crear, editar, pausar o eliminar los descuentos que ofrecés a los vecinos.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Disponible en próxima iteración"
          className="hidden shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-4 py-2.5 text-xs font-bold text-white shadow-cta opacity-60 sm:inline-flex"
        >
          <Plus size={14} /> Crear nuevo
        </button>
      </header>

      {cupones.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No tenés cupones cargados"
          description="Cuando crees tu primer descuento, va a aparecer en la app del vecino."
        />
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-neutral-100">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              <tr>
                <th className="px-4 py-3">Descuento</th>
                <th className="px-4 py-3 text-center">Off</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3 text-center">Canjes</th>
                <th className="px-4 py-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {cupones.map((c) => {
                const canjes = canjesPorCupon.get(c.id) ?? 0
                return (
                  <tr key={c.id} className="hover:bg-primary-50/50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-neutral-900">{c.titulo}</p>
                      {c.diasAplica && (
                        <p className="text-[11px] text-neutral-500">{c.diasAplica}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold tabular-nums text-accent-700">
                      {c.porcentaje}%
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {formatVigencia(c.vigenciaHasta)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-neutral-700 tabular-nums">
                        <Activity size={10} /> {canjes}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StateBadge estado={c.estado} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-2xl bg-status-info-bg p-4 text-status-info-fg">
        <Tag size={14} className="mt-0.5 shrink-0" />
        <p className="text-xs font-medium">
          La gestión de cupones (crear, editar, pausar, control de stock) llega en la próxima
          iteración. Por ahora podés ver los cupones cargados y sus métricas en tiempo real.
        </p>
      </div>

      <p className="text-center text-xs text-neutral-400">
        ¿Querés ver cómo se ve un cupón desde la app del vecino?{' '}
        <Link to="/" className="font-bold text-accent-700">
          Abrir app del vecino
        </Link>
      </p>
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
