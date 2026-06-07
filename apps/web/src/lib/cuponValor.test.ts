import { describe, it, expect } from 'vitest'
import { valorCupon } from './cuponValor'

const base = { porcentaje: 25 }

describe('valorCupon — sistema de valor honesto (display)', () => {
  it('precio_fijo con precioRef → modo precio_fijo + ahorro = ref − fijo', () => {
    const v = valorCupon({ ...base, tipoOferta: 'precio_fijo', precioFijo: 3000, precioReferencia: 5000 })
    expect(v.modo).toBe('precio_fijo')
    expect(v.precioFijo).toBe(3000)
    expect(v.ahorro).toBe(2000)
  })
  it('precio_fijo sin precioRef → precio_fijo sin ahorro', () => {
    const v = valorCupon({ ...base, tipoOferta: 'precio_fijo', precioFijo: 3000 })
    expect(v.modo).toBe('precio_fijo')
    expect(v.ahorro).toBeUndefined()
  })
  it('% puntual + precio + toggle ON → pesos_exacto (paga + ahorro exacto)', () => {
    const v = valorCupon({ ...base, tipoOferta: 'porcentaje', alcance: 'puntual', precioReferencia: 4000 })
    expect(v.modo).toBe('pesos_exacto')
    expect(v.paga).toBe(3000)
    expect(v.ahorro).toBe(1000)
  })
  it('% categoria + precio → pesos_aprox (ahorro + ejemplo de $precioRef)', () => {
    const v = valorCupon({ ...base, tipoOferta: 'porcentaje', alcance: 'categoria', precioReferencia: 4000 })
    expect(v.modo).toBe('pesos_aprox')
    expect(v.ahorro).toBe(1000)
    expect(v.precioRef).toBe(4000)
  })
  it('toggle OFF → solo_pct aunque haya precio (no inventa pesos)', () => {
    const v = valorCupon({ ...base, tipoOferta: 'porcentaje', precioReferencia: 4000, mostrarAhorroVecino: false })
    expect(v.modo).toBe('solo_pct')
    expect(v.ahorro).toBeUndefined()
  })
  it('sin precio → solo_pct (NUNCA inventa pesos)', () => {
    const v = valorCupon({ ...base, tipoOferta: 'porcentaje' })
    expect(v.modo).toBe('solo_pct')
    expect(v.paga).toBeUndefined()
    expect(v.ahorro).toBeUndefined()
  })
  it('happy_hour puntual con precio → pesos_exacto + esHappyHour + franja', () => {
    const v = valorCupon({
      ...base,
      tipoOferta: 'happy_hour',
      alcance: 'puntual',
      precioReferencia: 4000,
      franjaDesde: '15:00',
      franjaHasta: '18:00',
    })
    expect(v.modo).toBe('pesos_exacto')
    expect(v.esHappyHour).toBe(true)
    expect(v.franja?.desde).toBe('15:00')
  })
  it('default (sin tipoOferta) = porcentaje', () => {
    const v = valorCupon({ porcentaje: 30, precioReferencia: 1000 })
    expect(v.modo).toBe('pesos_exacto')
    expect(v.paga).toBe(700)
  })
})
