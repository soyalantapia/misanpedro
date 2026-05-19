import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users, Search } from 'lucide-react'
import { owner } from '@/lib/api'
import { fmtDate } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'

export function UsersPage() {
  const [params, setParams] = useSearchParams()
  const appId = params.get('appId') ?? ''
  const [q, setQ] = useState(params.get('q') ?? '')

  const [data, setData] = useState<{ users: any[]; total: number }>({ users: [], total: 0 })
  const [apps, setApps] = useState<Array<{ id: string; nombre: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const a = await owner.listApps()
        setApps(a.apps.map((x) => ({ id: x.id, nombre: x.nombre })))
      } catch {
        /* noop */
      }
    })()
  }, [])

  // Search debounced
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (q) next.set('q', q)
      else next.delete('q')
      setParams(next, { replace: true })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  useEffect(() => {
    setLoading(true)
    void (async () => {
      try {
        const res = await owner.listUsers({
          appId: appId || undefined,
          q: params.get('q') || undefined,
          limit: 100,
        })
        setData({ users: res.users, total: res.total })
      } catch {
        setData({ users: [], total: 0 })
      } finally {
        setLoading(false)
      }
    })()
  }, [appId, params])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cross-app"
        title="Vecinos"
        subtitle={`${data.total} vecinos en total`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-neutral-200">
          <Search size={12} className="text-neutral-400" />
          <span className="text-neutral-500">App:</span>
          <select
            value={appId}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              if (e.target.value) next.set('appId', e.target.value)
              else next.delete('appId')
              setParams(next)
            }}
            className="bg-transparent font-bold text-neutral-900 focus:outline-none"
          >
            <option value="">Todas</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-neutral-200">
          <Search size={12} className="text-neutral-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre / email / DNI…"
            className="w-56 bg-transparent text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      ) : data.users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin vecinos"
          description="No hay vecinos que cumplan los filtros."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-xs font-bold uppercase tracking-widest text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">Vecino</th>
                <th className="px-4 py-3 text-left">App</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">WhatsApp</th>
                <th className="px-4 py-3 text-right">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.users.map((u) => (
                <tr key={u._id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-neutral-900">{u.nombre}</p>
                    <p className="text-xs text-neutral-500">DNI {u.dni}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {u.appId?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">{u.email}</td>
                  <td className="px-4 py-3 text-xs text-neutral-600">{u.whatsapp}</td>
                  <td className="px-4 py-3 text-right text-xs text-neutral-500">
                    {fmtDate(u.createdAt)}
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
