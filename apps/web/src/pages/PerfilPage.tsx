import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  Phone,
  User as UserIcon,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Lock,
  FileText,
  Download,
  ArrowRight,
} from 'lucide-react'
import { habeasData, tokens, ApiError } from '@/lib/api'
import { useUser, userActions, demoStoreActions } from '@/lib/stores'
import { useToast } from '@/components/Toast'
import { SUPPORT_EMAIL, getSupportLink, useTenant } from '@/lib/tenant'
import { SavingsWallet } from '@/components/features/SavingsWallet'
import { ClubCard } from '@/components/features/ClubCard'

export function PerfilPage() {
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi Ciudad'
  const SUPPORT = getSupportLink(`Hola, necesito ayuda con mis datos en ${appName}.`)
  const user = useUser()
  // Sesión = MISMA condición que usan SavingsWallet/ClubCard (token presente),
  // no el store local `user`. Evita ver la billetera/Club logueados ENCIMA del
  // bloque anónimo cuando el token está pero el store aún no hidrató.
  const loggedIn = !!(tokens.get('user').access || tokens.get('user').refresh)
  const navigate = useNavigate()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const data = await habeasData.exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mis-datos-${tenant.config?.slug ?? 'micuidad'}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Datos descargados', 'Te bajamos un archivo con todos tus datos.')
    } catch (err) {
      toast.error('No se pudo descargar', err instanceof ApiError ? err.message : 'Sin conexión')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await habeasData.deleteMyAccount()
      toast.success('Datos eliminados', 'Tus datos fueron borrados.')
      // Limpia el token local → la app vuelve a estado anónimo (sin "Salir").
      tokens.clear('user')
      userActions.signOut()
      demoStoreActions.resetAll()
      navigate('/', { replace: true })
    } catch (err) {
      toast.error('No se pudo eliminar', err instanceof ApiError ? err.message : 'Sin conexión')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-fin-soft hover:text-fin-ink"
      >
        <ChevronLeft size={16} /> Volver
      </Link>

      {/* Lo que venís ahorrando (anónimo → muestra un CTA para canjear) */}
      <SavingsWallet />

      {/* EL CLUB — niveles del mes (no renderiza nada si sos anónimo) */}
      <ClubCard />

      {!loggedIn ? (
        /* ─── Vecino anónimo: sin gate, lo invitamos a CANJEAR (no a registrarse) ─── */
        <section className="bg-fin-mesh relative overflow-hidden rounded-3xl bg-fin-surface p-5 ring-1 ring-fin-line shadow-fin-card">
          <div className="bg-fin-grid absolute inset-0 opacity-60" />
          <div className="relative flex flex-col gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-fin-ink">Tu perfil</h1>
            <p className="text-sm text-fin-soft">
              Tu perfil se arma solo. Cuando canjeés tu primer cupón te pedimos solo{' '}
              <span className="font-bold text-fin-ink">nombre y teléfono</span>. Nada de DNI,
              contraseñas ni códigos.
            </p>
            <Link
              to="/"
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-2xl bg-fin-lime px-5 py-3 text-sm font-bold text-fin-bg shadow-fin-glow transition-all hover:-translate-y-0.5"
            >
              Canjeá tu primer cupón <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      ) : !user ? (
        /* ─── Token presente pero el store aún no hidrató: skeleton (no anónimo) ─── */
        <>
          <div className="h-16 w-full animate-pulse rounded-3xl bg-fin-surface ring-1 ring-fin-line" />
          <div className="h-40 w-full animate-pulse rounded-3xl bg-fin-surface ring-1 ring-fin-line" />
        </>
      ) : (
        <>
          <header className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-fin-ink sm:text-3xl">
              {user.nombre}
            </h1>
            <p className="text-sm text-fin-soft">Tu cuenta y privacidad.</p>
          </header>

          <section className="rounded-3xl bg-fin-surface p-5 ring-1 ring-fin-line shadow-fin-card">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">
              Tu cuenta
            </h2>
            <div className="mt-3 flex flex-col gap-2.5 text-sm">
              <Row icon={UserIcon} label="Nombre" value={user.nombre} />
              <Row icon={Phone} label="Teléfono" value={user.telefono} />
            </div>
            <p className="mt-3 text-[11px] text-fin-faint">
              Tu teléfono es tu cuenta: con el mismo número recuperás tu ahorro en cualquier celular.
              ¿Necesitás corregir algo? Escribinos a{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-fin-lime">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section className="rounded-3xl bg-fin-surface p-5 ring-1 ring-fin-line shadow-fin-card">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
              <Lock size={11} aria-hidden="true" /> Privacidad y datos (Ley 25.326)
            </h2>
            <p className="mt-2 text-xs text-fin-soft">
              Tenés derecho a acceder, rectificar, suprimir y oponerte al uso de tus datos.
            </p>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-fin-surface2 px-4 py-3 text-sm font-bold text-fin-ink ring-1 ring-fin-line transition-colors hover:bg-fin-line disabled:opacity-60"
            >
              <Download size={14} /> {exporting ? 'Preparando…' : 'Descargar mis datos'}
            </button>

            {confirmDelete ? (
              <div className="mt-3 rounded-2xl border border-fin-danger/30 bg-fin-danger/10 p-3">
                <div className="flex items-start gap-2 text-xs text-fin-danger">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <p>
                    Vamos a borrar tus datos y anonimizar tus canjes (los comercios mantienen el
                    ahorro registrado pero sin tus datos personales). Esto no se puede deshacer.
                  </p>
                </div>
                <div className="mt-3 flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="flex-1 rounded-xl bg-fin-surface2 px-3 py-2 text-xs font-bold text-fin-ink ring-1 ring-fin-line hover:bg-fin-line disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 rounded-xl bg-fin-danger px-3 py-2 text-xs font-bold text-fin-bg hover:opacity-90 disabled:opacity-60"
                  >
                    {deleting ? 'Borrando…' : 'Sí, borrar todo'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-fin-danger/12 px-4 py-3 text-sm font-bold text-fin-danger transition-colors hover:bg-fin-danger/20"
              >
                <Trash2 size={14} /> Eliminar mis datos
              </button>
            )}
          </section>
        </>
      )}

      <section className="rounded-3xl bg-fin-surface p-5 ring-1 ring-fin-line shadow-fin-card">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">Más</h2>
        <div className="mt-3 flex flex-col gap-1">
          <Link
            to="/legal/terminos"
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-fin-soft hover:bg-fin-surface2 hover:text-fin-ink"
          >
            <FileText size={14} className="text-fin-faint" /> Términos y Condiciones
          </Link>
          <Link
            to="/legal/privacidad"
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-fin-soft hover:bg-fin-surface2 hover:text-fin-ink"
          >
            <ShieldCheck size={14} className="text-fin-faint" /> Política de Privacidad
          </Link>
          <a
            href={SUPPORT.href}
            target={SUPPORT.isWhatsapp ? '_blank' : undefined}
            rel="noreferrer noopener"
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-fin-soft hover:bg-fin-surface2 hover:text-fin-ink"
          >
            <Phone size={14} className="text-fin-faint" /> {SUPPORT.label}
          </a>
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
  icon: typeof Phone
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-fin-surface2 text-fin-soft">
        <Icon size={14} />
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 text-sm">
        <span className="text-fin-soft">{label}</span>
        <span className="text-right font-semibold text-fin-ink">{value || '—'}</span>
      </div>
    </div>
  )
}
