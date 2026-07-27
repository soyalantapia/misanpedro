/**
 * Validación del alta del vecino (nombre + email + celular + T&C).
 * Función pura, sin React ni stores → fácil de testear.
 *
 * El EMAIL es la identidad: es lo único con lo que el vecino puede recuperar su
 * cuenta en otro celular. Por eso es obligatorio. [cazabug S1-01]
 */

export type ClaimForm = {
  nombre: string
  email: string
  telefono: string
  acceptedTc: boolean
}

export type ClaimErrors = Partial<Record<keyof ClaimForm, string>>

export function validateClaim(form: ClaimForm): ClaimErrors {
  const errs: ClaimErrors = {}

  const nombre = form.nombre.trim()
  if (nombre.length < 2) errs.nombre = 'Decinos tu nombre'
  else if (nombre.length > 80) errs.nombre = 'Máximo 80 caracteres'

  const email = form.email.trim()
  if (!email) errs.email = 'Necesitamos tu email para que puedas recuperar tu cuenta'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Revisá el email, parece incompleto'

  const tel = form.telefono.replace(/\D/g, '')
  if (tel.length < 8) errs.telefono = 'Poné tu celular con código de área'

  if (!form.acceptedTc) errs.acceptedTc = 'Necesitamos que aceptes los términos'

  return errs
}
