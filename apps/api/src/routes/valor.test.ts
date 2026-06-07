import { describe, it, expect } from 'vitest'
import { calcAhorroCanje } from '@misanpedro/shared'

describe('calcAhorroCanje — ahorro del canje por tipo', () => {
  it('porcentaje: % del ticket', () => {
    expect(calcAhorroCanje({ tipoOferta: 'porcentaje', porcentaje: 20 }, 5000)).toBe(1000)
  })
  it('happy_hour: % del ticket', () => {
    expect(calcAhorroCanje({ tipoOferta: 'happy_hour', porcentaje: 50 }, 4000)).toBe(2000)
  })
  it('precio_fijo: ticket − precio fijo', () => {
    expect(calcAhorroCanje({ tipoOferta: 'precio_fijo', porcentaje: 1, precioFijo: 3000 }, 5000)).toBe(2000)
  })
  it('precio_fijo: nunca negativo (ticket < precio fijo)', () => {
    expect(calcAhorroCanje({ tipoOferta: 'precio_fijo', porcentaje: 1, precioFijo: 6000 }, 5000)).toBe(0)
  })
  it('precio_fijo sin precioFijo → cae al % (defensivo)', () => {
    expect(calcAhorroCanje({ tipoOferta: 'precio_fijo', porcentaje: 10 }, 5000)).toBe(500)
  })
  it('monto 0 → 0', () => {
    expect(calcAhorroCanje({ tipoOferta: 'porcentaje', porcentaje: 20 }, 0)).toBe(0)
  })
})
