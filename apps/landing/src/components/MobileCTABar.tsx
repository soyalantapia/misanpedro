import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { signupUrl } from '@/lib/cn'
import { useTenant, priceLabel, cupos } from '@/lib/tenant'

/**
 * Barra fija inferior con el CTA — SÓLO en mobile.
 *
 * Auditoría PM 25/07: en 12.180px de página había 7 botones "Empezá gratis" y
 * ninguno a mano cuando el comerciante se convencía en la pantalla 6; el del nav
 * además estaba oculto abajo de `sm`. El comerciante lee esto parado, con una mano.
 *
 * Aparece pasados ~600px de scroll (no tapa el hero, que ya tiene su propio CTA) y
 * respeta el safe-area de iOS.
 */
export function MobileCTABar() {
  const { config } = useTenant()
  const { total } = cupos(config)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 pt-3 backdrop-blur transition-transform duration-300 sm:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      aria-hidden={!visible}
    >
      <a
        href={signupUrl(config)}
        tabIndex={visible ? 0 : -1}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-accent-600 to-accent-800 px-6 py-3.5 text-sm font-bold text-on-brand shadow-lg shadow-accent-500/25 transition-transform duration-150 active:scale-[0.97]"
      >
        Empezá gratis
        <ArrowRight size={16} />
      </a>
      <p className="mt-1.5 text-center text-[11px] leading-tight text-neutral-500">
        Gratis, sin tarjeta · {priceLabel(config)}/mes recién cuando seamos {total} comercios
      </p>
    </div>
  )
}
