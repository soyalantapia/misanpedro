import { describe, it, expect } from 'vitest'
import { monthsSince } from './AdminClienteDetailPage'

// Bug #16: un cliente con su primer/único canje hoy debe dar 0 meses, así la
// card de Frecuencia cae en "Cliente nuevo" (no "1/mes · 1 mes de actividad").
describe('monthsSince', () => {
  const NOW = new Date('2026-06-30T12:00:00').getTime()

  it('canje de hoy → 0 (no forzar piso de 1)', () => {
    expect(monthsSince(new Date('2026-06-30T09:00:00').toISOString(), NOW)).toBe(0)
  })

  it('canje de hace 10 días → 0', () => {
    expect(monthsSince(new Date('2026-06-20T12:00:00').toISOString(), NOW)).toBe(0)
  })

  it('canje de hace ~1 mes → 1', () => {
    expect(monthsSince(new Date('2026-05-31T12:00:00').toISOString(), NOW)).toBe(1)
  })

  it('canje de hace ~3 meses → 3', () => {
    expect(monthsSince(new Date('2026-03-31T12:00:00').toISOString(), NOW)).toBe(3)
  })

  it('sin fecha → 0', () => {
    expect(monthsSince(undefined, NOW)).toBe(0)
  })
})
