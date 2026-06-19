import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, ShieldCheck, Mail, User } from 'lucide-react'
import { useAuth } from '@/lib/store'
import { owner } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'

export function SettingsPage() {
  const auth = useAuth()
  // 2FA real: lo trae GET /owner/me (totpEnabled), no es un literal fijo.
  const [twoFA, setTwoFA] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    owner
      .me()
      .then((r) => {
        if (alive) setTwoFA(!!r.owner?.totpEnabled)
      })
      .catch(() => {
        if (alive) setTwoFA(null)
      })
    return () => {
      alive = false
    }
  }, [])

  const twoFALabel = twoFA === null ? '—' : twoFA ? 'Activado' : 'No configurado'

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
          <Field
            label="2FA"
            value={twoFALabel}
            icon={ShieldCheck}
            accent={twoFA ? 'success' : undefined}
          />
        </dl>
      </div>

      <div className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
        <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
          <SettingsIcon size={14} /> Próximamente
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-600">
          <li>· Equipo (sumar otros owners con roles diferenciados)</li>
          <li>· Audit log completo de acciones cross-tenant</li>
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
