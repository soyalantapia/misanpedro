import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, tokens } from '@/lib/api'
import { getUserSnapshot, userActions } from '@/lib/stores'
import { merchantAuth } from '@/lib/merchantStore'
import type { User } from '@/lib/types'
import { syncMyActivations } from '@/lib/syncActivations'
import { useToast } from '@/components/Toast'

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
  const toast = useToast()

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

  // La otra mitad del mismo evento: la del VECINO. Nunca se había implementado
  // (el comentario de api.ts prometía las dos), así que cuando le revocaban la
  // sesión se le borraban los tokens pero el store seguía con su `user` cargado.
  // La app le seguía diciendo "hola, María" y al tocar Canjear tomaba el camino
  // de demo. Ahora el store y los tokens se caen JUNTOS, y se lo avisamos con
  // palabras, no con un código que el cajero no va a poder validar.
  // [cazabug loop2 · P0]
  useEffect(() => {
    let handled = false
    const onUserExpired = (e: Event) => {
      const detail = (e as CustomEvent<{ subject?: string }>).detail
      if (detail?.subject !== 'user' || handled) return
      handled = true
      userActions.signOut()
      toast.info('Cerramos tu sesión', 'Volvé a entrar con tu email para seguir usando tus cupones.')
    }
    window.addEventListener('msp:session-expired', onUserExpired)
    return () => window.removeEventListener('msp:session-expired', onUserExpired)
  }, [toast])

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
            // Bug #22: re-espejar también cuando cambió el NOMBRE/teléfono con el
            // mismo id (re-claim con otro nombre desde otro celu, o corrección por
            // soporte). Antes solo se hacía replace si cambiaba el id → el perfil
            // mostraba el nombre viejo indefinidamente en el dispositivo secundario.
            if (
              !localUser ||
              localUser.id !== me.user.id ||
              localUser.nombre !== me.user.nombre ||
              localUser.telefono !== me.user.telefono ||
              localUser.email !== me.user.email
            ) {
              const apiUser: User = {
                id: me.user.id,
                nombre: me.user.nombre,
                email: me.user.email,
                telefono: me.user.telefono,
              }
              userActions.replace(apiUser)
            }
          } catch (err: any) {
            // Un 401 acá significa que la sesión murió (refresh revocado, por
            // ejemplo desde "cerrar sesión en todos lados"). Limpiamos lo local:
            // el próximo canje lo manda al alta, y como su email YA existe le
            // van a pedir el código para recuperar la cuenta con todo su ahorro.
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
