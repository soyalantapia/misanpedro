import { useEffect, useState } from 'react'
import { Download, X, Sparkles, Share, Plus } from 'lucide-react'
import { useTenant } from '@/lib/tenant'

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

/**
 * El panel del comercio cuelga de #/admin (HashRouter). El prompt de instalar la
 * app del VECINO no debe aparecer en pantallas del comercio (mensaje cruzado B2B).
 */
function isAdminRoute(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hash.startsWith('#/admin')
}

export function InstallPrompt() {
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi Ciudad'
  const [event, setEvent] = useState<BeforeInstallEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  // Mode 'native' = beforeinstallprompt disponible · 'ios' = mostrar A2HS manual
  const [mode, setMode] = useState<'native' | 'ios' | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (wasDismissedRecently()) return
    if (isStandalone()) return
    // Solo superficie del vecino: nunca en el panel del comercio (#/admin).
    if (isAdminRoute()) return

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
    <>
      {/* Pill discreto: no tapa el catálogo. Invita sin interrumpir; al tocarlo
          abre un modal que explica para qué sirve instalar la app. */}
      <div
        className="animate-fade-up fixed bottom-24 left-3 z-40 md:bottom-6"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-floating ring-1 ring-line">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-brand to-brand-strong px-3 py-1.5 text-xs font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
          >
            <Download size={13} /> Instalar app
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Ocultar"
            className="grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-modal-title"
          className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="animate-fade-up w-full max-w-sm rounded-3xl bg-surface p-5 shadow-floating ring-1 ring-line"
            onClick={(e) => e.stopPropagation()}
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta">
                <Sparkles size={20} />
              </div>
              <div className="flex-1">
                <p id="install-modal-title" className="text-base font-extrabold text-ink">
                  Instalá {appName}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Tenela en tu pantalla de inicio: abre al toque (sin buscar el link) y es la app
                  de descuentos de tu ciudad, siempre a mano.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar"
                className="grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>

            <ul className="mt-4 space-y-2 text-xs text-ink-soft">
              <li className="flex items-center gap-2">
                <span className="font-bold text-brand-strong">✓</span> Acceso directo desde el celu
              </li>
              <li className="flex items-center gap-2">
                <span className="font-bold text-brand-strong">✓</span> Tus cupones y tu ahorro a mano
              </li>
              <li className="flex items-center gap-2">
                <span className="font-bold text-brand-strong">✓</span> Sin ocupar lugar como una app de la tienda
              </li>
            </ul>

            {mode === 'native' ? (
              <button
                type="button"
                onClick={handleInstall}
                className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-brand to-brand-strong px-4 py-2.5 text-sm font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
              >
                <Download size={15} /> Instalar ahora
              </button>
            ) : (
              <div className="mt-4 rounded-2xl bg-surface-2 p-3">
                <p className="text-xs font-semibold text-ink">Desde Safari en tu iPhone:</p>
                <ol className="mt-2 space-y-1.5 text-[11px] text-ink-soft">
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
              </div>
            )}

            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="mt-3 w-full text-center text-xs font-semibold text-ink-soft hover:text-ink"
            >
              Ahora no
            </button>
          </div>
        </div>
      )}
    </>
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
