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
  amountARS: number
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
    // Modo mock para desarrollo sin credenciales
    return {
      id: `mock_${Date.now()}`,
      init_point: `${env.APP_URL_FRONT}/#/admin/billing/mock-pay?ref=${encodeURIComponent(input.externalReference)}`,
      status: 'pending',
    }
  }
  const body = {
    reason: input.reason,
    external_reference: input.externalReference,
    payer_email: input.payerEmail,
    back_url: input.backUrl,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: input.amountARS,
      currency_id: 'ARS',
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
