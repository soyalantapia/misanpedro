import { Hono } from 'hono'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { env } from '@/env'
import { Merchant, MerchantUser, Subscription } from '@/models'
import { requireMerchantAuth } from '@/middleware/auth'
import { createPreapproval, getPreapproval } from '@/services/mp.service'
import { sendSubscriptionReceipt } from '@/services/email.service'

export const billingRoutes = new Hono()

// Plan mensual del comercio. Configurable via env (PLAN_AMOUNT_ARS).
// Default: $25.000 (coincide con AdminSignupPage). IVA 21% se suma sobre este.
const PLAN_AMOUNT_ARS = Number(env.PLAN_AMOUNT_ARS ?? 25_000)
const IVA_RATE = 0.21

async function sendReceiptForSubscription(sub: any) {
  try {
    const merchant = await Merchant.findById(sub.merchantId)
    const user = await MerchantUser.findOne({ merchantId: sub.merchantId, rol: 'admin' })
    if (!merchant || !user?.email) return
    const periodFrom = new Date()
    const periodTo = new Date(periodFrom.getTime() + 30 * 24 * 60 * 60 * 1000)
    await sendSubscriptionReceipt({
      to: user.email,
      comercio: merchant.nombre,
      amount: Math.round(sub.amountARS * (1 + IVA_RATE)),
      periodFrom: periodFrom.toLocaleDateString('es-AR'),
      periodTo: periodTo.toLocaleDateString('es-AR'),
      externalReference: sub.externalReference,
    })
  } catch (err) {
    console.error('[receipt-email]', err)
  }
}

const preapprovalCreateSchema = z.object({
  plan: z.enum(['standard']).default('standard'),
})

// POST /billing/preapproval — comercio inicia suscripción
billingRoutes.post('/preapproval', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = preapprovalCreateSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)

  const merchant = await Merchant.findById(auth.merchantId)
  if (!merchant) return c.json({ ok: false, error: 'merchant not found' }, 404)
  const user = await MerchantUser.findById(auth.sub)
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)

  const externalReference = `msp-${merchant._id.toString()}-${randomBytes(6).toString('hex')}`
  const sub = await Subscription.create({
    merchantId: merchant._id,
    externalReference,
    plan: parsed.data.plan,
    amountARS: PLAN_AMOUNT_ARS,
    status: 'pending',
  })

  const preapproval = await createPreapproval({
    reason: `Mi San Pedro · ${merchant.nombre}`,
    externalReference,
    payerEmail: user.email,
    amountARS: PLAN_AMOUNT_ARS,
    backUrl: `${env.APP_URL_FRONT}/#/admin/billing/return?ref=${externalReference}`,
  })

  if (!preapproval) {
    sub.status = 'rejected'
    await sub.save()
    return c.json({ ok: false, error: 'no se pudo crear suscripción' }, 502)
  }

  sub.preapprovalId = preapproval.id
  sub.initPoint = preapproval.init_point
  await sub.save()

  return c.json({
    ok: true,
    subscription: {
      id: sub._id.toString(),
      externalReference,
      preapprovalId: preapproval.id,
      initPoint: preapproval.init_point,
      status: sub.status,
    },
  })
})

// GET /billing/me — última suscripción del comercio
billingRoutes.get('/me', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const sub = await Subscription.findOne({ merchantId: auth.merchantId }).sort({ createdAt: -1 })
  return c.json({
    ok: true,
    subscription: sub
      ? {
          id: sub._id.toString(),
          status: sub.status,
          plan: sub.plan,
          amountARS: sub.amountARS,
          nextBillingAt: sub.nextBillingAt?.toISOString(),
          initPoint: sub.initPoint,
        }
      : null,
  })
})

// GET /billing/return — endpoint que MP usa como back_url; nosotros sólo logueamos
billingRoutes.get('/return', async (c) => {
  // El frontend lee el query y muestra estado; no actualizamos nada acá (lo hace el webhook)
  return c.json({ ok: true })
})

/**
 * Valida la firma del webhook según la doc de Mercado Pago:
 * https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#editor_8
 *
 * Header `x-signature` con formato: `ts=<timestamp>,v1=<hmac>`
 * Header `x-request-id` único por request
 *
 * El template del manifest es: `id:<dataId>;request-id:<requestId>;ts:<ts>;`
 * (con el `dataId` del query string, en lowercase)
 */
function verifyMpSignature(
  signatureHeader: string | undefined,
  requestId: string | undefined,
  dataId: string,
): boolean {
  if (!env.MP_WEBHOOK_SECRET) return true // dev: sin secret aceptamos todo
  if (!signatureHeader || !requestId) return false

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=').map((s) => s.trim())
      return [k, v ?? '']
    }),
  )
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  // Replay protection: rechazar firmas con > 5 min de antigüedad
  const tsMs = parseInt(ts, 10)
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    return false
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const expected = createHmac('sha256', env.MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex')

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
  } catch {
    return false
  }
}

// POST /billing/webhook — Mercado Pago manda notificaciones acá
billingRoutes.post('/webhook', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  // Estructura típica MP: { type, data: { id }, action, ... }
  console.log('[mp-webhook]', JSON.stringify(body))

  const type = body.type ?? body.topic
  const dataId = body.data?.id ?? body.id ?? c.req.query('data.id')
  const externalReference = body.external_reference ?? c.req.query('external_reference')

  // Validación de firma (sólo si MP_WEBHOOK_SECRET está configurado)
  if (dataId) {
    const ok = verifyMpSignature(
      c.req.header('x-signature'),
      c.req.header('x-request-id'),
      String(dataId),
    )
    if (!ok) {
      console.warn('[mp-webhook] firma inválida; rechazo')
      return c.json({ ok: false, error: 'invalid signature' }, 401)
    }
  }

  if ((type === 'preapproval' || type === 'subscription_preapproval') && dataId) {
    const detail = await getPreapproval(String(dataId))
    if (detail) {
      // Buscar primero por preapprovalId; si no existe (notif antes de que
      // hayamos persistido el id MP), fallback a externalReference.
      let sub = await Subscription.findOne({ preapprovalId: String(dataId) })
      if (!sub && (externalReference || detail.external_reference)) {
        sub = await Subscription.findOne({
          externalReference: String(externalReference ?? detail.external_reference),
        })
        if (sub && !sub.preapprovalId) sub.preapprovalId = String(dataId)
      }
      if (sub) {
        sub.status = mapMpStatus(detail.status)
        sub.rawLast = detail
        if (detail.next_payment_date) sub.nextBillingAt = new Date(detail.next_payment_date)
        const wasActivated = sub.status === 'authorized' && (await Merchant.exists({ _id: sub.merchantId, estado: 'pending_payment' }))
        if (sub.status === 'authorized') {
          // Activar el comercio cuando se confirma el pago
          await Merchant.updateOne(
            { _id: sub.merchantId, estado: 'pending_payment' },
            { estado: 'activo' },
          )
        }
        await sub.save()
        // Enviar recibo si recién se activó (no spamear cada renovación)
        if (wasActivated) void sendReceiptForSubscription(sub)
      }
    }
  }

  return c.json({ ok: true })
})

function mapMpStatus(s: string): 'pending' | 'authorized' | 'paused' | 'cancelled' | 'rejected' {
  switch (s) {
    case 'authorized':
      return 'authorized'
    case 'paused':
      return 'paused'
    case 'cancelled':
      return 'cancelled'
    case 'rejected':
      return 'rejected'
    default:
      return 'pending'
  }
}

// POST /billing/cancel — comercio cancela su suscripción.
// Defensa al consumidor (Argentina, Ley 24.240): dentro de los 10 días desde
// el alta el comercio puede arrepentirse y solicitar reembolso completo.
// Después de 10 días, cancela la próxima renovación pero el período actual
// permanece activo hasta su vencimiento.
billingRoutes.post('/cancel', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const sub = await Subscription.findOne({ merchantId: auth.merchantId }).sort({ createdAt: -1 })
  if (!sub) return c.json({ ok: false, error: 'no hay suscripción activa' }, 404)

  const merchant = await Merchant.findById(auth.merchantId)
  if (!merchant) return c.json({ ok: false, error: 'merchant not found' }, 404)

  const ahora = new Date()
  const expiraArrepentimientoEn = merchant.arrepentimientoExpiraEn ?? new Date(0)
  const dentroDe10Dias = ahora.getTime() <= expiraArrepentimientoEn.getTime()

  sub.status = 'cancelled'
  sub.rawLast = { cancelledAt: ahora.toISOString(), arrepentimiento: dentroDe10Dias }
  await sub.save()

  if (dentroDe10Dias) {
    // Arrepentimiento: el comercio queda cancelado y se le procesa reembolso
    merchant.arrepentido = true
    merchant.estado = 'cancelado'
    await merchant.save()
    // TODO: dispara reembolso real en MP (POST /preapproval/{id}/refund) cuando hay credenciales
    return c.json({
      ok: true,
      arrepentimiento: true,
      mensaje:
        'Tu suscripción fue cancelada y vamos a procesar el reembolso completo en los próximos 10 días hábiles.',
    })
  }

  // Cancelación normal: el comercio sigue activo hasta el fin del período
  return c.json({
    ok: true,
    arrepentimiento: false,
    mensaje: `Tu suscripción se cancela el ${sub.nextBillingAt?.toLocaleDateString('es-AR') ?? 'fin del período actual'}. Hasta entonces seguís usando todas las funciones.`,
  })
})

// POST /billing/mock-confirm — sólo en development; requiere auth merchant
billingRoutes.post('/mock-confirm', requireMerchantAuth, async (c) => {
  if (env.NODE_ENV === 'production') return c.json({ ok: false, error: 'forbidden' }, 403)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const { externalReference } = await c.req.json().catch(() => ({}))
  if (!externalReference) return c.json({ ok: false, error: 'externalReference requerido' }, 400)
  const sub = await Subscription.findOne({ externalReference })
  if (!sub) return c.json({ ok: false, error: 'no encontrado' }, 404)
  // Solo permitimos confirmar suscripciones del propio comercio
  if (sub.merchantId.toString() !== auth.merchantId) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }
  sub.status = 'authorized'
  sub.nextBillingAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await sub.save()
  await Merchant.updateOne({ _id: sub.merchantId }, { estado: 'activo' })
  // Recibo (en dev también — útil para testing)
  void sendReceiptForSubscription(sub)
  return c.json({ ok: true })
})
