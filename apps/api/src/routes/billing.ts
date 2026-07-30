import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { env } from '@/env'
import { App, Merchant, MerchantUser, Subscription } from '@/models'
import { requireMerchantAuth } from '@/middleware/auth'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { createPreapproval, getPreapproval, cancelPreapproval } from '@/services/mp.service'
import { sendSubscriptionReceipt } from '@/services/email.service'
import { verifyMpSignature, mapMpStatus } from '@/services/mp-signature'
import { tenantFrontUrl } from '@/lib/urls'
import { precioPlanEfectivo } from '@/lib/precioPlan'
import { captureException } from '@/services/sentry.service'

export const billingRoutes = new Hono()

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
    const tenant = await App.findById(sub.appId).lean()
    const moneda: string = sub.currency ?? tenant?.moneda ?? 'ARS'
    const locale: string = tenant?.locale ?? 'es-AR'
    const appNombre: string = tenant?.nombre ?? 'Mi Ciudad'
    const periodFrom = new Date()
    const periodTo = new Date(periodFrom.getTime() + 30 * 24 * 60 * 60 * 1000)
    await sendSubscriptionReceipt({
      to: user.email,
      comercio: merchant.nombre,
      amount: sub.amountARS, // monto final, sin recargo de IVA
      periodFrom: periodFrom.toLocaleDateString(locale),
      periodTo: periodTo.toLocaleDateString(locale),
      externalReference: sub.externalReference,
      appNombre,
      moneda,
      locale,
      pais: tenant?.pais,
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
    // Mercado Pago reintenta SÓLO si no le respondemos 2xx. Antes devolvíamos
    // `{ok:true}` también acá, o sea que le confirmábamos la entrega de algo que
    // no procesamos: MP no volvía nunca y el comercio que YA PAGÓ quedaba en
    // 'pending_payment' para siempre, pagando una cuenta que nunca se activó. Y
    // desde nuestro lado se veía un webhook exitoso, así que nadie se enteraba.
    // [cazabug loop2]
    if (!detail) {
      console.error('[mp-webhook] no pudimos consultar el preapproval en MP', String(dataId))
      captureException(new Error('mp-webhook: getPreapproval devolvió null'), {
        dataId: String(dataId),
        impacto: 'el comercio puede haber pagado y quedar sin activar',
      })
      return c.json({ ok: false, error: 'no pudimos consultar Mercado Pago' }, 503)
    }
    {
      let sub = await Subscription.findOne({ preapprovalId: String(dataId) })
      if (!sub && (externalReference || detail.external_reference)) {
        sub = await Subscription.findOne({
          externalReference: String(externalReference ?? detail.external_reference),
        })
        if (sub && !sub.preapprovalId) sub.preapprovalId = String(dataId)
      }
      if (sub) {
        // Una cancelación pedida por el comercio es terminal: no la revivimos con
        // un webhook que llegue tarde (o con un evento viejo de MP). Sin esto, el
        // comercio cancelaba y el siguiente webhook lo devolvía a 'authorized' —
        // y de paso lo reactivaba. [cazabug loop2]
        const canceloElComercio =
          sub.status === 'cancelled' && (sub.rawLast as any)?.cancelledAt != null
        if (canceloElComercio && mapMpStatus(detail.status) === 'authorized') {
          console.warn('[mp-webhook] ignoro authorized sobre una cancelación del comercio', String(sub._id))
          return c.json({ ok: true })
        }
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
      } else {
        // No encontramos la suscripción. Pasa de verdad por carrera: la
        // notificación de MP puede llegar ANTES de que terminemos de escribir el
        // doc. Reintentar SÍ lo arregla, así que no confirmamos la entrega. Si
        // el preapproval no fuera nuestro, MP deja de reintentar por su cuenta.
        console.error('[mp-webhook] preapproval sin suscripción local', String(dataId))
        captureException(new Error('mp-webhook: preapproval sin Subscription'), {
          dataId: String(dataId),
          externalReference: String(externalReference ?? detail.external_reference ?? ''),
          impacto: 'un pago de MP no tiene a qué imputarse',
        })
        return c.json({ ok: false, error: 'suscripción no encontrada' }, 503)
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

/**
 * La request que perdió la carrera espera a que la ganadora termine de hablar
 * con Mercado Pago y le pide prestado su link. Sin esta espera devolvería una
 * suscripción sin `initPoint` y el comercio se quedaba mirando un botón que no
 * lo lleva a ningún lado.
 */
async function esperarSuscripcionViva(appId: unknown, merchantId: unknown) {
  for (let intento = 0; intento < 20; intento++) {
    const viva = await Subscription.findOne({
      appId,
      merchantId,
      status: { $in: ['pending', 'authorized'] },
    }).sort({ createdAt: -1 })
    if (viva && (viva.status === 'authorized' || viva.initPoint)) return viva
    await new Promise((r) => setTimeout(r, 150))
  }
  return null
}

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

  // Idempotencia: si el comercio ya tiene una suscripción VIVA, se le devuelve
  // esa. Antes cada llamada acuñaba un preapproval nuevo en Mercado Pago, así
  // que abandonar el checkout y reintentar dejaba links de pago vivos apilados;
  // completando dos, el comercio terminaba con dos débitos mensuales. Ver el
  // índice parcial único en models/Subscription.ts. [cazabug loop2]
  const viva = await Subscription.findOne({
    appId,
    merchantId: merchant._id,
    status: { $in: ['pending', 'authorized'] },
  }).sort({ createdAt: -1 })

  // Autorizada: ya está pagando, no hay a dónde mandarlo.
  // Pendiente con link: es el MISMO checkout que dejó a medias, lo retoma.
  // Pendiente SIN link (un intento anterior murió antes de que MP contestara):
  // no sirve para nada, se descarta y se acuña uno nuevo abajo.
  if (viva && (viva.status === 'authorized' || viva.initPoint)) {
    return c.json({
      ok: true,
      subscription: {
        id: viva._id.toString(),
        externalReference: viva.externalReference,
        preapprovalId: viva.preapprovalId,
        initPoint: viva.initPoint,
        status: viva.status,
      },
    })
  }
  if (viva) await Subscription.deleteOne({ _id: viva._id, status: 'pending', initPoint: null })

  // El tenant slug en el externalReference ayuda al webhook a debug.
  const tenant = c.get('tenant')
  // Precio por ciudad (en la moneda del tenant). Misma función que usa el
  // endpoint público, para que lo que se anuncia sea lo que se debita.
  const amount = precioPlanEfectivo(tenant)
  const externalReference = `cup-${tenant.slug}-${merchant._id.toString()}-${randomBytes(6).toString('hex')}`
  let sub
  try {
    sub = await Subscription.create({
      appId,
      merchantId: merchant._id,
      externalReference,
      plan: parsed.data.plan,
      amountARS: amount,
      currency: tenant.moneda ?? 'ARS',
      status: 'pending',
    })
  } catch (err) {
    // Dos pestañas apretaron "Activar pago" al mismo tiempo y las dos pasaron el
    // chequeo de arriba. El índice único deja entrar sólo a una; la que perdió
    // espera el link de la que ganó en vez de acuñar un segundo preapproval.
    if ((err as { code?: number })?.code !== 11000) throw err
    const ganadora = await esperarSuscripcionViva(appId, merchant._id)
    if (!ganadora) return c.json({ ok: false, error: 'no se pudo crear suscripción' }, 502)
    return c.json({
      ok: true,
      subscription: {
        id: ganadora._id.toString(),
        externalReference: ganadora.externalReference,
        preapprovalId: ganadora.preapprovalId,
        initPoint: ganadora.initPoint,
        status: ganadora.status,
      },
    })
  }

  const preapproval = await createPreapproval({
    reason: `${tenant.nombre} · ${merchant.nombre}`,
    externalReference,
    payerEmail: user.email,
    amount,
    currency: tenant.moneda ?? 'ARS',
    // back_url por-tenant: el comercio vuelve a SU ciudad post-pago, no a la
    // PWA global. tenantFrontUrl deriva https://<subdomain>.micuidad.com.
    backUrl: `${tenantFrontUrl(tenant)}/#/admin/billing/return?ref=${externalReference}`,
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

  // Cancelar significa dejar de pagar, no "dejar de pagar la última". Si el
  // comercio arrastra suscripciones vivas de antes de que el endpoint fuera
  // idempotente, cancelar sólo la más nueva lo dejaba pagando por las viejas sin
  // forma de verlas (el panel también muestra sólo la última). [cazabug loop2]
  const otrasVivas = await Subscription.find({
    appId,
    merchantId: auth.merchantId,
    _id: { $ne: sub._id },
    status: { $in: ['pending', 'authorized'] },
  })

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

  // Cancelar EN MERCADO PAGO primero. Antes esto sólo marcaba el estado local: le
  // decíamos al comercio "listo, cancelaste" y MP le seguía debitando todos los
  // meses. Si MP falla, NO mentimos — que reintente. [cazabug loop2]
  if (sub.preapprovalId) {
    const canceladoEnMp = await cancelPreapproval(sub.preapprovalId)
    if (!canceladoEnMp) {
      return c.json(
        {
          ok: false,
          error:
            'No pudimos cancelar el cobro en Mercado Pago. No te cancelamos la suscripción para no dejarte pagando sin saberlo: probá de nuevo en unos minutos o escribinos.',
        },
        503,
      )
    }
  }

  // Las arrastradas se cancelan también, y con el mismo criterio: si MP no puede
  // cancelar una, no le decimos al comercio que quedó todo cancelado.
  for (const otra of otrasVivas) {
    if (otra.preapprovalId && !(await cancelPreapproval(otra.preapprovalId))) {
      return c.json(
        {
          ok: false,
          error:
            'No pudimos cancelar todos tus cobros en Mercado Pago. No te cancelamos la suscripción para no dejarte pagando sin saberlo: probá de nuevo en unos minutos o escribinos.',
        },
        503,
      )
    }
    otra.status = 'cancelled'
    otra.rawLast = { cancelledAt: ahora.toISOString(), arrepentimiento: dentroDe10Dias }
    await otra.save()
  }

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
