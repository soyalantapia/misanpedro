import { useEffect, useState } from 'react'
import { UserPlus, Shield, X, Loader2 } from 'lucide-react'
import { owner } from '@/lib/api'
import { useAuth } from '@/lib/store'
import { ROLES, rolLabel } from '@/lib/rbac'
import { fmtRelative } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'

type Admin = {
  id: string
  email: string
  nombre: string
  rol: string
  enabled: boolean
  lastLoginAt?: string | null
  invitedAt?: string | null
}

export function TeamPage() {
  const auth = useAuth()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await owner.listAdmins()
      setAdmins(r.admins ?? [])
    } catch (err) {
      setError((err as Error)?.message ?? 'No pudimos cargar el equipo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function changeRol(a: Admin, rol: string) {
    if (rol === a.rol) return
    setActingId(a.id)
    try {
      const r = await owner.updateAdmin(a.id, { rol })
      if (!r.ok) setError(r.error ?? 'No se pudo cambiar el rol')
      await load()
    } catch (err) {
      setError((err as Error)?.message ?? 'Error cambiando el rol')
    } finally {
      setActingId(null)
    }
  }

  async function toggleEnabled(a: Admin) {
    setActingId(a.id)
    try {
      const r = await owner.updateAdmin(a.id, { enabled: !a.enabled })
      if (!r.ok) setError(r.error ?? 'No se pudo actualizar')
      await load()
    } catch (err) {
      setError((err as Error)?.message ?? 'Error actualizando')
    } finally {
      setActingId(null)
    }
  }

  const isSelf = (a: Admin) => a.email === auth.owner?.email

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Permisos"
        title="Equipo"
        subtitle="Administradores del panel de gestión y sus roles."
        actions={
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-4 py-2 text-xs font-bold text-white shadow shadow-accent-500/30 transition-all hover:-translate-y-0.5"
          >
            <UserPlus size={13} /> Invitar administrador
          </button>
        }
      />

      {error && (
        <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">{error}</div>
      )}

      <div className="rounded-2xl bg-white ring-1 ring-neutral-200">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-400">
            <Loader2 size={16} className="animate-spin" /> Cargando equipo…
          </div>
        ) : admins.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="Todavía no hay administradores"
            description="Invitá a alguien para que gestione el negocio con vos."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/60 text-left text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  <th className="px-5 py-3">Administrador</th>
                  <th className="px-5 py-3">Rol</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Último ingreso</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-neutral-900">
                        {a.nombre}{' '}
                        {isSelf(a) && (
                          <span className="ml-1 rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-bold text-accent-700">vos</span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">{a.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={a.rol}
                        disabled={actingId === a.id || isSelf(a)}
                        onChange={(e) => changeRol(a, e.target.value)}
                        className="rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-900 ring-1 ring-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-60"
                        title={isSelf(a) ? 'No podés cambiar tu propio rol' : undefined}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          a.enabled
                            ? 'inline-flex items-center gap-1.5 rounded-full bg-success-bg/60 px-2.5 py-1 text-[11px] font-bold text-success'
                            : 'inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-500'
                        }
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${a.enabled ? 'bg-success' : 'bg-neutral-400'}`} />
                        {a.enabled ? 'Activo' : 'Deshabilitado'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-neutral-500">
                      {a.lastLoginAt ? fmtRelative(a.lastLoginAt) : 'Nunca'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!isSelf(a) && (
                        <button
                          type="button"
                          disabled={actingId === a.id}
                          onClick={() => toggleEnabled(a)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          {a.enabled ? 'Deshabilitar' : 'Reactivar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onDone={() => {
            setShowInvite(false)
            void load()
          }}
        />
      )}
    </div>
  )
}

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('viewer')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await owner.inviteAdmin({ email: email.trim().toLowerCase(), nombre: nombre.trim(), rol })
      if (!r.ok) {
        setError(r.error ?? 'No se pudo invitar')
        setSubmitting(false)
        return
      }
      onDone()
    } catch (err) {
      setError((err as Error)?.message ?? 'Error invitando')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-neutral-200">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Invitar administrador</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100">
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">Entra con su email y un código — sin contraseña.</p>

        {error && <div className="mt-3 rounded-xl bg-danger-bg px-3 py-2 text-xs font-semibold text-danger">{error}</div>}

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Nombre</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
              className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 ring-1 ring-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@email.com"
              className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 ring-1 ring-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Rol</span>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.desc}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-neutral-400">{rolLabel(rol)} · {ROLES.find((r) => r.value === rol)?.desc}</span>
          </label>
          <button
            type="submit"
            disabled={submitting || !email.includes('@') || nombre.trim().length < 2}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 px-5 py-3 text-sm font-bold text-white shadow shadow-accent-500/30 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Invitando…' : 'Enviar invitación'}
          </button>
        </form>
      </div>
    </div>
  )
}
