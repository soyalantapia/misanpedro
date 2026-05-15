import { APP_URL, SUPPORT_EMAIL, WHATSAPP_URL } from '@/lib/cn'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50/50 px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-3">
          {/* Col 1 — Brand */}
          <div>
            <div className="flex items-center gap-2 font-bold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-white">
                <span className="text-xs font-black">m</span>
              </span>
              misanpedro
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-600">
              Programa de descuentos y CRM para comercios de San Pedro, Buenos Aires.
            </p>
            <p className="mt-4 text-xs text-neutral-500">Hecho en San Pedro 🇦🇷</p>
          </div>

          {/* Col 2 — Producto */}
          <nav aria-label="Producto" className="text-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              Producto
            </p>
            <ul className="mt-4 space-y-2.5 text-neutral-700">
              <li>
                <a href="#funciones" className="hover:text-neutral-900">
                  Funciones
                </a>
              </li>
              <li>
                <a href="#precios" className="hover:text-neutral-900">
                  Precios
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-neutral-900">
                  FAQ
                </a>
              </li>
              <li>
                <a href={APP_URL} className="hover:text-neutral-900">
                  Para vecinos ↗
                </a>
              </li>
            </ul>
          </nav>

          {/* Col 3 — Soporte + Legal */}
          <nav aria-label="Soporte" className="text-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              Soporte
            </p>
            <ul className="mt-4 space-y-2.5 text-neutral-700">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-neutral-900"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-neutral-900">
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <a href={`${APP_URL}/#/legal/terminos`} className="hover:text-neutral-900">
                  Términos
                </a>
              </li>
              <li>
                <a
                  href={`${APP_URL}/#/legal/privacidad`}
                  className="hover:text-neutral-900"
                >
                  Privacidad
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start gap-2 border-t border-neutral-200 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} misanpedro · Todos los derechos reservados</p>
          <p>
            <a href={APP_URL} className="hover:text-neutral-700">
              app.misanpedro.app
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
