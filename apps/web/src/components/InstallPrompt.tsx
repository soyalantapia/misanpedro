import { useEffect, useState } from 'react'
import { Download, X, Sparkles, Share, Plus } from 'lucide-react'

type BeforeInstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'misanpedro.install.dismissed.v1'
const DISMISS_DAYS = 14
// No interrumpimos la primera vista: el prompt recién aparece tras un rato en
// la página o cuando el usuario ya se enganchó (hizo scroll por el catálogo).
const ENGAGEMENT_DELAY_MS = 12000
const ENGAGEMENT_SCROLL_PX = 600

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

    // El prompt NUNCA debe tapar el catálogo en el primer render. En ambos modos
    // esperamos a que el usuario se enganche: que pase un rato en la página o
    // que haga scroll por la vitrina antes de ofrecer la instalación.
    let shown = false
    const cleanups: Array<() => void> = []

    function showWhenEngaged(nextMode: 'native' | 'ios') {
      function reveal() {
        if (shown) return
        shown = true
        setMode(nextMode)
        setVisible(true)
        // Una vez visible, desarmamos los disparadores de engagement.
        cleanups.forEach((fn) => fn())
        cleanups.length = 0
      }

      const timer = window.setTimeout(reveal, ENGAGEMENT_DELAY_MS)
      cleanups.push(() => window.clearTimeout(timer))

      function onScroll() {
        if (window.scrollY >= ENGAGEMENT_SCROLL_PX) reveal()
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      cleanups.push(() => window.removeEventListener('scroll', onScroll))
    }

    // iOS Safari: no existe beforeinstallprompt, así que mostramos las
    // instrucciones manuales recién cuando el usuario se enganchó.
    if (isIosSafari()) {
      showWhenEngaged('ios')
      return () => {
        cleanups.forEach((fn) => fn())
        cleanups.length = 0
      }
    }

    // Native: capturamos el evento apenas se dispara (el browser lo emite una
    // sola vez), pero diferimos mostrar el prompt hasta que haya engagement.
    function handler(e: Event) {
      e.preventDefault()
      setEvent(e as BeforeInstallEvent)
      showWhenEngaged('native')
    }
    window.addEventListener('beforeinstallprompt', handler)
    cleanups.push(() => window.removeEventListener('beforeinstallprompt', handler))

    return () => {
      cleanups.forEach((fn) => fn())
      cleanups.length = 0
    }
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
      className="animate-fade-up fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-sm items-start gap-3 rounded-3xl bg-surface p-4 shadow-floating ring-1 ring-line md:bottom-6 md:left-auto md:right-6 md:mx-0"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta">
        <Sparkles size={18} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p id="install-prompt-title" className="text-sm font-bold text-ink">
          Instalá Mi San Pedro
        </p>
        {mode === 'native' ? (
          <>
            <p className="text-xs text-ink-soft">
              Agregala a tu pantalla de inicio para acceso rápido.
            </p>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-brand to-brand-strong px-3 py-1.5 text-xs font-bold text-on-brand shadow-cta hover:-translate-y-0.5 transition-all"
              >
                <Download size={12} /> Instalar
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="text-xs font-semibold text-ink-soft hover:text-ink"
              >
                Más tarde
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-soft">
              Para sumarla a tu pantalla de inicio:
            </p>
            <ol className="mt-1 space-y-1 text-[11px] text-ink-soft">
              <li className="flex items-center gap-1.5">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-soft text-[9px] font-bold text-brand-strong">
                  1
                </span>
                Tocá <Share size={11} className="inline text-brand-strong" /> Compartir
              </li>
              <li className="flex items-center gap-1.5">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-soft text-[9px] font-bold text-brand-strong">
                  2
                </span>
                Elegí <Plus size={11} className="inline text-brand-strong" /> "Agregar a inicio"
              </li>
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="mt-1 self-start text-[11px] font-semibold text-ink-soft hover:text-ink"
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
        className="grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink"
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
