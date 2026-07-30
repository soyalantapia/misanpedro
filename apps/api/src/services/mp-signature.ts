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

  // El `ts` viene en dos unidades distintas según qué doc de MP mires:
  //   · ARG  ts=1704908010     → 10/01/2024 leído como SEGUNDOS (como ms daría 1970)
  //   · BR   ts=1742505638683  → 20/03/2025 leído como MILISEGUNDOS (como s, absurdo)
  //
  // Antes se asumía milisegundos y se comparaba contra Date.now() con ventana de
  // 5 minutos. Con un ts en segundos la diferencia da ~1,78e12 ms: SIEMPRE fuera
  // de la ventana → 401 a todo webhook, y ninguna suscripción se activaría nunca.
  // El test tampoco lo veía: construía la firma con la misma suposición que el
  // código. [cazabug loop2]
  //
  // No elegimos una: aceptamos las dos. La magnitud desambigua sin lugar a duda
  // (1e11 segundos = año 5138; 1e11 ms = 1973) y no debilita el anti-replay,
  // porque un ts viejo queda fuera de la ventana en cualquiera de las dos.
  //
  // ⚠️ Lo que firma MP es el STRING original del header, no el normalizado: el
  // manifest de abajo tiene que seguir usando `ts`, nunca `tsMs`.
  const tsCrudo = parseInt(ts, 10)
  if (!Number.isFinite(tsCrudo)) return false
  const UMBRAL_SEGUNDOS = 1e11
  const tsMs = Math.abs(tsCrudo) < UMBRAL_SEGUNDOS ? tsCrudo * 1000 : tsCrudo
  if (Math.abs(now - tsMs) > 5 * 60 * 1000) {
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
