import { describe, it, expect, beforeEach } from 'vitest'
import {
  formatMoney,
  setMoneyLocale,
  formatTimeRemaining,
  distanceLabel,
  formatBirthdate,
  formatHorariosSemana,
  defaultHorariosSemana,
  isOpenNow,
  pluralize,
  pad,
} from './format'
import type { HorariosSemana } from './types'

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

  // Bug #10: plural mal "A 1 cuadras" cuando el vecino está casi encima.
  it('1 cuadra → singular, no "1 cuadras"', () => {
    expect(distanceLabel(0.05)).toBe('A 1 cuadra')
    expect(distanceLabel(0)).toBe('A 1 cuadra')
  })

  it('2+ cuadras → plural', () => {
    expect(distanceLabel(0.2)).toBe('A 2 cuadras')
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

describe('pluralize', () => {
  // Bug #11: "Te quedan 1 semanas por ganar" → debe ser singular.
  it('1 → singular', () => {
    expect(pluralize(1, 'semana')).toBe('1 semana')
  })

  it('2+ → plural por defecto (+s)', () => {
    expect(pluralize(3, 'semana')).toBe('3 semanas')
    expect(pluralize(0, 'semana')).toBe('0 semanas')
  })

  it('plural irregular explícito', () => {
    expect(pluralize(1, 'envío', 'envíos')).toBe('1 envío')
    expect(pluralize(4, 'envío', 'envíos')).toBe('4 envíos')
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

describe('isOpenNow', () => {
  // Bug #7: una franja que cruza medianoche (ej. bar lun 20:00–02:00) debe
  // figurar "abierto" a la 01:00 del día siguiente aunque ese día esté cerrado.
  const nocturno: HorariosSemana = {
    lun: { abierto: true, desde: '20:00', hasta: '02:00' },
    mar: { abierto: false },
    mie: { abierto: false },
    jue: { abierto: false },
    vie: { abierto: false },
    sab: { abierto: false },
    dom: { abierto: false },
  }

  it('abierto a la 01:00 del martes por la franja del lunes que cruza medianoche', () => {
    // Martes 30/06/2026 01:00 local
    expect(isOpenNow(nocturno, new Date(2026, 5, 30, 1, 0))).toBe(true)
  })

  it('cerrado a las 03:00 del martes (ya pasó la cola del lunes)', () => {
    expect(isOpenNow(nocturno, new Date(2026, 5, 30, 3, 0))).toBe(false)
  })

  it('abierto el lunes 22:00 (dentro de su propia franja)', () => {
    // Lunes 29/06/2026 22:00
    expect(isOpenNow(nocturno, new Date(2026, 5, 29, 22, 0))).toBe(true)
  })

  it('cerrado el lunes 01:00 (antes de que arranque su franja, sin cola de domingo)', () => {
    expect(isOpenNow(nocturno, new Date(2026, 5, 29, 1, 0))).toBe(false)
  })

  it('horario normal mismo día: abierto dentro de la franja, cerrado fuera', () => {
    const diurno = defaultHorariosSemana() // Lun–Vie 09–18, Sáb 09–13, Dom cerrado
    expect(isOpenNow(diurno, new Date(2026, 5, 29, 12, 0))).toBe(true) // lun 12:00
    expect(isOpenNow(diurno, new Date(2026, 5, 29, 20, 0))).toBe(false) // lun 20:00
    expect(isOpenNow(diurno, new Date(2026, 5, 28, 12, 0))).toBe(false) // dom 12:00
  })

  it('null si no hay detalle', () => {
    expect(isOpenNow(undefined)).toBe(null)
    expect(isOpenNow(null)).toBe(null)
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
