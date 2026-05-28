import { describe, it, expect } from 'vitest'
import { validateCuit, normalizeCuit, formatCuit } from './cuit'

describe('validateCuit', () => {
  describe('CUITs válidos (DVs calculados manualmente)', () => {
    // 20+12345678 → sum=148, mod=5, dv=6
    it('acepta 20-12345678-6', () => {
      expect(validateCuit('20-12345678-6').ok).toBe(true)
    })

    it('acepta sin guiones', () => {
      expect(validateCuit('20123456786').ok).toBe(true)
    })

    it('acepta con espacios', () => {
      expect(validateCuit('20 12345678 6').ok).toBe(true)
    })

    // 30+50000845 → sum=84, mod=7, dv=4
    it('acepta 30-50000845-4 (Anses)', () => {
      expect(validateCuit('30-50000845-4').ok).toBe(true)
    })
  })

  describe('CUITs inválidos', () => {
    it('rechaza vacío', () => {
      const r = validateCuit('')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/falta/i)
    })

    it('rechaza menos de 11 dígitos', () => {
      const r = validateCuit('20-1234567-8')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/11 dígitos/i)
    })

    it('rechaza más de 11 dígitos', () => {
      expect(validateCuit('20-123456789-1').ok).toBe(false)
    })

    it('rechaza prefijo inválido', () => {
      const r = validateCuit('99-12345678-6')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/prefijo/i)
    })

    it('rechaza DV incorrecto', () => {
      const r = validateCuit('20-12345678-9')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/verificador/i)
    })
  })
})

describe('normalizeCuit', () => {
  it('limpia guiones, espacios y puntos', () => {
    expect(normalizeCuit('20-12.345.678-3')).toBe('20123456783')
  })
})

describe('formatCuit', () => {
  it('formatea 11 dígitos con guiones', () => {
    expect(formatCuit('20123456783')).toBe('20-12345678-3')
  })

  it('devuelve input si no son 11 dígitos', () => {
    expect(formatCuit('12345')).toBe('12345')
  })
})
