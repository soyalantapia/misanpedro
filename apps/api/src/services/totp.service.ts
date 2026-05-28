import { generateSecret, generateURI, verifySync } from 'otplib'

/**
 * 2FA TOTP service. Usado por el Owner para login con doble factor.
 *
 * otplib v13 API:
 *   - generateSecret({ length }) → base32 secret
 *   - generateURI({ strategy: 'totp', issuer, label, secret }) → otpauth:// URI para QR
 *   - verifySync({ strategy: 'totp', secret, token, epochTolerance })
 *
 * Defaults: SHA1, 6 dígitos, 30s, ±1 ventana de tolerancia (~30s drift).
 */

const DEFAULT_ISSUER = 'Mi San Pedro'

/**
 * Genera un secret base32 para TOTP. Se guarda en Owner.totpSecret y se
 * comparte con el usuario via QR (que escanea con Google Authenticator).
 */
export function generateTotpSecret(): string {
  return generateSecret({ length: 20 })
}

/**
 * Construye el otpauth:// URI que se codifica como QR.
 * El usuario escanea el QR y su app guarda el secret.
 *
 * Ej: otpauth://totp/Mi%20San%20Pedro:hola@misanpedro.app?secret=XXX&issuer=Mi%20San%20Pedro
 */
export function buildTotpUri(opts: {
  email: string
  issuer?: string
  secret: string
}): string {
  return generateURI({
    strategy: 'totp',
    issuer: opts.issuer ?? DEFAULT_ISSUER,
    label: opts.email,
    secret: opts.secret,
    algorithm: 'sha1',
    digits: 6,
    period: 30,
  })
}

/**
 * Verifica un código TOTP de 6 dígitos contra el secret guardado.
 * Devuelve true si el código es válido en la ventana actual ±1 step (±30s).
 */
export function verifyTotpCode(opts: { secret: string; code: string }): boolean {
  if (!opts.secret) return false
  if (!/^\d{6}$/.test(opts.code)) return false
  try {
    const result = verifySync({
      strategy: 'totp',
      secret: opts.secret,
      token: opts.code,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      // 1 ventana de tolerancia = 30s atrás o adelante.
      epochTolerance: 1,
    })
    return result.valid === true
  } catch {
    return false
  }
}
