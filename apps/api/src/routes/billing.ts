import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { env } from '@/env'
import { App, Merchant, MerchantUser, Subscription } from '@/models'
import { requireMerchantAuth } from '@/middleware/auth'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { createPreapproval, getPreapproval } from '@/services/mp.service'
import { sendSubscriptionReceipt } from '@/services/email.service'
import { verifyMpSignature, mapMpStatus } from '@/services/mp-signature'

export const billingRoutes = new Hono()

const PLAN_AMOUNT_ARS = Number(env.PLAN_AMOUNT_ARS ?? 50_000)

/**
 * B1: precio FINAL al comercio. Primera etapa = monotributo personal del
 * responsable → factura C, sin IVA discriminado. El amount enviado a MP y
 * el del receipt es el mismo valor sin recargos. Cuando migremos a SaaS
 * inscripto (S.A.S./S.A.), discriminamos IVA y la factura pasa a A.
 */
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
      amount: sub.amountARS, // monto final, sin recargo de IVA
      periodFrom: periodFrom.toLocaleDateString('es-AR'),
      periodTo: periodTo.toLocaleDateString('es-AR'),
      externalReference: sub.externalReference,
    })
  } catch (err) {
    console.error('[receipt-email]', err)
  }
}

// ════════════════════════════════════════════════════════════════════
// WEBHOOK — MercadoPago llama desde sus servidores. NO debe pasar por
// tenantContext porque MP no manda X-Tenant-Slug. Lo resolvemos por
// el externalReference / subscription.appId.
//
// La firma se valida con `verifyMpSignature` (services/mp-signature.ts).
// Helper extraído para poder testearlo unitariamente.
// ════════════════════════════════════════════════════════════════════

billingRoutes.post('/webhook', async (c) => {
  const body = await c.req.json().catch(() => ({}))

  const type = body.type ?? body.topic
  const dataId = body.data?.id ?? body.id ?? c.req.query('data.id')
  const externalReference = body.external_reference ?? c.req.query('external_reference')

  // O4: log ÚNICAMENTE los campos no-PII. El body completo de MP incluye
  // email del pagador, payer_id, last4 de tarjeta, etc. Para debug profundo
  // usar Sentry breadcrumbs (con scrubbing PII automático) en vez de
  // CloudWatch/Railway logs.
  console.log('[mp-webhook]', {
    type,
    dataId,
    externalReference,
    action: body.action,
    apiVersion: body.api_version,
  })

  if (dataId) {
    const ok = verifyMpSignature({
      signatureHeader: c.req.header('x-signature'),
      requestId: c.req.header('x-request-id'),
      dataId: String(dataId),
      secret: env.MP_WEBHOOK_SECRET,
      isProduction: env.NODE_ENV === 'production',
    })
    if (!ok) {
      console.warn('[mp-webhook] firma inválida; rechazo')
      return c.json({ ok: false, error: 'invalid signature' }, 401)
    }
  }

  if ((type === 'preapproval' || type === 'subscription_preapproval') && dataId) {
    const detail = await getPreapproval(String(dataId))
    if (detail) {
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
        const wasActivated =
          sub.status === 'authorized' &&
          (await Merchant.exists({ _id: sub.merchantId, estado: 'pending_payment' }))
        if (sub.status === 'authorized') {
          await Merchant.updateOne(
            { _id: sub.merchantId, estado: 'pending_payment' },
            { estado: 'activo' },
          )
        }
        await sub.save()
        if (wasActivated) void sendReceiptForSubscription(sub)
      }
    }
  }

  return c.json({ ok: true })
})

billingRoutes.get('/return', async (c) => {
  return c.json({ ok: true })
})

// ════════════════════════════════════════════════════════════════════
// El resto requieren tenant context.
// ════════════════════════════════════════════════════════════════════

billingRoutes.use('*', tenantContext)

const preapprovalCreateSchema = z.object({
  plan: z.enum(['standard']).default('standard'),
})

billingRoutes.post('/preapproval', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = preapprovalCreateSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)

  const merchant = await Merchant.findOne({ _id: auth.merchantId, appId })
  if (!merchant) return c.json({ ok: false, error: 'merchant not found' }, 404)
  const user = await MerchantUser.findOne({ _id: auth.sub, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)

  // El tenant slug en el externalReference ayuda al webhook a debug.
  const tenant = c.get('tenant')
  const externalReference = `cup-${tenant.slug}-${merchant._id.toString()}-${randomBytes(6).toString('hex')}`
  const sub = await Subscription.create({
    appId,
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

billingRoutes.get('/me', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const sub = await Subscription.findOne({ appId, merchantId: auth.merchantId }).sort({
    createdAt: -1,
  })
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

billingRoutes.post('/cancel', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const sub = await Subscription.findOne({ appId, merchantId: auth.merchantId }).sort({
    createdAt: -1,
  })
  if (!sub) return c.json({ ok: false, error: 'no hay suscripción activa' }, 404)

  const merchant = await Merchant.findOne({ _id: auth.merchantId, appId })
  if (!merchant) return c.json({ ok: false, error: 'merchant not found' }, 404)

  const ahora = new Date()
  // O5: comercios creados ANTES de que existiera este campo no tienen
  // arrepentimientoExpiraEn → se tratan como "fuera del período" (epoch 0,
  // siempre vencido). Comercios nuevos lo tienen seteado en signup
  // (merchant-auth.ts:70) a now + 10 días, por lo que el flow funciona
  // correctamente para todos los casos válidos post-feature.
  const expiraArrepentimientoEn = merchant.arrepentimientoExpiraEn ?? new Date(0)
  const dentroDe10Dias = ahora.getTime() <= expiraArrepentimientoEn.getTime()

  sub.status = 'cancelled'
  sub.rawLast = { cancelledAt: ahora.toISOString(), arrepentimiento: dentroDe10Dias }
  await sub.save()

  if (dentroDe10Dias) {
    merchant.arrepentido = true
    merchant.estado = 'cancelado'
    await merchant.save()
    return c.json({
      ok: true,
      arrepentimiento: true,
      mensaje:
        'Tu suscripción fue cancelada y vamos a procesar el reembolso completo en los próximos 10 días hábiles.',
    })
  }

  return c.json({
    ok: true,
    arrepentimiento: false,
    mensaje: `Tu suscripción se cancela el ${sub.nextBillingAt?.toLocaleDateString('es-AR') ?? 'fin del período actual'}. Hasta entonces seguís usando todas las funciones.`,
  })
})

billingRoutes.post('/mock-confirm', requireMerchantAuth, async (c) => {
  // Mock-confirm SOLO está habilitado cuando NO hay MP_ACCESS_TOKEN configurado
  // (= modo mock, sin cobro real). Cuando configures MercadoPago real, el flujo
  // de activación pasa por el redirect del initPoint + webhook — bloqueamos esta
  // ruta para no dejar un bypass que active comercios sin pagar.
  if (env.MP_ACCESS_TOKEN) return c.json({ ok: false, error: 'forbidden' }, 403)
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const { externalReference } = await c.req.json().catch(() => ({}))
  if (!externalReference) return c.json({ ok: false, error: 'externalReference requerido' }, 400)
  const sub = await Subscription.findOne({ appId, externalReference })
  if (!sub) return c.json({ ok: false, error: 'no encontrado' }, 404)
  if (sub.merchantId.toString() !== auth.merchantId) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }
  sub.status = 'authorized'
  sub.nextBillingAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await sub.save()
  await Merchant.updateOne({ _id: sub.merchantId, appId }, { estado: 'activo' })
  void sendReceiptForSubscription(sub)
  return c.json({ ok: true })
})

// Referenciado para evitar tree-shake (no se usa directamente pero importa).
void App
