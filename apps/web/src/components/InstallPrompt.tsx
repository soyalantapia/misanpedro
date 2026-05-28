import { useEffect, useState } from 'react'
import { Download, X, Sparkles, Share, Plus } from 'lucide-react'

type BeforeInstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'misanpedro.install.dismissed.v1'
const DISMISS_DAYS = 14

/**
 * Detecta si el browser es iOS Safari (donde NO existe beforeinstallprompt
 * y hay que mostrar instrucciones manuales de "Add to Home Screen").
 */
function isIosSafari(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua)
  // Chrome / Firefox en iOS también son WebKit pero con identificadores propios
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  return isIos && isSafari
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // navigator.standalone existe sólo en iOS Safari (no estándar)
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  return window.matchMedia('(display-mode: standalone)').matches
}

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallEvent | null>(null)
  const [visible, setVisible] = useState(false)
  // Mode 'native' = beforeinstallprompt disponible · 'ios' = mostrar A2HS manual
  const [mode, setMode] = useState<'native' | 'ios' | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (wasDismissedRecently()) return
    if (isStandalone()) return

    // iOS Safari: mostramos instrucciones manuales después de 3s en la página
    // (no en el primer milisegundo — esperamos que el user explore).
    if (isIosSafari()) {
      const t = window.setTimeout(() => {
        setMode('ios')
        setVisible(true)
      }, 3000)
      return () => window.clearTimeout(t)
    }

    function handler(e: Event) {
      e.preventDefault()
      setEvent(e as BeforeInstallEvent)
      setMode('native')
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible || !mode) return null

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
      role="dialog"
      aria-labelledby="install-prompt-title"
      className="animate-fade-up fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-sm items-start gap-3 rounded-3xl bg-white p-4 shadow-floating ring-1 ring-neutral-100 md:bottom-6 md:left-auto md:right-6 md:mx-0"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
        <Sparkles size={18} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p id="install-prompt-title" className="text-sm font-bold text-neutral-900">
          Instalá Cuponcito
        </p>
        {mode === 'native' ? (
          <>
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
          </>
        ) : (
          <>
            <p className="text-xs text-neutral-500">
              Para sumarla a tu pantalla de inicio:
            </p>
            <ol className="mt-1 space-y-1 text-[11px] text-neutral-600">
              <li className="flex items-center gap-1.5">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent-100 text-[9px] font-bold text-accent-700">
                  1
                </span>
                Tocá <Share size={11} className="inline text-accent-700" /> Compartir
              </li>
              <li className="flex items-center gap-1.5">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent-100 text-[9px] font-bold text-accent-700">
                  2
                </span>
                Elegí <Plus size={11} className="inline text-accent-700" /> "Agregar a inicio"
              </li>
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="mt-1 self-start text-[11px] font-semibold text-neutral-500 hover:text-neutral-900"
            >
              Entendido
            </button>
          </>
        )}
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
