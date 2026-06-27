import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, LifeBuoy } from 'lucide-react'
import { merchantAuth } from '@/lib/merchantStore'

/**
 * Aterrizaje del MODO SOPORTE. El owner abre esta ruta con un código de un solo
 * uso (#/admin/soporte?code=…). Lo canjeamos por una sesión que actúa como el
 * propietario del comercio y entramos al panel.
 */
export function SupportLoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const code = useMemo(() => (params.get('code') || '').trim(), [params])
  const [error, setError] = useState<string | null>(null)
  const tried = useRef(false)

  useEffect(() => {
    if (tried.current) return
    tried.current = true
    if (!code) {
      setError('Falta el código de soporte en el enlace.')
      return
    }
    ;(async () => {
      const res = await merchantAuth.supportExchange(code)
      if (!res.ok) {
        setError(res.error)
        return
      }
      navigate('/admin', { replace: true })
    })()
  }, [code, navigate])

  return (
    <div className="grid min-h-[100svh] place-items-center bg-surface-2 px-4 text-ink">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        {!error ? (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
              <LifeBuoy size={22} />
            </span>
            <Loader2 size={20} className="animate-spin text-brand-strong" />
            <p className="text-base font-bold">Entrando en modo soporte…</p>
            <p className="text-sm text-ink-soft">Validando tu acceso al panel del comercio.</p>
          </>
        ) : (
          <>
            <p className="text-base font-bold">No pudimos entrar en modo soporte</p>
            <p className="text-sm text-ink-soft">{error}</p>
            <Link to="/admin/login" className="text-sm font-bold text-brand-strong hover:text-brand">
              Ir al login del comercio
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
