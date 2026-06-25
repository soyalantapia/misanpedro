import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, ShieldCheck, Mail, User, History } from 'lucide-react'
import { useAuth } from '@/lib/store'
import { owner } from '@/lib/api'
import { fmtRelative } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'

type AuditAction = { action: string; at: string; ip?: string; detail?: string }

export function SettingsPage() {
  const auth = useAuth()

  const [audit, setAudit] = useState<AuditAction[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setAuditLoading(true)
    setAuditError(null)
    owner
      .auditLog()
      .then((r) => {
        if (!alive) return
        // Más recientes primero.
        const sorted = [...(r.actions ?? [])].sort(
          (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
        )
        setAudit(sorted)
      })
      .catch((err: any) => {
        if (alive) setAuditError(err?.message ?? 'Error cargando el audit log')
      })
      .finally(() => {
        if (alive) setAuditLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Configuración" title="Settings" subtitle="Cuenta del owner" />

      <div className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
        <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
          <User size={14} /> Tu cuenta
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" value={auth.owner?.nombre} />
          <Field label="Email" value={auth.owner?.email} icon={Mail} />
          <Field label="Rol" value={auth.owner?.rol ?? 'super'} />
          <Field label="Acceso" value="Código por email (OTP)" icon={ShieldCheck} accent="success" />
        </dl>
      </div>

      <div className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
        <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
          <History size={14} /> Audit log
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Acciones recientes de tu cuenta, más nuevas primero.
        </p>

        {auditError && (
          <div className="mt-3 rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
            {auditError}
          </div>
        )}

        {auditLoading ? (
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-neutral-100" />
            ))}
          </div>
        ) : audit.length === 0 ? (
          <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500 ring-1 ring-neutral-200">
            Sin acciones registradas todavía.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-xl ring-1 ring-neutral-200">
            {audit.map((a, i) => (
              <li
                key={`${a.at}-${i}`}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-neutral-900">{a.action}</p>
                  {a.detail && <p className="mt-0.5 text-xs text-neutral-600">{a.detail}</p>}
                  {a.ip && <p className="mt-0.5 text-[10px] text-neutral-400">IP {a.ip}</p>}
                </div>
                <span className="shrink-0 text-xs text-neutral-500">{fmtRelative(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
        <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
          <SettingsIcon size={14} /> Próximamente
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-600">
          <li>· Equipo (sumar otros owners con roles diferenciados)</li>
          <li>· Webhook endpoints para integraciones externas</li>
          <li>· API keys para automatizaciones (CI/CD, scripts)</li>
          <li>· Configuración global del SaaS (precio default, etc.)</li>
        </ul>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | undefined
  icon?: any
  accent?: 'success'
}) {
  return (
    <div className="rounded-xl bg-neutral-50 px-4 py-3 ring-1 ring-neutral-200">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</p>
      <p
        className={`mt-1 inline-flex items-center gap-1.5 text-sm font-bold ${
          accent === 'success' ? 'text-success' : 'text-neutral-900'
        }`}
      >
        {Icon && <Icon size={12} />}
        {value ?? '—'}
      </p>
    </div>
  )
}
