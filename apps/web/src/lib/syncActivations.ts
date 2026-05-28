import { api } from './api'
import { demoStoreActions, getUserSnapshot } from './stores'
import type { Activation } from './types'

/**
 * Baja las activaciones del vecino desde el API (/activations/me) y las espeja
 * al store local. Reutilizado por:
 *   - ApiSync (al cargar la app y al volver el foco al tab)
 *   - CanjeadosPage / MisCuponesPage (al montar) → así un canje confirmado por
 *     el comercio aparece al navegar a esas pantallas, sin necesidad de recargar
 *     (V10 audit: antes el historial solo se refrescaba al recargar la app).
 *
 * Silencioso: si no hay vecino logueado o el backend falla, no hace nada.
 */
export async function syncMyActivations(): Promise<void> {
  const userId = getUserSnapshot()?.id
  if (!userId) return
  try {
    const data = await api.activations.mine()
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
    /* noop — backend caído o sin sesión; el store local queda como está */
  }
}
