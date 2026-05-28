import { describe, it, expect } from 'vitest'
import { distanceKm } from './geo'

describe('distanceKm', () => {
  it('devuelve 0 entre el mismo punto', () => {
    const p = { lat: -33.6818, lng: -59.6622 } // San Pedro, BA
    expect(distanceKm(p, p)).toBeCloseTo(0, 5)
  })

  it('calcula distancia conocida (San Pedro → Baradero ≈ 30km)', () => {
    const sanPedro = { lat: -33.6818, lng: -59.6622 }
    const baradero = { lat: -33.8124, lng: -59.5044 }
    const d = distanceKm(sanPedro, baradero)
    expect(d).toBeGreaterThan(15)
    expect(d).toBeLessThan(30)
  })

  it('es simétrica', () => {
    const a = { lat: 10, lng: 20 }
    const b = { lat: -10, lng: 30 }
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6)
  })

  it('cruzando el ecuador es positiva', () => {
    expect(distanceKm({ lat: -1, lng: 0 }, { lat: 1, lng: 0 })).toBeGreaterThan(0)
  })

  it('1° de latitud ≈ 111 km en el ecuador', () => {
    const d = distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(112)
  })
})
