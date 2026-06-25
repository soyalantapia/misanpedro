import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, tokens } from '@/lib/api'
import { getUserSnapshot, userActions } from '@/lib/stores'
import { merchantAuth } from '@/lib/merchantStore'
import type { User } from '@/lib/types'
import { syncMyActivations } from '@/lib/syncActivations'

/**
 * Componente invisible que se monta en el shell y sincroniza el estado local
 * con el API:
 *   - Vecino: si hay refresh token, /me y baja /activations/me. Espeja al
 *     store local (MisCuponesPage / CanjeadosPage / CuponActivoPage usan
 *     el store, no el API directamente).
 *   - Comercio: si hay refresh token, /me. Si 401, hace logout para limpiar
 *     la session zombie del localStorage.
 *
 * Además, se re-ejecuta cuando el tab recupera el foco (visibilitychange),
 * para que activaciones canjeadas en otro dispositivo/sesión se reflejen
 * sin que el usuario tenga que recargar.
 *
 * No hace nada si no hay token o si el backend está caído (queda silencioso).
 */
export function ApiSync() {
  const navigate = useNavigate()

  // Manejo GLOBAL de expiración de sesión del comercio. El cliente HTTP dispara
  // `msp:session-expired` cuando el refresh falla. Antes el listener vivía sólo en
  // MerchantShell, así que NO cubría rutas fuera del shell — en particular
  // /admin/canje/:id (confirmar canje), la acción más crítica del comercio, donde
  // la expiración dejaba al cajero en una página muerta. Acá (ApiSync, siempre
  // montado) cubre TODAS las rutas. El guard `handled` evita el loop de re-entrada
  // (logout() → tokens.clear() → re-dispatch de session-expired).
  useEffect(() => {
    let handled = false
    const onMerchantExpired = (e: Event) => {
      const detail = (e as CustomEvent<{ subject?: string }>).detail
      if (detail?.subject !== 'merchant' || handled) return
      handled = true
      void merchantAuth.logout()
      navigate('/admin/login?reason=expired', { replace: true })
    }
    window.addEventListener('msp:session-expired', onMerchantExpired)
    return () => window.removeEventListener('msp:session-expired', onMerchantExpired)
  }, [navigate])

  useEffect(() => {
    async function sync() {
      let cancelled = false

      // ─── Vecino ──────────────────────────────────────────────────────
      const userToken = tokens.get('user')
      if (userToken.access || userToken.refresh) {
        ;(async () => {
          try {
            const me = await api.userApi.me()
            if (cancelled) return
            const localUser = getUserSnapshot()
            if (!localUser || localUser.id !== me.user.id) {
              const apiUser: User = {
                id: me.user.id,
                nombre: me.user.nombre,
                telefono: me.user.telefono,
              }
              userActions.replace(apiUser)
            }
          } catch (err: any) {
            // Token largo: un 401 es raro (token inválido). Lo tratamos como
            // "volver a pedir el claim": limpiamos la sesión local y el próximo
            // canje re-clama por teléfono (recupera la cuenta + el ahorro).
            if (err?.status === 401) {
              tokens.clear('user')
              userActions.signOut()
            }
            return
          }

          if (!cancelled) await syncMyActivations()
        })()
      }

      // ─── Comercio ────────────────────────────────────────────────────
      const merchantToken = tokens.get('merchant')
      if (merchantToken.access || merchantToken.refresh) {
        ;(async () => {
          try {
            // Si /me funciona, los tokens son válidos — no hacemos nada (la
            // sesión ya está hidratada desde localStorage por merchantStore).
            await api.merchantApi.me()
          } catch (err: any) {
            if (err?.status === 401) {
              // Tokens inválidos/expirados → logout limpio para no dejar
              // session zombie en localStorage que rompa MerchantShell.
              await merchantAuth.logout()
            }
          }
        })()
      }

      return () => { cancelled = true }
    }

    // Sync inicial al montar
    void sync()

    // Re-sync cuando el tab vuelve al foco (el usuario venía de otra tab/app).
    // Permite detectar activaciones canjeadas en otro dispositivo sin recargar.
    function onVisibilityChange() {
      if (!document.hidden) void sync()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
