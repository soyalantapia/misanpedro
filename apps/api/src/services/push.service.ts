import webpush from 'web-push'
import { env } from '@/env'
import { PushSubscription } from '@/models'

let configured = false

export function initWebPush() {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
    configured = true
    console.log('[push] VAPID configurado')
  } else {
    console.log('[push] VAPID vacío; web push en no-op')
  }
}

export function isPushConfigured() {
  return configured
}

type CouponPush = {
  id: string
  titulo: string
  porcentaje: number
  categoria: string
  merchantNombre: string
}

/**
 * Envía un push a las suscripciones del tenant cuya preferencia matchee la
 * categoría del cupón (categorías vacías = todas). Borra suscripciones muertas
 * (404/410). No bloquea: se llama con `.catch()` desde la ruta de cupones.
 */
export async function sendCouponPush(appId: unknown, coupon: CouponPush) {
  if (!configured) return
  const subs = await PushSubscription.find({
    appId,
    $or: [{ categories: { $size: 0 } }, { categories: coupon.categoria }],
  })
  if (subs.length === 0) return

  const payload = JSON.stringify({
    title: `${coupon.porcentaje}% OFF en ${coupon.merchantNombre}`,
    body: coupon.titulo,
    url: `/#/cupon/${coupon.id}`,
    couponId: coupon.id,
  })

  await Promise.allSettled(
    subs.map(async (s) => {
      if (!s.keys?.p256dh || !s.keys?.auth) return
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
          payload,
        )
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: s._id }).catch(() => {})
        } else {
          console.error('[push] send error', err?.statusCode, err?.body ?? err?.message)
        }
      }
    }),
  )
}
