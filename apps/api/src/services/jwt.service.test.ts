import { describe, it, expect } from 'vitest'
import { signAccessToken, verifyAccessToken, type AccessPayload } from './jwt.service'
import jwt from 'jsonwebtoken'

describe('signAccessToken / verifyAccessToken', () => {
  it('sign + verify roundtrip preserva payload', () => {
    const payload: AccessPayload = {
      sub: '6a0f8d83fe00e82988ee83af',
      type: 'merchant_user',
      merchantId: '6a0f8d83fe00e82988ee83ad',
      appId: 'sanpedro',
    }
    const token = signAccessToken(payload)
    const decoded = verifyAccessToken(token)
    expect(decoded.sub).toBe(payload.sub)
    expect(decoded.type).toBe(payload.type)
    expect(decoded.merchantId).toBe(payload.merchantId)
    expect(decoded.appId).toBe(payload.appId)
  })

  it('emite tokens con expiración (exp claim)', () => {
    const token = signAccessToken({ sub: 'u1', type: 'user' })
    const decoded = jwt.decode(token) as { exp?: number; iat?: number }
    expect(decoded.exp).toBeTypeOf('number')
    expect(decoded.iat).toBeTypeOf('number')
    if (decoded.exp && decoded.iat) {
      const ttlSec = decoded.exp - decoded.iat
      // ACCESS_TTL = '1h' → 3600s
      expect(ttlSec).toBe(3600)
    }
  })

  it('rechaza token firmado con secret distinto', () => {
    const token = jwt.sign({ sub: 'fake', type: 'user' }, 'otro-secret-distinto', {
      expiresIn: '1h',
    })
    expect(() => verifyAccessToken(token)).toThrow()
  })

  it('rechaza token expirado', () => {
    const token = jwt.sign(
      { sub: 'u1', type: 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '-1h' }, // expirado hace 1h
    )
    expect(() => verifyAccessToken(token)).toThrow()
  })

  it('rechaza token con garbage', () => {
    expect(() => verifyAccessToken('definitely.not.a.jwt')).toThrow()
    expect(() => verifyAccessToken('')).toThrow()
  })

  it('discrimina type=owner, user, merchant_user en el payload', () => {
    const owner = verifyAccessToken(signAccessToken({ sub: 'o1', type: 'owner', rol: 'super' }))
    expect(owner.type).toBe('owner')
    expect(owner.rol).toBe('super')

    const user = verifyAccessToken(signAccessToken({ sub: 'u1', type: 'user', appId: 'sanpedro' }))
    expect(user.type).toBe('user')
    expect(user.appId).toBe('sanpedro')
  })
})
