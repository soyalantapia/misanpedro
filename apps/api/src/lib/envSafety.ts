/**
 * Decisiones de seguridad que NO deben depender de una sola env var.
 *
 * El problema: varios comportamientos peligrosos (revelar el código OTP en la
 * respuesta HTTP y en los logs) estaban gateados sólo por `NODE_ENV !== 'production'`.
 * `env.ts` define NODE_ENV con default 'development', así que un deploy que se
 * olvide de setearlo corre como "desarrollo" en un servidor público: cualquiera
 * pide un OTP de cualquier email y lee el código en la respuesta = takeover.
 * [cazabug S2-03]
 *
 * La señal más confiable de "esto es producción" no es la variable, es a QUÉ BASE
 * estamos conectados: si la Mongo no es local, no es una máquina de desarrollo.
 */

import { env } from '@/env'

/** ¿La DB es local (localhost/127.0.0.1) o una in-memory de tests?
 *  Lee `process.env` en cada llamada (no el env cacheado al importar) para que la
 *  decisión sea dinámica y testeable. */
export function isLocalDb(uri = process.env.MONGODB_URI ?? env.MONGODB_URI): boolean {
  return /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(uri)
}

/**
 * ¿Podemos revelar el código OTP (respuesta `_debugCode` y log)? Sólo en una
 * máquina de desarrollo de verdad. Fail-safe: aunque NODE_ENV diga 'development',
 * si la base es remota tratamos el entorno como productivo y NO revelamos nada.
 * Escotilla explícita: ALLOW_DEBUG_OTP=true (para debuggear contra una base remota
 * a propósito, asumiendo el riesgo).
 */
export function otpDisclosureAllowed(): boolean {
  if (env.NODE_ENV === 'production') return false
  if (process.env.ALLOW_DEBUG_OTP === 'true') return true
  return isLocalDb()
}
