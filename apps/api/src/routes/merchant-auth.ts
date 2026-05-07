import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { merchantLoginSchema } from '@misanpedro/shared'
import { Merchant, MerchantUser } from '@/models'
import {
  issueRefreshToken,
  signAccessToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllForSubject,
} from '@/services/jwt.service'
import { requireMerchantAuth } from '@/middleware/auth'

export const merchantAuthRoutes = new Hono()

merchantAuthRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = merchantLoginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const { email, password } = parsed.data

  const user = await MerchantUser.findOne({ email })
  if (!user) return c.json({ ok: false, error: 'credenciales inválidas' }, 401)

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return c.json({ ok: false, error: 'credenciales inválidas' }, 401)

  user.lastLoginAt = new Date()
  await user.save()

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'merchant_user',
    merchantId: user.merchantId.toString(),
  })
  const { token: refreshToken } = await issueRefreshToken({
    subjectType: 'merchant_user',
    subjectId: user._id.toString(),
    userAgent: c.req.header('user-agent'),
  })

  const merchant = await Merchant.findById(user.merchantId)

  return c.json({
    ok: true,
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      merchantId: user.merchantId.toString(),
    },
    merchant: merchant && {
      id: merchant._id.toString(),
      slug: merchant.slug,
      nombre: merchant.nombre,
      categoria: merchant.categoria,
    },
  })
})

merchantAuthRoutes.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (!refreshToken || typeof refreshToken !== 'string') {
    return c.json({ ok: false, error: 'refresh token required' }, 400)
  }
  const subject = await consumeRefreshToken(refreshToken)
  if (!subject || subject.subjectType !== 'merchant_user') {
    return c.json({ ok: false, error: 'invalid refresh token' }, 401)
  }
  const user = await MerchantUser.findById(subject.subjectId)
  if (!user) return c.json({ ok: false, error: 'user not found' }, 401)

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'merchant_user',
    merchantId: user.merchantId.toString(),
  })
  return c.json({ ok: true, accessToken })
})

merchantAuthRoutes.post('/logout', async (c) => {
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (refreshToken) await revokeRefreshToken(refreshToken)
  return c.json({ ok: true })
})

merchantAuthRoutes.post('/logout-all', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  await revokeAllForSubject(auth.sub)
  return c.json({ ok: true })
})

merchantAuthRoutes.get('/me', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  const user = await MerchantUser.findById(auth.sub)
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)
  const merchant = await Merchant.findById(user.merchantId)
  if (!merchant) return c.json({ ok: false, error: 'merchant not found' }, 404)
  return c.json({
    ok: true,
    user: {
      id: user._id.toString(),
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      merchantId: user.merchantId.toString(),
    },
    merchant: {
      id: merchant._id.toString(),
      slug: merchant.slug,
      nombre: merchant.nombre,
      categoria: merchant.categoria,
      estado: merchant.estado,
    },
  })
})
