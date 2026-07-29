/**
 * Servicio Mercado Pago — suscripciones (preapproval).
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/reference/subscriptions/_preapproval/post
 *
 * Flow:
 *   1) Comercio firma → POST /api/v1/billing/preapproval → creamos preapproval en MP → devolvemos init_point
 *   2) Comercio paga en MP → MP redirige a back_url
 *   3) MP envía webhook a /api/v1/billing/webhook → actualizamos subscription.status
 */

import { env } from '@/env'

const MP_BASE = 'https://api.mercadopago.com'

type PreapprovalReq = {
  reason: string
  externalReference: string
  payerEmail: string
  /** Monto mensual en la `currency` del tenant (no necesariamente ARS). */
  amount: number
  /** Código ISO-4217 de la moneda del tenant (ARS, COP, …). */
  currency: string
  backUrl: string
}

type PreapprovalRes = {
  id: string
  init_point: string
  status: string
}

export async function createPreapproval(input: PreapprovalReq): Promise<PreapprovalRes | null> {
  if (!env.MP_ACCESS_TOKEN) {
    console.warn('[mp] MP_ACCESS_TOKEN no configurado — usando modo mock')
    // Modo mock para desarrollo sin credenciales. El init_point se deriva del
    // origin del backUrl (ya tenant-aware) para mantener al comercio en su ciudad.
    let frontOrigin: string
    try {
      frontOrigin = new URL(input.backUrl).origin
    } catch {
      frontOrigin = env.APP_URL_FRONT.replace(/\/+$/, '')
    }
    return {
      id: `mock_${Date.now()}`,
      init_point: `${frontOrigin}/#/admin/billing/mock-pay?ref=${encodeURIComponent(input.externalReference)}`,
      status: 'pending',
    }
  }
  // NOTA multi-país: MercadoPago opera cada país con cuentas/credenciales
  // separadas. Para cobrar en COP (Colombia) hace falta el access_token de la
  // cuenta MP-Colombia del operador de esa ciudad (no alcanza con cambiar
  // currency_id sobre una cuenta argentina). Acá ya enviamos la moneda correcta
  // del tenant; el token por-país se resuelve al conectar cada ciudad (Fase 2).
  const body = {
    reason: input.reason,
    external_reference: input.externalReference,
    payer_email: input.payerEmail,
    back_url: input.backUrl,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: input.amount,
      currency_id: input.currency,
    },
    status: 'pending',
  }
  const res = await fetch(`${MP_BASE}/preapproval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    console.error('[mp] preapproval error:', res.status, txt)
    return null
  }
  const data = (await res.json()) as PreapprovalRes
  return { id: data.id, init_point: data.init_point, status: data.status }
}

export async function getPreapproval(id: string): Promise<any | null> {
  if (!env.MP_ACCESS_TOKEN) return null
  const res = await fetch(`${MP_BASE}/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
  })
  if (!res.ok) return null
  return res.json()
}

/**
 * Cancela la suscripción EN MERCADO PAGO. Sin esto, marcarla cancelada en nuestra
 * base no frena nada: MP le sigue debitando al comercio todos los meses y el
 * próximo webhook la revive a 'authorized'. [cazabug loop2]
 *
 * Devuelve `true` sólo si MP confirmó la cancelación — el llamador NO debe decirle
 * al comercio que canceló si esto dio false.
 *
 * En modo mock (sin MP_ACCESS_TOKEN) devolvemos true: no hay nada que cancelar
 * allá porque tampoco hubo cobro real. Mismo criterio que createPreapproval.
 */
export async function cancelPreapproval(id: string): Promise<boolean> {
  if (!env.MP_ACCESS_TOKEN) {
    console.warn('[mp] MP_ACCESS_TOKEN no configurado — cancelación simulada')
    return true
  }
  try {
    const res = await fetch(`${MP_BASE}/preapproval/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (!res.ok) {
      console.error('[mp] cancelPreapproval falló', id, res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[mp] cancelPreapproval error de red', id, err)
    return false
  }
}
