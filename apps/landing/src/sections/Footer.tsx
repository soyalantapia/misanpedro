import { legalUrl, SUPPORT_EMAIL } from '@/lib/cn'
import { Logo } from '@/components/Logo'
import { useTenant, cityName } from '@/lib/tenant'

export function Footer() {
  const { config } = useTenant()
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-neutral-200 bg-white px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Brand minimal */}
        <div className="flex items-center gap-2 tracking-tight">
          <Logo markSize={24} textClass="text-sm" />
          <span className="ml-2 text-xs text-neutral-500">
            © {year} · Hecho en {cityName(config)}
          </span>
        </div>

        {/* Links esenciales */}
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500"
        >
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="transition-colors hover:text-neutral-900"
          >
            Contacto
          </a>
          <a
            href={legalUrl(config, 'terminos')}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-neutral-900"
          >
            Términos
          </a>
          <a
            href={legalUrl(config, 'privacidad')}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-neutral-900"
          >
            Privacidad
          </a>
        </nav>
      </div>
    </footer>
  )
}
