import { useEffect, useState } from 'react'
import { MapPin, ArrowRight, AlertCircle } from 'lucide-react'
import { listAvailableTenants, setTenantSlug, type TenantConfig } from '@/lib/tenant'

/**
 * Página que se muestra cuando la PWA no pudo determinar el tenant:
 * sin subdomain, sin localStorage, sin query string. Le pide al usuario
 * elegir su ciudad.
 *
 * Cuando elige, persiste en localStorage y recarga la página para
 * arrancar con el tenant resuelto.
 */
export function TenantSelectorPage() {
  const [tenants, setTenants] = useState<TenantConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const list = await listAvailableTenants()
        setTenants(list)
      } catch (err: any) {
        setError(err?.message ?? 'No pudimos conectar con el servidor')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function handleSelect(slug: string) {
    setTenantSlug(slug)
    // Hacemos un reload para que TODOS los stores re-hidraten con el tenant nuevo.
    setTimeout(() => window.location.reload(), 50)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-50 via-white to-accent-100">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-br from-accent-300/30 to-accent-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 py-12">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-accent-700 shadow-sm ring-1 ring-accent-100">
            <MapPin size={12} />
            Cuponcito
          </div>
          <h1 className="mt-5 text-balance text-3xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
            Elegí tu ciudad
          </h1>
          <p className="mt-3 text-pretty text-base text-neutral-600">
            Sumate a la red de descuentos de los comercios de tu barrio.
          </p>
        </header>

        {error && (
          <div className="mb-4 flex w-full items-start gap-2 rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid w-full gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : !error && tenants.length === 0 ? (
          <div className="grid w-full place-items-center rounded-2xl bg-white p-10 ring-1 ring-neutral-100">
            <div className="text-center">
              <h3 className="font-bold text-neutral-900">Todavía no hay ciudades</h3>
              <p className="mt-1 max-w-sm text-sm text-neutral-500">
                Estamos sumando comercios. Volvé pronto o seguinos para enterarte cuándo
                Cuponcito llega a tu ciudad.
              </p>
            </div>
          </div>
        ) : (
          <ul className="grid w-full gap-3 sm:grid-cols-2">
            {tenants.map((t) => (
              <li key={t.slug}>
                <button
                  type="button"
                  onClick={() => handleSelect(t.slug)}
                  className="group flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-neutral-100 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-accent-200"
                >
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-black text-white shadow"
                    style={{
                      background: `linear-gradient(135deg, ${t.brand?.primaryColor ?? '#695ede'}, ${t.brand?.accentColor ?? '#4239a3'})`,
                    }}
                  >
                    {t.ciudad?.[0]?.toUpperCase() ?? 'C'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-neutral-900">{t.nombre}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {t.ciudad}
                      {t.provincia ? ` · ${t.provincia}` : ''}
                    </p>
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-700"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-10 text-center text-[11px] text-neutral-400">
          Si llegaste por un link específico, refrescá la pestaña.
        </p>
      </div>
    </div>
  )
}
