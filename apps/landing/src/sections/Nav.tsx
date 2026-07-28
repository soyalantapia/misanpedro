import { useEffect, useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { signupUrl } from '@/lib/cn'
import { Logo } from '@/components/Logo'
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
  const [activeId, setActiveId] = useState<string | null>(null)

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

  // Scroll-spy: marca en qué sección está el lector. UN observer para las 5
  // secciones, con una banda estrecha en el medio del viewport (rootMargin
  // -45%/-50%) para que nunca titile entre dos secciones adyacentes.
  useEffect(() => {
    const targets = NAV_LINKS.map((l) => document.getElementById(l.href.slice(1))).filter(
      (el): el is HTMLElement => !!el,
    )
    if (!targets.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting)
        if (visible?.target.id) setActiveId(visible.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    )
    targets.forEach((t) => observer.observe(t))
    return () => observer.disconnect()
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
          href="#top"
          aria-label={`${appName(config)} · inicio`}
          className="flex shrink-0 items-center gap-2 font-bold tracking-tight"
        >
          <Logo markSize={28} textClass="text-base" />
        </a>

        <nav aria-label="Principal" className="hidden gap-6 text-sm font-medium text-neutral-600 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              aria-current={activeId === l.href.slice(1) ? 'true' : undefined}
              className={`relative py-1 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-accent-600 after:transition-transform after:duration-200 hover:text-neutral-900 ${
                activeId === l.href.slice(1)
                  ? 'text-neutral-900 after:scale-x-100'
                  : 'after:scale-x-0'
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={signupUrl(config)}
            className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-600 to-accent-800 px-3.5 py-2.5 text-sm font-bold text-on-brand shadow-sm shadow-accent-500/20 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:shadow-accent-500/30 active:scale-[0.97] sm:px-4"
          >
            Empezá gratis
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
              href={signupUrl(config)}
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-600 to-accent-800 px-4 py-2.5 text-sm font-bold text-on-brand active:scale-[0.97]"
            >
              Empezá gratis
              <ArrowRight size={12} />
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
