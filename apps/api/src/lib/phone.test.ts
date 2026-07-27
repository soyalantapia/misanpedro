import { describe, it, expect } from 'vitest'
import { toWhatsappDigits, normalizeTelefono } from '@misanpedro/shared'

// [cazabug S9-07 · P1] La identidad del vecino se guarda en forma canónica LOCAL
// (normalizeTelefono saca 54/9/0), pero WhatsApp exige el internacional completo.
// toChatId sólo hacía replace(/\D/g,'') → mandaba "3329421234@c.us" (ID inválido)
// y TODOS los envíos fallaban. toWhatsappDigits repone el país por tenant.

describe('toWhatsappDigits — normalización E.164 para WhatsApp', () => {
  it('el canónico que guarda el onboarding vuelve a ser internacional (AR)', () => {
    // Esto es exactamente lo que hay en User.telefono tras normalizeTelefono.
    const guardado = normalizeTelefono('+54 9 3329 42-1234')
    expect(guardado).toBe('3329421234')
    expect(toWhatsappDigits(guardado)).toBe('5493329421234')
  })

  it('converge al MISMO número escriba como escriba el vecino', () => {
    const esperado = '5493329421234'
    for (const raw of [
      '3329421234',
      '03329 42-1234',
      '+54 9 3329 421234',
      '54 9 3329 421234',
      '5493329421234',
      '0054 9 3329 421234',
      '93329421234',
    ]) {
      expect(toWhatsappDigits(raw)).toBe(esperado)
    }
  })

  it('es idempotente: normalizar dos veces no duplica el país', () => {
    const once = toWhatsappDigits('3329421234')!
    expect(toWhatsappDigits(once)).toBe(once)
  })

  it('respeta el prefijo del tenant (multi-país: Colombia +57)', () => {
    expect(toWhatsappDigits('3001234567', '+57')).toBe('573001234567')
    // Ya internacional → no se toca.
    expect(toWhatsappDigits('573001234567', '+57')).toBe('573001234567')
  })

  it('devuelve null para lo no normalizable (se reporta como omitido, no enviado)', () => {
    expect(toWhatsappDigits('')).toBeNull()
    expect(toWhatsappDigits('123')).toBeNull()
    expect(toWhatsappDigits('sin numero')).toBeNull()
    expect(toWhatsappDigits('42-1234')).toBeNull() // sin código de área
  })

  it('un celular de Buenos Aires (área 11) también sale bien', () => {
    expect(toWhatsappDigits('1155667788')).toBe('5491155667788')
    expect(toWhatsappDigits('+54 9 11 5566-7788')).toBe('5491155667788')
  })
})
