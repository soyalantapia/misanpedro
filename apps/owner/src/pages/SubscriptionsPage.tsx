import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, Search } from 'lucide-react'
import { owner } from '@/lib/api'
import { fmtDate, fmtMoney } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  authorized: 'Activa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
  rejected: 'Rechazada',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning-bg text-warning',
  authorized: 'bg-success-bg text-success',
  paused: 'bg-neutral-100 text-neutral-500',
  cancelled: 'bg-danger-bg text-danger',
  rejected: 'bg-danger-bg text-danger',
}

export function SubscriptionsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const [subs, setSubs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void (async () => {
      try {
        const res = await owner.listSubscriptions({
          status: status || undefined,
          limit: 200,
        })
        setSubs(res.subscriptions)
      } finally {
        setLoading(false)
      }
    })()
  }, [status])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Pagos"
        subtitle="Suscripciones MercadoPago cross-app"
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-neutral-200">
          <Search size={12} className="text-neutral-400" />
          <span className="text-neutral-500">Estado:</span>
          <select
            value={status}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              if (e.target.value) next.set('status', e.target.value)
              else next.delete('status')
              setParams(next)
            }}
            className="bg-transparent font-bold text-neutral-900 focus:outline-none"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      ) : subs.length === 0 ? (
        <EmptyState icon={CreditCard} title="Sin suscripciones" />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-xs font-bold uppercase tracking-widest text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">Comercio</th>
                <th className="px-4 py-3 text-left">App</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-left">Próx cobro</th>
                <th className="px-4 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {subs.map((s) => (
                <tr key={s._id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-neutral-900">
                      {s.merchantId?.nombre ?? '—'}
                    </p>
                    <p className="text-[10px] text-neutral-400">{s.externalReference}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {s.appId?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs capitalize text-neutral-600">{s.plan}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-neutral-900">
                    {fmtMoney(s.amountARS)}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {fmtDate(s.nextBillingAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[s.status] ?? 'bg-neutral-100'}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
