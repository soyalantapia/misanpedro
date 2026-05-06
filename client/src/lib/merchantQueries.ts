import { useStore, activationActions } from './stores'
import { getMerchant } from '@/data/mockData'
import { getCouponSync as getCoupon } from './couponsStore'
import type { Activation } from './types'

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

  if (activation.status === 'expirado' || new Date(activation.expiresAt).getTime() <= Date.now()) {
    return {
      ok: false,
      reason: 'expired',
      message: 'El cupón expiró. Pedile al cliente que lo reactive desde la app.',
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
  const { activations, user } = useStore()
  const trimmed = code.replace(/\s+/g, '')
  if (trimmed.length < 6) return null
  const activation = activations.find((a) => a.codigoNumerico === trimmed)
  if (!activation) {
    return { ok: false, reason: 'not-found', message: 'Código no reconocido. Revisá los dígitos.' }
  }
  const customerName = user?.nombre ?? 'Vecino registrado'
  const redemptionsByMerchant = activations.filter((a) => {
    const c = getCoupon(a.couponId)
    return c?.merchantId === merchantId && a.status === 'canjeado'
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
