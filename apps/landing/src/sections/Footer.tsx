import { MapPin, Mail, ArrowRight } from 'lucide-react'
import { APP_URL, SIGNUP_URL, SUPPORT_EMAIL } from '@/lib/cn'

const COLS = [
  {
    title: 'Producto',
    links: [
      { label: 'Funciones', href: '#funciones' },
      { label: 'Cómo funciona', href: '#como-funciona' },
      { label: 'Casos de uso', href: '#casos-de-uso' },
      { label: 'Precios', href: '#precios' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Para vecinos',
    links: [
      { label: 'Descargar la app', href: APP_URL, external: true },
      { label: 'Comercios adheridos', href: `${APP_URL}/#/descuentos`, external: true },
      { label: 'Cómo canjear', href: `${APP_URL}/#/mis-cupones`, external: true },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Contacto', href: `mailto:${SUPPORT_EMAIL}` },
      { label: 'Términos y condiciones', href: `${APP_URL}/#/legal/terminos`, external: true },
      { label: 'Privacidad', href: `${APP_URL}/#/legal/privacidad`, external: true },
    ],
  },
] as const

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="relative overflow-hidden border-t border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-6 pt-20 pb-10">
      {/* Subtle accent orb */}
      <div className="pointer-events-none absolute -top-32 right-0 h-[400px] w-[600px] rounded-full bg-accent-50/60 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        {/* Top: CTA banner inside footer */}
        <div className="grid gap-10 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm sm:grid-cols-[1.3fr_1fr] sm:p-10 sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent-700">
              Última oportunidad
            </p>
            <h3 className="mt-2 text-balance text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
              Sumá tu comercio antes de que se cierren los 20 lugares
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Precio fundador $25.000/mes congelado de por vida.
            </p>
          </div>
          <div className="flex sm:justify-end">
            <a
              href={SIGNUP_URL}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent-500/40"
            >
              Empezar
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2 font-bold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm">
                <span className="text-sm font-black">m</span>
              </span>
              <span className="text-lg text-neutral-900">misanpedro</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-600">
              El programa de descuentos y CRM hecho para los comercios de San Pedro,
              Buenos Aires.
            </p>

            <ul className="mt-6 space-y-2.5 text-xs text-neutral-500">
              <li className="flex items-center gap-2">
                <MapPin size={12} className="text-accent-600" />
                San Pedro, Provincia de Buenos Aires
              </li>
              <li className="flex items-center gap-2">
                <Mail size={12} className="text-accent-600" />
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="hover:text-neutral-900"
                >
                  {SUPPORT_EMAIL}
                </a>
              </li>
            </ul>

            <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-700">
              🇦🇷 Hecho en San Pedro
            </p>
          </div>

          {/* Nav columns */}
          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="text-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-900">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5 text-neutral-600">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      {...('external' in l && l.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="transition-colors hover:text-neutral-900"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-start gap-3 border-t border-neutral-200 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} misanpedro · Todos los derechos reservados</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={`${APP_URL}/#/legal/terminos`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-700"
            >
              Términos
            </a>
            <span className="text-neutral-300">·</span>
            <a
              href={`${APP_URL}/#/legal/privacidad`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-700"
            >
              Privacidad
            </a>
            <span className="text-neutral-300">·</span>
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-700"
            >
              app.misanpedro.app ↗
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
