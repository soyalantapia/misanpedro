import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import { Merchant, Referral } from '@/models'
import { requireMerchantAuth } from '@/middleware/auth'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { tenantFrontUrl } from '@/lib/urls'

export const referralsRoutes = new Hono()
referralsRoutes.use('*', tenantContext)

const CAP_WEEKS = 8
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin O/0/I/1 (legible)

/** Código de referido corto y único POR TENANT. */
export async function generateReferralCode(appId: unknown): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const b = randomBytes(6)
    let code = ''
    for (let i = 0; i < 6; i++) code += ALPHABET[b[i] % ALPHABET.length]
    if (!(await Merchant.exists({ appId, referralCode: code }))) return code
  }
  return `R${Date.now().toString(36).toUpperCase()}`
}

referralsRoutes.get('/me', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const merchant = await Merchant.findOne({ _id: auth.merchantId, appId })
  if (!merchant) return c.json({ ok: false, error: 'merchant not found' }, 404)

  // Lazy-gen del código para comercios viejos sin referralCode.
  if (!merchant.referralCode) {
    merchant.referralCode = await generateReferralCode(appId)
    await merchant.save()
  }

  const [pendientes, confirmados] = await Promise.all([
    Referral.countDocuments({ appId, referrerMerchantId: merchant._id, status: 'pending' }),
    Referral.countDocuments({ appId, referrerMerchantId: merchant._id, status: 'confirmed' }),
  ])

  return c.json({
    ok: true,
    referral: {
      code: merchant.referralCode,
      // El link tiene que llevar a la ciudad DEL COMERCIO. Antes se armaba con
      // env.APP_URL_FRONT —la URL global— aunque acá el tenant está en contexto:
      // un comercio de otra ciudad mandaba a sus conocidos a la ciudad ajena. Y el
      // referido se perdía en silencio, porque el código es único POR CIUDAD y el
      // alta lo busca con `{ appId, referralCode }`: el de la ciudad B no existe en
      // la A. El alta se completaba igual, sin error, y el que refirió nunca
      // recibía sus semanas gratis. Mismo helper que usa billing. [cazabug loop2]
      link: `${tenantFrontUrl(c.get('tenant'))}/#/admin/registro?ref=${merchant.referralCode}`,
      pendientes,
      confirmados,
      weeksEarned: merchant.referralWeeksEarned ?? 0,
      cap: CAP_WEEKS,
      freeTrialUntil: merchant.freeTrialUntil?.toISOString?.() ?? null,
    },
  })
})

// Lista de referidos del comercio (para mostrar nombre + estado en el panel).
// Solo pending + confirmed; los rejected (self/dup) no se exponen al referidor.
referralsRoutes.get('/mine', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)

  const referrals = await Referral.find({
    appId,
    referrerMerchantId: auth.merchantId,
    status: { $in: ['pending', 'confirmed'] },
  }).sort({ createdAt: -1 })

  const ids = referrals.map((r) => r.referredMerchantId)
  const merchants = await Merchant.find({ appId, _id: { $in: ids } }, { nombre: 1 })
  const nameMap = new Map(merchants.map((m) => [m._id.toString(), m.nombre]))

  return c.json({
    ok: true,
    referidos: referrals.map((r) => ({
      id: r._id.toString(),
      nombre: nameMap.get(r.referredMerchantId.toString()) ?? 'Comercio',
      status: r.status,
      weeksGranted: r.weeksGranted ?? 0,
      createdAt: (r as any).createdAt,
      confirmedAt: r.confirmedAt ?? null,
    })),
  })
})
