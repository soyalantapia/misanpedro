import { useEffect } from 'react'
import { api, tokens } from '@/lib/api'
import { demoStoreActions, getUserSnapshot, userActions } from '@/lib/stores'
import { merchantAuth } from '@/lib/merchantStore'
import type { Activation, User } from '@/lib/types'

/**
 * Componente invisible que se monta en el shell y sincroniza el estado local
 * con el API:
 *   - Vecino: si hay refresh token, /me y baja /activations/me. Espeja al
 *     store local (MisCuponesPage / CanjeadosPage / CuponActivoPage usan
 *     el store, no el API directamente).
 *   - Comercio: si hay refresh token, /me. Si 401, hace logout para limpiar
 *     la session zombie del localStorage.
 *
 * No hace nada si no hay token o si el backend está caído (queda silencioso).
 */
export function ApiSync() {
  useEffect(() => {
    let cancelled = false

    // ─── Vecino ────────────────────────────────────────────────────────
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
              dni: me.user.dni,
              email: me.user.email,
              whatsapp: me.user.whatsapp,
              fechaNacimiento: me.user.fechaNacimiento,
              acceptedTcAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            }
            userActions.replace(apiUser)
          }
        } catch (err: any) {
          if (err?.status === 401) {
            tokens.clear('user')
          }
          return
        }

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
    }

    // ─── Comercio ──────────────────────────────────────────────────────
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

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
