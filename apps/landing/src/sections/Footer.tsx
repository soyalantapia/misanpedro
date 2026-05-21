import { APP_URL, SUPPORT_EMAIL } from '@/lib/cn'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-neutral-200 bg-white px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Brand minimal */}
        <div className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-white">
            <span className="text-xs font-black">m</span>
          </span>
          <span className="text-sm text-neutral-900">misanpedro</span>
          <span className="ml-2 text-xs text-neutral-400">
            © {year} · Hecho en San Pedro
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
            href={`${APP_URL}/#/legal/terminos`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-neutral-900"
          >
            Términos
          </a>
          <a
            href={`${APP_URL}/#/legal/privacidad`}
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
