import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Store, Search } from 'lucide-react'
import { owner } from '@/lib/api'
import { fmtDate } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

const PAGE_SIZE = 50

export function MerchantsPage() {
  const [params, setParams] = useSearchParams()
  const appId = params.get('appId') ?? ''
  const estado = params.get('estado') ?? ''

  const [merchants, setMerchants] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [apps, setApps] = useState<Array<{ id: string; nombre: string; slug: string }>>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // id del comercio cuya acción está en curso, para deshabilitar su botón.
  const [actingId, setActingId] = useState<string | null>(null)

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

  // Reset + primera página cuando cambian los filtros.
  useEffect(() => {
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await owner.listMerchants({
          appId: appId || undefined,
          estado: estado || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        })
        setMerchants(res.merchants)
        setTotal(res.total)
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando comercios')
        setMerchants([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    })()
  }, [appId, estado])

  async function loadMore() {
    setLoadingMore(true)
    setError(null)
    try {
      const res = await owner.listMerchants({
        appId: appId || undefined,
        estado: estado || undefined,
        limit: PAGE_SIZE,
        offset: merchants.length,
      })
      setMerchants((prev) => [...prev, ...res.merchants])
      setTotal(res.total)
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando más comercios')
    } finally {
      setLoadingMore(false)
    }
  }

  async function toggleEstado(m: any) {
    const isActive = m.estado === 'activo'
    const next: 'activo' | 'suspendido' = isActive ? 'suspendido' : 'activo'
    if (isActive && !window.confirm(`¿Suspender el comercio "${m.nombre}"?`)) return
    setActingId(m._id)
    setError(null)
    try {
      const res = await owner.setMerchantEstado(m._id, next)
      const updated = res.merchant ?? { ...m, estado: next }
      setMerchants((prev) =>
        prev.map((x) => (x._id === m._id ? { ...x, ...updated } : x)),
      )
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo cambiar el estado')
    } finally {
      setActingId(null)
    }
  }

  const hasMore = merchants.length < total

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cross-app"
        title="Comercios"
        subtitle={`${total} comercios en total`}
      />

      {error && (
        <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

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
      ) : merchants.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Sin comercios"
          description="Probá cambiar los filtros o sumar comercios desde el panel de cada app."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-neutral-200">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-xs font-bold uppercase tracking-widest text-neutral-500">
                <tr>
                  <th className="px-4 py-3 text-left">Comercio</th>
                  <th className="px-4 py-3 text-left">App</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Creado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {merchants.map((m) => {
                  const isActive = m.estado === 'activo'
                  const acting = actingId === m._id
                  return (
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
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleEstado(m)}
                          disabled={acting}
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors disabled:opacity-50 ${
                            isActive
                              ? 'text-danger ring-danger/30 hover:bg-danger-bg'
                              : 'text-success ring-success/30 hover:bg-success-bg'
                          }`}
                        >
                          {acting ? '…' : isActive ? 'Suspender' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                {loadingMore
                  ? 'Cargando…'
                  : `Cargar más (${merchants.length} de ${total})`}
              </button>
            </div>
          )}
        </>
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
