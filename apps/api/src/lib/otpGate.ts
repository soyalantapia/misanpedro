import { Otp } from '@/models'

/**
 * Gate ATÓMICO contra fuerza bruta sobre un código OTP.
 *
 * Chequear `attempts` con un read y recién después incrementar (incluso con
 * `$inc` atómico) dejaba una ventana (TOCTOU): una ráfaga concurrente leía el
 * mismo valor viejo, pasaba el gate y evaluaba la adivinanza igual. Medido: 20
 * requests en paralelo daban 8-10 adivinanzas reales en vez de 5, y hasta
 * permitían entrar con el código correcto fuera de turno. Al meter el filtro
 * `attempts: { $lt: max }` DENTRO del propio update, Mongo serializa las
 * escrituras sobre el documento y el que llega tarde no matchea → se corta sin
 * ventana.
 *
 * Este mismo bloque estaba copy-pasteado en los tres flujos de OTP (vecino,
 * comercio, owner) — así fue como el bug original se duplicó en comercio y
 * owner cuando se corrigió sólo en uno. Un solo lugar, un solo arreglo futuro.
 *
 * Devuelve el documento ya incrementado, o `null` si se agotaron los intentos.
 * El llamador DEBE comparar el hash contra el documento DEVUELTO, nunca contra
 * el viejo (leído antes del gate).
 */
export async function consumeOtpAttempt(otpId: unknown, max: number) {
  return Otp.findOneAndUpdate(
    { _id: otpId, attempts: { $lt: max } },
    { $inc: { attempts: 1 } },
    { new: true },
  )
}
