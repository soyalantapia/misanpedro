/**
 * Validaciones del formulario de registro del vecino.
 * Función pura (sin React, sin acceso a stores) → fácil de testear.
 */

export type RegistroForm = {
  nombre: string
  dni: string
  email: string
  whatsapp: string
  fechaNacimiento: string
  acceptedTc: boolean
}

export type RegistroErrors = Partial<Record<keyof RegistroForm, string>>

/**
 * `now` se inyecta para tests deterministas. En producción usa Date actual.
 */
export function validateRegistro(form: RegistroForm, now: Date = new Date()): RegistroErrors {
  const errs: RegistroErrors = {}

  if (form.nombre.trim().length < 3) errs.nombre = 'Mínimo 3 caracteres'
  else if (form.nombre.trim().length > 80) errs.nombre = 'Máximo 80 caracteres'

  const dni = form.dni.replace(/\D/g, '')
  if (dni.length < 7 || dni.length > 8) errs.dni = '7 u 8 dígitos sin puntos'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido'

  const wa = form.whatsapp.replace(/\D/g, '')
  if (wa.length < 10) errs.whatsapp = 'Número con código de área'

  if (!form.fechaNacimiento) {
    errs.fechaNacimiento = 'Fecha requerida'
  } else {
    const dob = new Date(form.fechaNacimiento)
    const minAge = new Date(now)
    minAge.setFullYear(minAge.getFullYear() - 16)
    if (dob > minAge) errs.fechaNacimiento = 'Tenés que ser mayor de 16'
  }

  if (!form.acceptedTc) errs.acceptedTc = 'Necesitamos que aceptes los términos'

  return errs
}
