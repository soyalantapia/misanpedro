import { describe, it, expect } from 'vitest'
import { parseQrPayload } from './qrPayload'

describe('parseQrPayload', () => {
  describe('formato nuevo msp:act:CODE:COUPONID', () => {
    it('extrae el código de un payload bien formado', () => {
      expect(parseQrPayload('msp:act:123456:507f1f77bcf86cd799439011')).toBe('123456')
    })

    it('devuelve "" si falta el código', () => {
      expect(parseQrPayload('msp:act:')).toBe('')
    })

    it('extrae aunque no haya couponId', () => {
      expect(parseQrPayload('msp:act:123456')).toBe('123456')
    })
  })

  describe('formato legacy JSON', () => {
    it('extrae el código del campo "codigo"', () => {
      expect(parseQrPayload('{"codigo":"123456","activationId":"x"}')).toBe('123456')
    })

    it('devuelve "" si el JSON no tiene "codigo"', () => {
      expect(parseQrPayload('{"otro":"valor"}')).toBe('')
    })

    it('devuelve "" si "codigo" no es string', () => {
      expect(parseQrPayload('{"codigo":123}')).toBe('')
    })
  })

  describe('inputs inválidos', () => {
    it('devuelve "" para null', () => {
      expect(parseQrPayload(null)).toBe('')
    })

    it('devuelve "" para undefined', () => {
      expect(parseQrPayload(undefined)).toBe('')
    })

    it('devuelve "" para string vacío', () => {
      expect(parseQrPayload('')).toBe('')
    })

    it('devuelve "" para string que no es ni msp:act ni JSON', () => {
      expect(parseQrPayload('hello world')).toBe('')
    })

    it('devuelve "" para JSON inválido', () => {
      expect(parseQrPayload('{not json')).toBe('')
    })

    it('nunca tira excepción aunque el input sea raro', () => {
      expect(() => parseQrPayload('msp:act')).not.toThrow()
      expect(() => parseQrPayload('msp:act:::')).not.toThrow()
      expect(() => parseQrPayload('🤖')).not.toThrow()
    })
  })
})
