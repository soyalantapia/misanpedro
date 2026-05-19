import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Store, Search } from 'lucide-react'
import { owner } from '@/lib/api'
import { fmtDate } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

export function MerchantsPage() {
  const [params, setParams] = useSearchParams()
  const appId = params.get('appId') ?? ''
  const estado = params.get('estado') ?? ''

  const [data, setData] = useState<{ merchants: any[]; total: number }>({
    merchants: [],
    total: 0,
  })
  const [apps, setApps] = useState<Array<{ id: string; nombre: string; slug: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const a = await owner.listApps()
        setApps(a.apps.map((x) => ({ id: x.id, nombre: x.nombre, slug: x.slug })))
      } catch {
        /* noop */
      }
    })()
  }, [])

  useEffect(() => {
    setLoading(true)
    void (async () => {
      try {
        const res = await owner.listMerchants({
          appId: appId || undefined,
          estado: estado || undefined,
          limit: 100,
        })
        setData({ merchants: res.merchants, total: res.total })
      } catch {
        setData({ merchants: [], total: 0 })
      } finally {
        setLoading(false)
      }
    })()
  }, [appId, estado])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cross-app"
        title="Comercios"
        subtitle={`${data.total} comercios en total`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="App"
          value={appId}
          onChange={(v) => updateParam('appId', v)}
          options={[
            { value: '', label: 'Todas las apps' },
            ...apps.map((a) => ({ value: a.id, label: a.nombre })),
          ]}
        />
        <FilterSelect
          label="Estado"
          value={estado}
          onChange={(v) => updateParam('estado', v)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'activo', label: 'Activos' },
            { value: 'pending_payment', label: 'Pago pendiente' },
            { value: 'suspendido', label: 'Suspendidos' },
            { value: 'cancelado', label: 'Cancelados' },
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      ) : data.merchants.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Sin comercios"
          description="Probá cambiar los filtros o sumar comercios desde el panel de cada app."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-xs font-bold uppercase tracking-widest text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">Comercio</th>
                <th className="px-4 py-3 text-left">App</th>
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.merchants.map((m) => (
                <tr key={m._id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-neutral-900">{m.nombre}</p>
                    <p className="text-xs text-neutral-500">{m.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {m.appId?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs capitalize text-neutral-600">
                    {m.categoria}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.estado} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-neutral-500">
                    {fmtDate(m.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-neutral-200">
      <Search size={12} className="text-neutral-400" />
      <span className="text-neutral-500">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-bold text-neutral-900 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
