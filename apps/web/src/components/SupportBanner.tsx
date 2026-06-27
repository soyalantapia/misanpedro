import { useNavigate } from 'react-router-dom'
import { LifeBuoy } from 'lucide-react'
import { merchantAuth, useMerchantSession } from '@/lib/merchantStore'

/**
 * Banner del MODO SOPORTE: barra sólida y bien visible que avisa que estás dentro
 * del panel como soporte (impersonando al propietario), para no confundirte de
 * cuenta. "Salir" cierra la sesión de soporte (revoca el token) y cierra la pestaña.
 *
 * Se renderiza en el MerchantShell Y en la página de confirmar canje
 * (/admin/canje/:id, que vive FUERA del shell) para que el aviso esté SIEMPRE
 * presente mientras dura la sesión de soporte — incluso al confirmar un canje.
 */
export function SupportBanner() {
  const sessionState = useMerchantSession()
  const navigate = useNavigate()
  if (!sessionState.support) return null
  const nombre = sessionState.apiMerchant?.nombre ?? 'este comercio'
  function salir() {
    merchantAuth.logout()
    window.close()
    navigate('/admin/login', { replace: true })
  }
  return (
    <div
      role="alert"
      className="sticky top-0 z-30 flex items-center justify-center gap-3 bg-violet-600 px-4 py-2 text-xs font-semibold text-white"
    >
      <span className="inline-flex items-center gap-1.5">
        <LifeBuoy size={14} aria-hidden="true" />
        Modo soporte · estás dentro de <strong className="font-bold">{nombre}</strong> como el propietario
      </span>
      <button
        type="button"
        onClick={salir}
        className="rounded-full bg-white/20 px-3 py-0.5 font-bold text-white transition-colors hover:bg-white/30"
      >
        Salir
      </button>
    </div>
  )
}
