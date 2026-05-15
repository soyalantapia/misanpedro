import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { SIGNUP_URL } from '@/lib/cn'

const NAV_LINKS = [
  { href: '#funciones', label: 'Funciones' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#casos-de-uso', label: 'Casos de uso' },
  { href: '#precios', label: 'Precios' },
  { href: '#faq', label: 'FAQ' },
] as const

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
        <a href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm">
            <span className="text-xs font-black">m</span>
          </span>
          <span className="text-base text-neutral-900">misanpedro</span>
        </a>

        <nav className="hidden gap-6 text-sm font-medium text-neutral-600 lg:flex">
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
            aria-label="Abrir menú"
            className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 lg:hidden"
          >
            <span className="text-base">{mobileOpen ? '×' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-neutral-200 bg-white px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-neutral-700">
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
