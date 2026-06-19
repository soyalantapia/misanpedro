import { useEffect, useState } from 'react'
import { MapPin, ArrowRight, AlertCircle } from 'lucide-react'
import { isHexColor, listAvailableTenants, setTenantSlug, type TenantConfig } from '@/lib/tenant'

/** Debe coincidir con STORAGE_KEY de @/lib/tenant. Lo re-leemos para verificar
 *  que el slug efectivamente persistió antes de recargar (modo privado / storage
 *  bloqueado no persiste y dispararía un loop de reload infinito). */
const STORAGE_KEY = 'misanpedro.tenant.slug'
/** Flag de sesión para no auto-skipear más de una vez (defensa anti-loop). */
const AUTOSKIP_FLAG = 'misanpedro.tenant.autoskipped'

/** Lee el slug persistido sin romper si el storage está bloqueado. */
function readPersistedSlug(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

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
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const list = await listAvailableTenants()
        // M2: auto-skip si hay un solo tenant activo (caso lanzamiento de una ciudad
        // sola — San Pedro al inicio). Evita fricción de "elegir" la única opción.
        //
        // Anti-loop: en modo privado / storage bloqueado el slug no persiste y
        // window.location.reload() dispararía un bucle infinito. Sólo recargamos
        // si (a) no auto-skipeamos ya en esta sesión y (b) el slug quedó realmente
        // escrito en localStorage. Si no persistió, mostramos el selector con un
        // aviso en lugar de recargar.
        let alreadySkipped = false
        try {
          alreadySkipped = window.sessionStorage.getItem(AUTOSKIP_FLAG) === '1'
        } catch {
          /* sessionStorage bloqueado: tratamos como no-skipeado pero igual
             validaremos la persistencia abajo antes de recargar. */
        }

        if (list.length === 1 && !alreadySkipped) {
          const onlySlug = list[0].slug
          try {
            window.sessionStorage.setItem(AUTOSKIP_FLAG, '1')
          } catch {
            /* noop */
          }
          try {
            setTenantSlug(onlySlug)
          } catch {
            /* setTenantSlug escribe en localStorage; si falla lo manejamos
               abajo con el chequeo de persistencia. */
          }
          // Re-leemos para confirmar que el slug quedó persistido.
          if (readPersistedSlug() === onlySlug) {
            window.location.reload()
            return
          }
          // No persistió (storage bloqueado): mostramos el selector con aviso.
          setNotice(
            'No pudimos guardar tu ciudad automáticamente. Tocá tu ciudad para continuar.',
          )
        }
        setTenants(list)
      } catch (err: any) {
        setError(err?.message ?? 'No pudimos conectar con el servidor')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function handleSelect(slug: string) {
    try {
      setTenantSlug(slug)
    } catch {
      /* storage bloqueado */
    }
    // Sólo recargamos si el slug persistió; si no, avisamos en vez de loopear.
    if (readPersistedSlug() === slug) {
      // Hacemos un reload para que TODOS los stores re-hidraten con el tenant nuevo.
      setTimeout(() => window.location.reload(), 50)
    } else {
      setNotice(
        'No pudimos guardar tu ciudad. Revisá que tu navegador permita almacenamiento (puede estar en modo privado) e intentá de nuevo.',
      )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-50 via-white to-accent-100">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-br from-accent-300/30 to-accent-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 py-12">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-accent-700 shadow-sm ring-1 ring-accent-100">
            <MapPin size={12} />
            Mi San Pedro
          </div>
          <h1 className="mt-5 text-balance text-3xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
            Elegí tu ciudad
          </h1>
          <p className="mt-3 text-pretty text-base text-neutral-600">
            Sumate a la red de cupones de los comercios de tu barrio.
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-4 flex w-full items-start gap-2 rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg">
            <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        {notice && (
          <div role="alert" className="mb-4 flex w-full items-start gap-2 rounded-xl bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-700 ring-1 ring-accent-100">
            <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {notice}
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
                Mi San Pedro llega a tu ciudad.
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
                      background: `linear-gradient(135deg, ${isHexColor(t.brand?.primaryColor) ? t.brand?.primaryColor : 'var(--color-brand)'}, ${isHexColor(t.brand?.accentColor) ? t.brand?.accentColor : 'var(--color-brand-strong)'})`,
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
          ¿Tu ciudad no está? Probablemente todavía no llegamos. Escribinos a{' '}
          <a href="mailto:hola@misanpedro.com" className="font-semibold text-accent-700 underline-offset-2 hover:underline">
            hola@misanpedro.com
          </a>
          .
        </p>
      </div>
    </div>
  )
}
