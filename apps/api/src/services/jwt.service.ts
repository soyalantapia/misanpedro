import jwt, { type SignOptions } from 'jsonwebtoken'
import { createHash, randomBytes } from 'node:crypto'
import { env } from '@/env'
import { RefreshToken } from '@/models'

const ACCESS_TTL = '15m'
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 días

export type Subject = 'user' | 'merchant_user'

export type AccessPayload = {
  sub: string
  type: Subject
  merchantId?: string // si type = merchant_user
}

export function signAccessToken(payload: AccessPayload): string {
  const opts: SignOptions = { expiresIn: ACCESS_TTL }
  return jwt.sign(payload, env.JWT_SECRET, opts)
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessPayload
}

/**
 * Genera un refresh token random (no JWT — entropía pura).
 * Persiste el HASH; devuelve el plano al cliente.
 */
export async function issueRefreshToken(input: {
  subjectType: Subject
  subjectId: string
  userAgent?: string
  ip?: string
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(48).toString('base64url')
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)
  await RefreshToken.create({
    tokenHash,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    expiresAt,
    userAgent: input.userAgent,
    ip: input.ip,
  })
  return { token, expiresAt }
}

/**
 * Valida un refresh token y devuelve el subject si está vigente.
 * NO rota — para eso usar `rotateRefreshToken`.
 */
export async function consumeRefreshToken(token: string): Promise<{
  subjectType: Subject
  subjectId: string
} | null> {
  const tokenHash = sha256(token)
  const doc = await RefreshToken.findOne({ tokenHash })
  if (!doc) return null
  if (doc.revokedAt) return null
  if (doc.expiresAt.getTime() < Date.now()) return null
  return {
    subjectType: doc.subjectType,
    subjectId: doc.subjectId.toString(),
  }
}

/**
 * Valida + revoca el token viejo + emite uno nuevo. Pattern de "rotation"
 * que limita el blast radius de un token comprometido.
 *
 * Si detecta reuso de un token ya revocado (señal de robo), revoca toda
 * la cadena del subject para forzar re-login.
 */
export async function rotateRefreshToken(
  oldToken: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ subjectType: Subject; subjectId: string; token: string; expiresAt: Date } | null> {
  const tokenHash = sha256(oldToken)
  const doc = await RefreshToken.findOne({ tokenHash })
  if (!doc) return null

  // Reuso de token ya revocado → posible robo, invalidamos todo
  if (doc.revokedAt) {
    await RefreshToken.updateMany(
      { subjectId: doc.subjectId, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    )
    return null
  }
  if (doc.expiresAt.getTime() < Date.now()) return null

  // Revoca el token viejo
  doc.revokedAt = new Date()
  await doc.save()

  // Emite uno nuevo
  const subjectType = doc.subjectType as Subject
  const subjectId = doc.subjectId.toString()
  const issued = await issueRefreshToken({
    subjectType,
    subjectId,
    userAgent: meta.userAgent,
    ip: meta.ip,
  })

  return {
    subjectType,
    subjectId,
    token: issued.token,
    expiresAt: issued.expiresAt,
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = sha256(token)
  await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() })
}

export async function revokeAllForSubject(subjectId: string): Promise<void> {
  await RefreshToken.updateMany(
    { subjectId, revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  )
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
