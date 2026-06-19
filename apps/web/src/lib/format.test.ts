import { describe, it, expect, beforeEach } from 'vitest'
import {
  formatMoney,
  setMoneyLocale,
  formatTimeRemaining,
  distanceLabel,
  formatBirthdate,
  formatHorariosSemana,
  defaultHorariosSemana,
  pad,
} from './format'

describe('formatMoney', () => {
  // format.ts guarda estado de módulo (_money). Si otra suite llama setMoneyLocale
  // antes, estos asserts (ARS/es-AR) fallarían según el orden. Reseteamos siempre.
  beforeEach(() => setMoneyLocale('es-AR', 'ARS'))

  it('formatea pesos argentinos sin decimales', () => {
    // Intl puede usar diferentes separadores; matcheamos $ y el número
    const result = formatMoney(1500)
    expect(result).toContain('1.500')
    expect(result).toContain('$')
  })

  it('redondea decimales', () => {
    expect(formatMoney(1500.7)).toContain('1.501')
  })

  it('maneja 0', () => {
    expect(formatMoney(0)).toContain('0')
  })

  it('maneja números grandes', () => {
    expect(formatMoney(1_234_567)).toContain('1.234.567')
  })
})

describe('formatTimeRemaining', () => {
  const NOW = new Date('2026-05-27T12:00:00').getTime()

  it('formatea minutos y segundos correctamente', () => {
    const future = new Date(NOW + 5 * 60 * 1000 + 30 * 1000).toISOString()
    expect(formatTimeRemaining(future, NOW)).toBe('05:30')
  })

  it('devuelve "Expirado" si ya pasó', () => {
    const past = new Date(NOW - 1000).toISOString()
    expect(formatTimeRemaining(past, NOW)).toBe('Expirado')
  })

  it('devuelve "Expirado" exactamente al borde', () => {
    expect(formatTimeRemaining(new Date(NOW).toISOString(), NOW)).toBe('Expirado')
  })

  it('formatea con padding de ceros', () => {
    const future = new Date(NOW + 9 * 1000).toISOString()
    expect(formatTimeRemaining(future, NOW)).toBe('00:09')
  })
})

describe('distanceLabel', () => {
  it('< 0.4km → cuadras', () => {
    expect(distanceLabel(0.2)).toMatch(/cuadras/)
  })

  it('< 1km → metros', () => {
    expect(distanceLabel(0.5)).toBe('A 500 m')
  })

  it('>= 1km → km con 1 decimal', () => {
    expect(distanceLabel(2.345)).toBe('A 2.3 km')
  })

  it('caso borde 0.4 = metros', () => {
    expect(distanceLabel(0.4)).toBe('A 400 m')
  })
})

describe('formatBirthdate', () => {
  it('formatea fecha en español', () => {
    expect(formatBirthdate('1992-06-15')).toMatch(/15 de junio de 1992/)
  })

  it('devuelve "—" si está vacío', () => {
    expect(formatBirthdate('')).toBe('—')
  })

  it('devuelve el input si no es fecha válida', () => {
    expect(formatBirthdate('not-a-date')).toBe('not-a-date')
  })
})

describe('pad', () => {
  it('agrega 0 a un dígito', () => {
    expect(pad(5)).toBe('05')
  })

  it('deja igual dos dígitos', () => {
    expect(pad(15)).toBe('15')
  })

  it('maneja 0', () => {
    expect(pad(0)).toBe('00')
  })
})

describe('formatHorariosSemana', () => {
  it('devuelve "" si detalle es undefined', () => {
    expect(formatHorariosSemana(undefined)).toBe('')
  })

  it('devuelve "" si está incompleto', () => {
    expect(formatHorariosSemana({ lun: { abierto: true, desde: '09:00', hasta: '18:00' } } as any)).toBe('')
  })

  it('agrupa días con el mismo horario', () => {
    const out = formatHorariosSemana(defaultHorariosSemana())
    expect(out).toContain('Lun a Vie')
    expect(out).toContain('Sáb')
    expect(out).toContain('Dom')
    expect(out).toContain('cerrado')
  })
})
