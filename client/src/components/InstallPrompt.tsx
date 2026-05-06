import { useEffect, useState } from 'react'
import { Download, X, Sparkles } from 'lucide-react'

type BeforeInstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'misanpedro.install.dismissed.v1'
const DISMISS_DAYS = 14

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (wasDismissedRecently()) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    function handler(e: Event) {
      e.preventDefault()
      setEvent(e as BeforeInstallEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible || !event) return null

  async function handleInstall() {
    if (!event) return
    try {
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === 'accepted') {
        setVisible(false)
      } else {
        dismiss()
      }
    } catch {
      dismiss()
    }
  }

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
    }
    setVisible(false)
  }

  return (
    <div
      className="animate-fade-up fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-sm items-start gap-3 rounded-3xl bg-white p-4 shadow-floating ring-1 ring-neutral-100 md:bottom-6 md:left-auto md:right-6 md:mx-0"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
        <Sparkles size={18} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-bold text-neutral-900">Instalá Mi San Pedro</p>
        <p className="text-xs text-neutral-500">
          Agregala a tu pantalla de inicio para acceso rápido.
        </p>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-3 py-1.5 text-xs font-bold text-white shadow-cta hover:-translate-y-0.5 transition-all"
          >
            <Download size={12} /> Instalar
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-900"
          >
            Más tarde
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 hover:bg-primary-100 hover:text-neutral-700"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false
  const dismissed = window.localStorage.getItem(STORAGE_KEY)
  if (!dismissed) return false
  const ms = parseInt(dismissed, 10)
  if (Number.isNaN(ms)) return false
  const days = (Date.now() - ms) / (1000 * 60 * 60 * 24)
  return days < DISMISS_DAYS
}
