import { useEffect, useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { SIGNUP_URL } from '@/lib/cn'
import { useTenant, appName } from '@/lib/tenant'

const NAV_LINKS = [
  { href: '#funciones', label: 'Funciones' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#casos-de-uso', label: 'Casos de uso' },
  { href: '#precios', label: 'Precios' },
  { href: '#faq', label: 'FAQ' },
] as const

export function Nav() {
  const { config } = useTenant()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Scroll listener throttled con rAF para evitar re-renders excesivos
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 8)
        ticking = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Cerrar mobile menu con Escape
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <header
      className={[
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-neutral-200/60 bg-white/90 backdrop-blur-md'
          : 'bg-transparent',
      ].join(' ')}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a
          href="/"
          aria-label={`${appName(config)} · inicio`}
          className="flex shrink-0 items-center gap-2 font-bold tracking-tight"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm">
            <span className="text-xs font-black">M</span>
          </span>
          <span className="text-base text-neutral-900">{appName(config)}</span>
        </a>

        <nav aria-label="Principal" className="hidden gap-6 text-sm font-medium text-neutral-600 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-neutral-900"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={SIGNUP_URL}
            className="group hidden items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-accent-500/20 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-accent-500/30 sm:inline-flex"
          >
            Empezar
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200 lg:hidden"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          className="border-t border-neutral-200 bg-white px-6 py-4 lg:hidden"
        >
          <nav aria-label="Principal mobile" className="flex flex-col gap-3 text-sm font-medium text-neutral-700">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}>
                {l.label}
              </a>
            ))}
            <a
              href={SIGNUP_URL}
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-4 py-2 text-xs font-bold text-white"
            >
              Empezar
              <ArrowRight size={12} />
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
