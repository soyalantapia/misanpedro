import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verifica firma del webhook de Mercado Pago.
 *
 * Algoritmo (per docs MP, 2024):
 *   manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
 *   v1 = HMAC-SHA256(manifest, secret).hex
 *
 * Política de seguridad:
 *   - En production sin secret → FALSE (fail-closed)
 *   - En development sin secret → TRUE (para testing local)
 *   - timestamp ±5 min para anti-replay
 *   - timingSafeEqual para evitar side-channel attacks
 *
 * Extraído de billing.ts para poder testearlo unitariamente sin levantar
 * todo el server.
 */
export type MpSignatureInput = {
  signatureHeader: string | undefined
  requestId: string | undefined
  dataId: string
  secret: string | undefined
  isProduction: boolean
  /** Inyectable para tests deterministas. Default Date.now(). */
  now?: number
}

export function verifyMpSignature(input: MpSignatureInput): boolean {
  const { signatureHeader, requestId, dataId, secret, isProduction, now = Date.now() } = input

  if (!secret) {
    // Sin secret en prod → rechazamos. En dev → aceptamos (testing local).
    return !isProduction
  }
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

  const tsMs = parseInt(ts, 10)
  if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > 5 * 60 * 1000) {
    return false
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
  } catch {
    return false
  }
}

/**
 * Mapea el status raw de MP a nuestro enum interno.
 */
export type SubStatus = 'pending' | 'authorized' | 'paused' | 'cancelled' | 'rejected'

export function mapMpStatus(s: string): SubStatus {
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
