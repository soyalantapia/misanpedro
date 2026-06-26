import { useEffect, useState } from 'react'
import { History, User } from 'lucide-react'
import { owner } from '@/lib/api'
import { fmtRelative } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'

type Entry = Awaited<ReturnType<typeof owner.audit>>['entries'][number]

const PAGE = 50

// Etiquetas legibles + color por familia de acción.
const ACTION_META: Record<string, { label: string; color: string }> = {
  'auth.login': { label: 'Inició sesión', color: 'bg-neutral-100 text-neutral-600' },
  'app.create': { label: 'Creó ciudad', color: 'bg-accent-50 text-accent-700' },
  'app.update': { label: 'Editó ciudad', color: 'bg-accent-50 text-accent-700' },
  'merchant.suspend': { label: 'Suspendió comercio', color: 'bg-warning-bg text-warning' },
  'merchant.reactivate': { label: 'Reactivó comercio', color: 'bg-success-bg/60 text-success' },
  'admin.invite': { label: 'Invitó admin', color: 'bg-accent-50 text-accent-700' },
  'admin.role-change': { label: 'Cambió rol', color: 'bg-accent-50 text-accent-700' },
  'admin.disable': { label: 'Deshabilitó admin', color: 'bg-danger-bg text-danger' },
}
function meta(action: string) {
  return ACTION_META[action] ?? { label: action, color: 'bg-neutral-100 text-neutral-600' }
}

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Todo' },
  { value: 'auth.login', label: 'Logins' },
  { value: 'app.update', label: 'Ciudades' },
  { value: 'merchant.suspend', label: 'Comercios' },
  { value: 'admin.invite', label: 'Equipo' },
]

export function AuditPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    owner
      .audit({ limit: PAGE, offset: 0, action: filter || undefined })
      .then((r) => {
        if (!alive) return
        setEntries(r.entries)
        setTotal(r.total)
      })
      .catch((err: unknown) => alive && setError((err as Error)?.message ?? 'Error cargando la auditoría'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [filter])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const r = await owner.audit({ limit: PAGE, offset: entries.length, action: filter || undefined })
      setEntries((prev) => [...prev, ...r.entries])
      setTotal(r.total)
    } catch {
      /* noop */
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Trazabilidad" title="Auditoría" subtitle="Quién hizo qué en el panel de gestión" />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.value ? 'bg-accent-500 text-white' : 'bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-2xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="Sin actividad" description="Todavía no hay acciones registradas para este filtro." />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Detalle</th>
                  <th className="px-4 py-3 text-right">Cuándo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {entries.map((e) => {
                  const m = meta(e.action)
                  return (
                    <tr key={e.id} className="hover:bg-neutral-50/60">
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${m.color}`}>{m.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-neutral-700">
                          <User size={12} className="text-neutral-400" />
                          <span className="truncate">{e.adminNombre || e.admin}</span>
                        </span>
                      </td>
                      <td className="hidden max-w-xs px-4 py-3 sm:table-cell">
                        <span className="block truncate text-neutral-500">{e.detail || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-neutral-400">{fmtRelative(e.at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {entries.length < total && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mx-auto block rounded-full bg-white px-5 py-2 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-60"
            >
              {loadingMore ? 'Cargando…' : `Cargar más (${entries.length} de ${total})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
