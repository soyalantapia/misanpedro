import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { enterUrl } from '@/lib/cn'
import { useTenant } from '@/lib/tenant'

export function StickyCTA() {
  const { config } = useTenant()
  const [show, setShow] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setShow(window.scrollY > 620)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={[
        'fixed inset-x-0 bottom-0 z-50 p-3 transition-all duration-300 sm:hidden',
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
      ].join(' ')}
    >
      <a
        href={enterUrl(config)}
        className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 px-6 py-4 text-sm font-bold text-on-brand shadow-2xl shadow-accent-500/40"
      >
        Entrá gratis y ahorrá
        <ArrowRight size={16} />
      </a>
    </div>
  )
}
