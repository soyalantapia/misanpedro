import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { enterUrl, COMERCIOS_URL } from '@/lib/cn'
import { Logo } from '@/components/Logo'
import { useTenant } from '@/lib/tenant'

const LINKS = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#ahorro', label: 'Cuánto ahorrás' },
  { href: '#comercios', label: 'Comercios' },
] as const

export function Nav() {
  const { config } = useTenant()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 12)
        ticking = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={[
        'sticky top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-neutral-200/70 bg-white/95 shadow-sm' : 'bg-transparent',
      ].join(' ')}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
        <a href="#top" className="flex items-center">
          <Logo markSize={34} textClass="text-base" />
        </a>

        <nav className="hidden gap-7 text-sm font-medium text-neutral-500 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-neutral-900">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 sm:gap-4">
          <a
            href={COMERCIOS_URL}
            className="hidden whitespace-nowrap text-xs font-semibold text-neutral-500 transition-colors hover:text-accent-700 sm:inline-block sm:text-sm"
          >
            Soy un comercio
          </a>
          <a
            href={enterUrl(config)}
            className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-4 py-2 text-xs font-bold text-on-brand shadow-lg shadow-accent-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent-500/40 sm:px-5 sm:text-sm"
          >
            Ir a la app
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </header>
  )
}
