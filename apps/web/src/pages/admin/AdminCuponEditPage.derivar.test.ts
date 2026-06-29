import { describe, it, expect } from 'vitest'
import { derivarPorcentaje } from './AdminCuponEditPage'

// Bug #1/#9: en 'precio_fijo' el % efectivo se deriva del ahorro real, no del
// slider. El comercio carga 6000/4000 y debe publicarse 33% (no el default 30).
describe('derivarPorcentaje', () => {
  it('precio_fijo deriva el % del ahorro real (6000/4000 → 33)', () => {
    expect(derivarPorcentaje('precio_fijo', 6000, 4000, 30)).toBe(33)
  })

  it('precio_fijo redondea (1000/750 → 25)', () => {
    expect(derivarPorcentaje('precio_fijo', 1000, 750, 30)).toBe(25)
  })

  it('precio_fijo sin precio normal cae al slider', () => {
    expect(derivarPorcentaje('precio_fijo', undefined, 4000, 30)).toBe(30)
  })

  it('precio_fijo con normal <= fijo cae al slider (no negativo)', () => {
    expect(derivarPorcentaje('precio_fijo', 4000, 4000, 30)).toBe(30)
    expect(derivarPorcentaje('precio_fijo', 3000, 4000, 30)).toBe(30)
  })

  it('precio_fijo nunca devuelve 0 (mínimo 1%)', () => {
    // ahorro de $1 sobre $100000 → round(0.001%) = 0 → forzamos 1
    expect(derivarPorcentaje('precio_fijo', 100000, 99999, 30)).toBe(1)
  })

  it('tipo porcentaje usa el slider tal cual', () => {
    expect(derivarPorcentaje('porcentaje', 6000, 4000, 40)).toBe(40)
    expect(derivarPorcentaje('happy_hour', undefined, undefined, 15)).toBe(15)
  })
})
