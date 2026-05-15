import { useEffect, useState } from 'react'
import { SIGNUP_URL } from '@/lib/cn'

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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm">
            <span className="text-xs font-black">m</span>
          </span>
          <span className="text-base text-neutral-900">misanpedro</span>
        </a>

        <nav className="hidden gap-7 text-sm font-medium text-neutral-600 sm:flex">
          <a href="#funciones" className="transition-colors hover:text-neutral-900">
            Funciones
          </a>
          <a href="#precios" className="transition-colors hover:text-neutral-900">
            Precios
          </a>
          <a href="#faq" className="transition-colors hover:text-neutral-900">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={SIGNUP_URL}
            className="hidden sm:inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-neutral-800"
          >
            Empezar gratis
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Abrir menú"
            className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 sm:hidden"
          >
            <span className="text-base">{mobileOpen ? '×' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-neutral-200 bg-white px-6 py-4 sm:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-neutral-700">
            <a href="#funciones" onClick={() => setMobileOpen(false)}>
              Funciones
            </a>
            <a href="#precios" onClick={() => setMobileOpen(false)}>
              Precios
            </a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>
              FAQ
            </a>
            <a
              href={SIGNUP_URL}
              className="mt-2 inline-flex w-fit items-center rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white"
            >
              Empezar gratis
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
