import { useEffect } from 'react'
import { api, tokens } from '@/lib/api'
import { demoStoreActions, getUserSnapshot, userActions } from '@/lib/stores'
import type { Activation, User } from '@/lib/types'

/**
 * Componente invisible que se monta en el shell y sincroniza el estado local
 * con el API:
 *   - Si hay refresh token de vecino, intenta /me y guarda el user.
 *     Si 401 (token inválido), limpia los tokens.
 *   - Una vez con sesión vecino, baja activations.mine() y hace upsert al
 *     store local (así MisCuponesPage / CanjeadosPage / CuponActivoPage
 *     muestran las activaciones reales sin migrar).
 *
 * No hace nada si no hay token o si el backend está caído (queda silencioso).
 */
export function ApiSync() {
  useEffect(() => {
    let cancelled = false
    const userToken = tokens.get('user')
    if (!userToken.access && !userToken.refresh) return

    ;(async () => {
      try {
        const me = await api.userApi.me()
        if (cancelled) return
        // Si el usuario local no existe (por ejemplo después de borrar cache),
        // lo creamos a partir del API.
        const localUser = getUserSnapshot()
        if (!localUser || localUser.id !== me.user.id) {
          const apiUser: User = {
            id: me.user.id,
            nombre: me.user.nombre,
            dni: me.user.dni,
            email: me.user.email,
            whatsapp: me.user.whatsapp,
            fechaNacimiento: me.user.fechaNacimiento,
            acceptedTcAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }
          // Reemplaza el user actual sin tocar demoUsers/activations
          userActions.replace(apiUser)
        }
      } catch (err: any) {
        if (err?.status === 401) {
          tokens.clear('user')
        }
        // si es error de red, lo ignoramos — la app sigue funcionando offline
        return
      }

      // 2) traer activaciones del usuario y mergearlas al store local
      try {
        const data = await api.activations.mine()
        if (cancelled) return
        const userId = getUserSnapshot()?.id
        if (!userId) return
        for (const a of data.activations) {
          const local: Activation = {
            id: a.id,
            couponId: a.couponId,
            userId,
            codigoNumerico: a.codigoNumerico,
            qrPayload: a.qrPayload,
            activatedAt: a.activatedAt,
            expiresAt: a.expiresAt,
            status: a.status,
            redeemedAt: a.redeemedAt,
            ahorroEstimado: a.ahorroEstimado,
            montoTicket: a.montoTicket,
          }
          demoStoreActions.upsertActivation(local)
        }
      } catch {
        /* noop */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
