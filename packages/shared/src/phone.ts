/**
 * Capa ÚNICA de normalización de teléfonos a E.164 (dígitos, sin '+').
 *
 * Por qué existe: la identidad del vecino se guarda en forma CANÓNICA LOCAL
 * (`normalizeTelefono` saca país 54, móvil 9 y trunk 0 → "3329421234"), pero
 * WhatsApp exige el número internacional completo ("5493329421234@c.us"). Sin
 * una capa que reponga el país, TODOS los envíos de campaña fallaban.
 * [cazabug S9-07]
 *
 * Es multi-país (pivote Mi[Ciudad]): el prefijo sale del tenant
 * (`App.phonePrefix`, ej. "+54", "+57"), con Argentina por default.
 */

/** Código de país de Argentina — tiene la particularidad del 9 en móviles. */
const AR = '54'

/** Largo del número nacional argentino ya canónico: área + abonado = 10 dígitos. */
const AR_NATIONAL_LEN = 10

/**
 * Devuelve los dígitos E.164 (sin '+') listos para WhatsApp, o `null` si el
 * número no es normalizable (corto, vacío o basura). Nunca inventa un número:
 * el llamador debe reportar los `null` como omitidos, no como enviados.
 *
 * Acepta cualquier forma de entrada y converge al mismo canónico:
 *   "3329421234" · "03329 42-1234" · "+54 9 3329 421234" · "5493329421234"
 *     → "5493329421234"
 *
 * @param raw         teléfono en cualquier formato
 * @param phonePrefix prefijo del tenant (`App.phonePrefix`), ej. "+54" / "+57"
 */
export function toWhatsappDigits(raw: string, phonePrefix?: string): string | null {
  const cc = (phonePrefix ?? '').replace(/\D/g, '') || AR
  let d = (raw || '').replace(/\D/g, '')
  if (!d) return null

  // Prefijo internacional marcado como "00…" (ej. 0054…).
  if (d.startsWith('00')) d = d.slice(2)

  // ¿Ya trae el código de país? Para AR exigimos largo >= 12 (54 + 10 nacionales)
  // para no confundir un número local que arranque con "54". Para el resto,
  // alcanza con que queden >= 8 dígitos nacionales.
  const minWithCC = cc === AR ? cc.length + AR_NATIONAL_LEN : cc.length + 8
  if (d.startsWith(cc) && d.length >= minWithCC) d = d.slice(cc.length)

  // Trunk local ("0" antes del área).
  if (d.startsWith('0')) d = d.slice(1)

  if (cc === AR) {
    // Móvil argentino: WhatsApp exige el 9 entre el país y el área. Lo sacamos
    // si vino y lo reponemos siempre, así el resultado es idempotente.
    if (d.startsWith('9') && d.length > AR_NATIONAL_LEN) d = d.slice(1)
    if (d.length < AR_NATIONAL_LEN) return null
    return `${AR}9${d}`
  }

  if (d.length < 8) return null
  return `${cc}${d}`
}
