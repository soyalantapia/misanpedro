import { describe, it, expect } from 'vitest'
import { validateRegistro, type RegistroForm } from './registro'

const NOW = new Date('2026-05-27T12:00:00')

const valid: RegistroForm = {
  nombre: 'Lucas Pérez',
  dni: '30123456',
  email: 'lucas@example.com',
  whatsapp: '+54 9 3329 555555',
  fechaNacimiento: '2000-01-15',
  acceptedTc: true,
}

describe('validateRegistro', () => {
  it('acepta un formulario válido sin errores', () => {
    expect(validateRegistro(valid, NOW)).toEqual({})
  })

  describe('nombre', () => {
    it('falla si tiene < 3 caracteres', () => {
      expect(validateRegistro({ ...valid, nombre: 'Al' }, NOW).nombre).toMatch(/3 caracteres/i)
    })
    it('falla si tiene > 80 caracteres', () => {
      expect(validateRegistro({ ...valid, nombre: 'a'.repeat(81) }, NOW).nombre).toMatch(/80 caracteres/i)
    })
    it('ignora espacios al inicio/fin para contar', () => {
      expect(validateRegistro({ ...valid, nombre: '   ab   ' }, NOW).nombre).toMatch(/3 caracteres/i)
    })
  })

  describe('dni', () => {
    it('acepta 7 dígitos', () => {
      expect(validateRegistro({ ...valid, dni: '1234567' }, NOW).dni).toBeUndefined()
    })
    it('acepta 8 dígitos', () => {
      expect(validateRegistro({ ...valid, dni: '12345678' }, NOW).dni).toBeUndefined()
    })
    it('falla con menos de 7 dígitos', () => {
      expect(validateRegistro({ ...valid, dni: '123456' }, NOW).dni).toMatch(/7 u 8/i)
    })
    it('falla con más de 8 dígitos', () => {
      expect(validateRegistro({ ...valid, dni: '123456789' }, NOW).dni).toMatch(/7 u 8/i)
    })
    it('limpia puntos y guiones antes de validar', () => {
      expect(validateRegistro({ ...valid, dni: '30.123.456' }, NOW).dni).toBeUndefined()
    })
  })

  describe('email', () => {
    it('falla si falta @', () => {
      expect(validateRegistro({ ...valid, email: 'novalido.com' }, NOW).email).toBeDefined()
    })
    it('falla si falta TLD', () => {
      expect(validateRegistro({ ...valid, email: 'a@b' }, NOW).email).toBeDefined()
    })
    it('falla con espacios', () => {
      expect(validateRegistro({ ...valid, email: 'a @b.com' }, NOW).email).toBeDefined()
    })
    it('acepta email válido', () => {
      expect(validateRegistro({ ...valid, email: 'x@y.co' }, NOW).email).toBeUndefined()
    })
  })

  describe('whatsapp', () => {
    it('falla con menos de 10 dígitos', () => {
      expect(validateRegistro({ ...valid, whatsapp: '123456789' }, NOW).whatsapp).toBeDefined()
    })
    it('limpia espacios y +', () => {
      expect(validateRegistro({ ...valid, whatsapp: '+54 9 3329 555555' }, NOW).whatsapp).toBeUndefined()
    })
  })

  describe('fechaNacimiento', () => {
    it('falla si está vacío', () => {
      expect(validateRegistro({ ...valid, fechaNacimiento: '' }, NOW).fechaNacimiento).toMatch(/requerida/i)
    })
    it('falla si es menor de 16 años', () => {
      // 15 años en 2026-05-27 = nacido después de 2010-05-27
      expect(validateRegistro({ ...valid, fechaNacimiento: '2011-01-01' }, NOW).fechaNacimiento).toMatch(/16/i)
    })
    it('acepta exactamente 16 años', () => {
      expect(validateRegistro({ ...valid, fechaNacimiento: '2010-05-27' }, NOW).fechaNacimiento).toBeUndefined()
    })
    it('acepta mayores de 16', () => {
      expect(validateRegistro({ ...valid, fechaNacimiento: '1990-01-01' }, NOW).fechaNacimiento).toBeUndefined()
    })
  })

  describe('acceptedTc', () => {
    it('falla si no aceptó términos', () => {
      expect(validateRegistro({ ...valid, acceptedTc: false }, NOW).acceptedTc).toMatch(/términos/i)
    })
  })

  it('acumula múltiples errores', () => {
    const errs = validateRegistro(
      { nombre: '', dni: '', email: '', whatsapp: '', fechaNacimiento: '', acceptedTc: false },
      NOW,
    )
    expect(Object.keys(errs)).toEqual(
      expect.arrayContaining(['nombre', 'dni', 'email', 'whatsapp', 'fechaNacimiento', 'acceptedTc']),
    )
  })
})
