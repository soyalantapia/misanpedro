import { useStore, activationActions } from './stores'
import { getMerchant } from '@/data/mockData'
import { getCouponSync as getCoupon } from './couponsStore'
import type { Activation, User } from './types'

export type ValidationOk = {
  ok: true
  activation: Activation
  couponTitulo: string
  porcentaje: number
  customerName: string
  isFirstVisit: boolean
}

export type ValidationError = {
  ok: false
  reason: 'not-found' | 'wrong-merchant' | 'expired' | 'already-redeemed' | 'cancelled'
  message: string
  merchantNombre?: string
  redeemedAt?: string
}

export type ValidationResult = ValidationOk | ValidationError

function buildResult(
  merchantId: string,
  activation: Activation,
  customerName: string,
  redemptionsByMerchant: Activation[],
): ValidationResult {
  const coupon = getCoupon(activation.couponId)
  if (!coupon) {
    return { ok: false, reason: 'not-found', message: 'Cupón no encontrado en el sistema.' }
  }

  if (coupon.merchantId !== merchantId) {
    const otra = getMerchant(coupon.merchantId)
    return {
      ok: false,
      reason: 'wrong-merchant',
      message: `Este cupón es de ${otra?.nombre ?? 'otro comercio'}, no es válido en tu local.`,
      merchantNombre: otra?.nombre,
    }
  }

  if (activation.status === 'canjeado') {
    return {
      ok: false,
      reason: 'already-redeemed',
      message: 'Este cupón ya fue usado.',
      redeemedAt: activation.redeemedAt,
    }
  }

  if (activation.status === 'cancelado') {
    return {
      ok: false,
      reason: 'cancelled',
      message: 'El vecino canceló este cupón antes del canje.',
    }
  }

  // Los códigos ya no expiran por tiempo. Sólo chequeamos status legacy
  // de activaciones viejas marcadas como expiradas en la DB.
  if (activation.status === 'expirado') {
    return {
      ok: false,
      reason: 'expired',
      message: 'Esta activación está marcada como expirada en la base. Pedile al cliente que reactive el cupón desde la app.',
    }
  }

  const userVisitsBefore = redemptionsByMerchant.filter(
    (a) => a.id !== activation.id,
  ).length
  return {
    ok: true,
    activation,
    couponTitulo: coupon.titulo,
    porcentaje: coupon.porcentaje,
    customerName,
    isFirstVisit: userVisitsBefore === 0,
  }
}

export function useValidateByCode(code: string, merchantId: string): ValidationResult | null {
  const { activations, user, demoUsers } = useStore()
  const trimmed = code.replace(/\s+/g, '')
  if (trimmed.length < 6) return null
  // Prioriza una activación activa sobre históricas canjeadas/expiradas
  const activation =
    activations.find(
      (a) => a.codigoNumerico === trimmed && a.status === 'activo',
    ) ?? activations.find((a) => a.codigoNumerico === trimmed)
  if (!activation) {
    return { ok: false, reason: 'not-found', message: 'Código no reconocido. Revisá los dígitos.' }
  }
  const allUsers: User[] = [user, ...demoUsers].filter(Boolean) as User[]
  const owner = allUsers.find((u) => u.id === activation.userId)
  const customerName = owner?.nombre ?? 'Vecino registrado'
  const redemptionsByMerchant = activations.filter((a) => {
    const c = getCoupon(a.couponId)
    return c?.merchantId === merchantId && a.status === 'canjeado' && a.userId === activation.userId
  })
  return buildResult(merchantId, activation, customerName, redemptionsByMerchant)
}

export function useValidateByPayload(
  payload: string,
  merchantId: string,
): ValidationResult | null {
  if (!payload) return null
  let parsed: { codigo?: string } | null = null
  try {
    parsed = JSON.parse(payload)
  } catch {
    return { ok: false, reason: 'not-found', message: 'QR ilegible. Probá ingresar el código manual.' }
  }
  if (!parsed?.codigo) {
    return { ok: false, reason: 'not-found', message: 'QR sin código de cupón.' }
  }
  return useValidateByCode(parsed.codigo, merchantId)
}

export function useActivationsForMerchant(merchantId: string) {
  const { activations } = useStore()
  return activations.filter((a) => {
    const c = getCoupon(a.couponId)
    return c?.merchantId === merchantId
  })
}

export function useRedemptionsForMerchant(merchantId: string) {
  return useActivationsForMerchant(merchantId).filter((a) => a.status === 'canjeado')
}

export type MerchantClient = {
  user: User
  redemptions: Activation[]
  totalAhorro: number
  firstRedeemedAt: string
  lastRedeemedAt: string
  count: number
}

export function useClientsForMerchant(merchantId: string): MerchantClient[] {
  const { activations, user, demoUsers } = useStore()
  const allUsers: User[] = [user, ...demoUsers].filter(Boolean) as User[]
  const redemptions = activations.filter((a) => {
    const c = getCoupon(a.couponId)
    return c?.merchantId === merchantId && a.status === 'canjeado' && a.redeemedAt
  })
  const byUser = new Map<string, Activation[]>()
  redemptions.forEach((a) => {
    const list = byUser.get(a.userId) ?? []
    list.push(a)
    byUser.set(a.userId, list)
  })
  const clients: MerchantClient[] = []
  byUser.forEach((rs, userId) => {
    const u = allUsers.find((x) => x.id === userId)
    if (!u) return
    const sorted = [...rs].sort(
      (a, b) => new Date(a.redeemedAt!).getTime() - new Date(b.redeemedAt!).getTime(),
    )
    clients.push({
      user: u,
      redemptions: sorted,
      totalAhorro: rs.reduce((s, r) => s + (r.ahorroEstimado ?? 0), 0),
      firstRedeemedAt: sorted[0].redeemedAt!,
      lastRedeemedAt: sorted[sorted.length - 1].redeemedAt!,
      count: rs.length,
    })
  })
  // Más recientes primero
  return clients.sort(
    (a, b) =>
      new Date(b.lastRedeemedAt).getTime() - new Date(a.lastRedeemedAt).getTime(),
  )
}

export function useClientForMerchant(
  merchantId: string,
  userId: string | undefined,
): MerchantClient | undefined {
  return useClientsForMerchant(merchantId).find((c) => c.user.id === userId)
}

export function confirmRedemption(
  activationId: string,
  porcentaje: number,
  montoTicket?: number,
) {
  const ahorro =
    montoTicket && porcentaje
      ? Math.round((montoTicket * porcentaje) / 100)
      : porcentaje
        ? Math.round((4000 * porcentaje) / 100)
        : undefined
  activationActions.markRedeemed(activationId, ahorro)
}
