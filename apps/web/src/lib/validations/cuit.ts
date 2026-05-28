/**
 * Validación de CUIT/CUIL argentino.
 * Acepta formatos:
 *   - 20-12345678-9
 *   - 20123456789
 * Verifica:
 *   - 11 dígitos
 *   - Prefijo válido (20, 23, 24, 25, 26, 27, 30, 33, 34)
 *   - Dígito verificador correcto (algoritmo AFIP)
 */

const PREFIJOS_VALIDOS = new Set([20, 23, 24, 25, 26, 27, 30, 33, 34])
const MULTIPLICADORES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

export function normalizeCuit(input: string): string {
  return input.replace(/\D/g, '')
}

export function formatCuit(digits: string): string {
  const d = normalizeCuit(digits)
  if (d.length !== 11) return digits
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10, 11)}`
}

export function validateCuit(input: string): { ok: true } | { ok: false; error: string } {
  const digits = normalizeCuit(input)
  if (digits.length === 0) return { ok: false, error: 'Falta el CUIT' }
  if (digits.length !== 11)
    return { ok: false, error: 'El CUIT tiene que tener 11 dígitos (ej: 20-12345678-9)' }

  const prefijo = parseInt(digits.slice(0, 2), 10)
  if (!PREFIJOS_VALIDOS.has(prefijo))
    return {
      ok: false,
      error: 'El CUIT empieza con un prefijo inválido (20, 23, 24, 27, 30, 33...)',
    }

  // Algoritmo AFIP: multiplicar los primeros 10 dígitos por los multiplicadores,
  // sumar, calcular módulo 11, restar de 11. Si da 11→0, si da 10→inválido.
  const sum = MULTIPLICADORES.reduce((acc, mult, i) => acc + mult * parseInt(digits[i], 10), 0)
  const mod = sum % 11
  const dv = mod === 0 ? 0 : mod === 1 ? -1 : 11 - mod
  const ultimoDigito = parseInt(digits[10], 10)

  if (dv === -1 || dv !== ultimoDigito) {
    return {
      ok: false,
      error: 'El CUIT no es válido (dígito verificador no coincide). Revisalo.',
    }
  }

  return { ok: true }
}
