import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  Mail,
  Phone,
  IdCard,
  Cake,
  ShieldCheck,
  Download,
  Trash2,
  AlertTriangle,
  LogOut,
  Lock,
  FileText,
} from 'lucide-react'
import { habeasData, userApi, ApiError } from '@/lib/api'
import { useUser, userActions, demoStoreActions } from '@/lib/stores'
import { useToast } from '@/components/Toast'

const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string) ?? '5493329000000'

export function PerfilPage() {
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!user) return <Navigate to="/login" replace />

  async function handleExport() {
    setExporting(true)
    try {
      const data = await habeasData.exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mis-datos-misanpedro-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Listo', 'Tu archivo de datos personales está descargado.')
    } catch (err) {
      toast.error(
        'No se pudo exportar',
        err instanceof ApiError ? err.message : 'Sin conexión',
      )
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await habeasData.deleteMyAccount()
      toast.success('Cuenta eliminada', 'Tus datos fueron borrados.')
      await userApi.logout().catch(() => {})
      userActions.signOut()
      demoStoreActions.resetAll()
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(
        'No se pudo eliminar',
        err instanceof ApiError ? err.message : 'Sin conexión',
      )
    } finally {
      setDeleting(false)
    }
  }

  async function handleLogout() {
    try {
      await userApi.logout()
    } catch {
      /* noop */
    }
    userActions.signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={16} /> Volver
      </Link>

      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <ShieldCheck size={12} /> Mi cuenta
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          {user.nombre}
        </h1>
        <p className="text-sm text-neutral-500">Datos personales y privacidad.</p>
      </header>

      <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-neutral-100">
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Datos personales
          </p>
          <div className="mt-3 flex flex-col gap-2.5 text-sm">
            <Row icon={IdCard} label="DNI" value={user.dni} />
            <Row icon={Mail} label="Email" value={user.email} />
            <Row icon={Phone} label="WhatsApp" value={user.whatsapp} />
            <Row icon={Cake} label="Nacimiento" value={user.fechaNacimiento} />
          </div>
          <p className="mt-3 text-[11px] text-neutral-400">
            ¿Necesitás corregir algo? Escribinos a{' '}
            <a href="mailto:soporte@misanpedro.app" className="font-bold text-accent-700">
              soporte@misanpedro.app
            </a>
            .
          </p>
        </section>

      <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-neutral-100">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          <Lock size={11} /> Privacidad y datos (Ley 25.326)
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Tenés derecho a acceder, rectificar, suprimir y oponerte al uso de tus datos.
        </p>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-100 px-4 py-3 text-sm font-bold text-neutral-800 transition-colors hover:bg-primary-200 disabled:opacity-60"
        >
          <Download size={14} /> {exporting ? 'Generando…' : 'Exportar mis datos (JSON)'}
        </button>

        {confirmDelete ? (
          <div className="mt-3 rounded-2xl border border-status-error/20 bg-status-error-bg/50 p-3">
            <div className="flex items-start gap-2 text-xs text-status-error-fg">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                Vamos a borrar tu cuenta y anonimizar tus canjes (los comercios mantienen el
                ahorro registrado pero sin tus datos personales). Esto no se puede deshacer.
              </p>
            </div>
            <div className="mt-3 flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-neutral-700 ring-1 ring-neutral-200 hover:bg-primary-100 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-status-error-fg px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Borrando…' : 'Sí, borrar todo'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-status-error-bg px-4 py-3 text-sm font-bold text-status-error-fg transition-colors hover:bg-red-100"
          >
            <Trash2 size={14} /> Eliminar mi cuenta
          </button>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-neutral-100">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Más
        </p>
        <div className="mt-3 flex flex-col gap-1">
          <Link
            to="/legal/terminos"
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-primary-100"
          >
            <FileText size={14} className="text-neutral-400" /> Términos y Condiciones
          </Link>
          <Link
            to="/legal/privacidad"
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-primary-100"
          >
            <ShieldCheck size={14} className="text-neutral-400" /> Política de Privacidad
          </Link>
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
              'Hola Mi San Pedro, necesito ayuda con mi cuenta.',
            )}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-primary-100"
          >
            <Phone size={14} className="text-neutral-400" /> Soporte por WhatsApp
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-neutral-700 hover:bg-primary-100"
          >
            <LogOut size={14} className="text-neutral-400" /> Cerrar sesión
          </button>
        </div>
      </section>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-100 text-neutral-500">
        <Icon size={14} />
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 text-sm">
        <span className="text-neutral-500">{label}</span>
        <span className="text-right font-semibold text-neutral-900">{value || '—'}</span>
      </div>
    </div>
  )
}
