import { describe, it, expect } from 'vitest'
import { computeClub, nivelDe } from './club'

// redeemedAt local al mediodía (TZ-safe, lejos de bordes de mes).
const at = (mes1a12: number, dia: number) =>
  `2026-${String(mes1a12).padStart(2, '0')}-${String(dia).padStart(2, '0')}T12:00:00`

// "ahora" fijo: 15 de junio 2026 (mes calendario = junio).
const NOW = new Date(2026, 5, 15)

const canje = (fecha: string, ahorro = 0) => ({ redeemedAt: fecha, ahorroEstimado: ahorro })

describe('nivelDe (umbrales Bronce 1 / Plata 4 / Oro 8)', () => {
  it('0 canjes = todavía sin nivel, próximo Bronce', () => {
    expect(nivelDe(0)).toMatchObject({ label: null, next: { label: 'Bronce', min: 1 } })
  })
  it('1 = Bronce → próximo Plata', () => {
    expect(nivelDe(1)).toMatchObject({ label: 'Bronce', next: { label: 'Plata', min: 4 } })
  })
  it('4 = Plata → próximo Oro', () => {
    expect(nivelDe(4)).toMatchObject({ label: 'Plata', next: { label: 'Oro', min: 8 } })
  })
  it('8 = Oro → sin próximo (máximo)', () => {
    expect(nivelDe(8)).toMatchObject({ label: 'Oro', next: null })
  })
})

describe('computeClub — nivel + entradas del mes actual', () => {
  it('0 canjes este mes → estado motivador (entradas 0, faltan 1)', () => {
    const r = computeClub([canje(at(5, 3))], NOW) // canje en mayo, no en junio
    expect(r.canjesEsteMes).toBe(0)
    expect(r.nivel.label).toBeNull()
    expect(r.faltan).toBe(1)
  })

  it('1 canje este mes → Bronce, 1 entrada, faltan 3 para Plata', () => {
    const r = computeClub([canje(at(6, 2))], NOW)
    expect(r.canjesEsteMes).toBe(1)
    expect(r.nivel.label).toBe('Bronce')
    expect(r.faltan).toBe(3)
    expect(r.nivel.next?.label).toBe('Plata')
  })

  it('4 canjes este mes → Plata, faltan 4 para Oro', () => {
    const r = computeClub([at(6, 1), at(6, 5), at(6, 9), at(6, 12)].map((f) => canje(f)), NOW)
    expect(r.nivel.label).toBe('Plata')
    expect(r.faltan).toBe(4)
  })

  it('8 canjes este mes → Oro, nivel máximo (faltan 0, progress 100)', () => {
    const r = computeClub(
      Array.from({ length: 8 }, (_, i) => canje(at(6, i + 1))),
      NOW,
    )
    expect(r.nivel.label).toBe('Oro')
    expect(r.nivel.next).toBeNull()
    expect(r.faltan).toBe(0)
    expect(r.progress).toBe(100)
  })
})

describe('computeClub — racha (meses consecutivos)', () => {
  it('jun + may + abr = 3', () => {
    expect(computeClub([at(6, 2), at(5, 10), at(4, 20)].map((f) => canje(f)), NOW).racha).toBe(3)
  })
  it('may + abr sin junio = 2 (cadena que termina en el último mes con canje)', () => {
    expect(computeClub([at(5, 10), at(4, 20)].map((f) => canje(f)), NOW).racha).toBe(2)
  })
  it('jun + abr con hueco en mayo = 1', () => {
    expect(computeClub([at(6, 2), at(4, 20)].map((f) => canje(f)), NOW).racha).toBe(1)
  })
  it('sin canjes = 0', () => {
    expect(computeClub([], NOW).racha).toBe(0)
  })
})

describe('computeClub — ahorro total (permanente, todos los meses)', () => {
  it('suma ahorroEstimado de todos los canjes', () => {
    const r = computeClub(
      [canje(at(6, 2), 1500), canje(at(5, 10), 800), canje(at(4, 20), 700)],
      NOW,
    )
    expect(r.ahorroTotal).toBe(3000)
  })
  it('tolera ahorroEstimado ausente (0)', () => {
    const r = computeClub([{ redeemedAt: at(6, 2) }], NOW)
    expect(r.ahorroTotal).toBe(0)
  })
})
