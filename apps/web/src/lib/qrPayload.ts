/**
 * Parsea el payload escaneado de un QR de cupón. Soporta dos formatos:
 *   - Nuevo (preferido): `msp:act:CODE:COUPONID`
 *   - Legacy (JSON):     `{"codigo":"123456",...}`
 *
 * Devuelve el código de 6 dígitos o '' si no se pudo extraer. Nunca tira:
 * cualquier input inválido devuelve ''.
 */
export function parseQrPayload(payload: string | null | undefined): string {
  if (!payload) return ''
  if (payload.startsWith('msp:act:')) {
    const parts = payload.split(':')
    return parts[2] ?? ''
  }
  try {
    const parsed = JSON.parse(payload) as { codigo?: unknown }
    return typeof parsed.codigo === 'string' ? parsed.codigo : ''
  } catch {
    return ''
  }
}
