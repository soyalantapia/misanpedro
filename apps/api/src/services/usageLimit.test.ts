import { describe, it, expect } from 'vitest'
import { evaluarUsoLimite } from '@misanpedro/shared'

// Enforcement del límite de uso por persona (decisión pura). El wrapper con DB
// (checkUsoLimite) + el bloqueo en activar/confirmar se verifican por E2E real
// (scripts/e2e-limite-uso.sh) contra la API corriendo.

const DIA = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 5, 15, 12, 0, 0) // 15 jun 2026, mediodía (determinista)
const haceDias = (n: number) => new Date(NOW.getTime() - n * DIA)

describe('evaluarUsoLimite — "devida" (una sola vez para siempre)', () => {
  it('0 canjes → permitido', () => {
    expect(evaluarUsoLimite({ usoMaxPorPersona: 1, usoVentana: 'devida' }, [], NOW).bloqueado).toBe(false)
  })
  it('1 canje (hace mucho) → bloqueado para siempre, nextDisponible null', () => {
    const r = evaluarUsoLimite({ usoMaxPorPersona: 1, usoVentana: 'devida' }, [haceDias(400)], NOW)
    expect(r.bloqueado).toBe(true)
    expect(r.nextDisponible).toBeNull()
  })
})

describe('evaluarUsoLimite — "semana" (7 días)', () => {
  it('canje hace 3 días → bloqueado; vuelve a los 7 días del canje', () => {
    const canje = haceDias(3)
    const r = evaluarUsoLimite({ usoMaxPorPersona: 1, usoVentana: 'semana' }, [canje], NOW)
    expect(r.bloqueado).toBe(true)
    expect(r.nextDisponible).toBe(new Date(canje.getTime() + 7 * DIA).toISOString())
  })
  it('canje hace 8 días → permitido (fuera de la ventana)', () => {
    expect(evaluarUsoLimite({ usoMaxPorPersona: 1, usoVentana: 'semana' }, [haceDias(8)], NOW).bloqueado).toBe(false)
  })
})

describe('evaluarUsoLimite — quincena (15) y mes (30)', () => {
  it('quincena: hace 10d bloqueado, hace 16d permitido', () => {
    expect(evaluarUsoLimite({ usoVentana: 'quincena' }, [haceDias(10)], NOW).bloqueado).toBe(true)
    expect(evaluarUsoLimite({ usoVentana: 'quincena' }, [haceDias(16)], NOW).bloqueado).toBe(false)
  })
  it('mes: hace 20d bloqueado, hace 31d permitido', () => {
    expect(evaluarUsoLimite({ usoVentana: 'mes' }, [haceDias(20)], NOW).bloqueado).toBe(true)
    expect(evaluarUsoLimite({ usoVentana: 'mes' }, [haceDias(31)], NOW).bloqueado).toBe(false)
  })
})

describe('evaluarUsoLimite — ilimitado', () => {
  it('nunca bloquea, aunque haya muchos canjes', () => {
    const muchos = [haceDias(0), haceDias(1), haceDias(2), haceDias(3)]
    expect(evaluarUsoLimite({ usoVentana: 'ilimitado' }, muchos, NOW).bloqueado).toBe(false)
  })
})

describe('evaluarUsoLimite — usoMaxPorPersona > 1', () => {
  it('max 2 semana: 1 permitido, 2 bloqueado', () => {
    expect(
      evaluarUsoLimite({ usoMaxPorPersona: 2, usoVentana: 'semana' }, [haceDias(1)], NOW).bloqueado,
    ).toBe(false)
    const dos = evaluarUsoLimite(
      { usoMaxPorPersona: 2, usoVentana: 'semana' },
      [haceDias(2), haceDias(1)],
      NOW,
    )
    expect(dos.bloqueado).toBe(true)
    expect(dos.usos).toBe(2)
  })
  it('bloqueado: nextDisponible = canje MÁS VIEJO de la ventana + 7d', () => {
    const viejo = haceDias(5)
    const nuevo = haceDias(1)
    const r = evaluarUsoLimite({ usoMaxPorPersona: 2, usoVentana: 'semana' }, [nuevo, viejo], NOW)
    expect(r.nextDisponible).toBe(new Date(viejo.getTime() + 7 * DIA).toISOString())
  })
  it('max 2: solo cuenta los de la ventana (un viejo afuera no suma)', () => {
    // 1 dentro (hace 2d) + 1 fuera (hace 9d) → usos=1 < 2 → permitido
    const r = evaluarUsoLimite({ usoMaxPorPersona: 2, usoVentana: 'semana' }, [haceDias(2), haceDias(9)], NOW)
    expect(r.usos).toBe(1)
    expect(r.bloqueado).toBe(false)
  })
})

describe('evaluarUsoLimite — defaults (cupón viejo sin config)', () => {
  it('sin config → {1, devida}: 1 canje bloquea (arregla el abuso)', () => {
    const r = evaluarUsoLimite({}, [haceDias(100)], NOW)
    expect(r.ventana).toBe('devida')
    expect(r.max).toBe(1)
    expect(r.bloqueado).toBe(true)
  })
})

describe('evaluarUsoLimite — bordes y casos límite', () => {
  it('semana: canje EXACTO hace 7 días sigue contando (>= inicio → bloquea)', () => {
    const justo = new Date(NOW.getTime() - 7 * DIA)
    expect(evaluarUsoLimite({ usoMaxPorPersona: 1, usoVentana: 'semana' }, [justo], NOW).bloqueado).toBe(true)
  })
  it('semana: canje 7 días + 1ms ya quedó fuera de la ventana', () => {
    const fuera = new Date(NOW.getTime() - 7 * DIA - 1)
    expect(evaluarUsoLimite({ usoMaxPorPersona: 1, usoVentana: 'semana' }, [fuera], NOW).bloqueado).toBe(false)
  })
  it('usoMaxPorPersona 0 se trata como 1 (Math.max)', () => {
    expect(evaluarUsoLimite({ usoMaxPorPersona: 0, usoVentana: 'devida' }, [haceDias(1)], NOW).bloqueado).toBe(true)
  })
  it('ilimitado ignora usoMaxPorPersona (no bloquea ni con varios)', () => {
    expect(
      evaluarUsoLimite({ usoMaxPorPersona: 1, usoVentana: 'ilimitado' }, [haceDias(0), haceDias(0)], NOW).bloqueado,
    ).toBe(false)
  })
  it('usoMax 2 bloqueado: nextDisponible usa el MÁS VIEJO de la ventana (no el más nuevo)', () => {
    const viejo = haceDias(6)
    const nuevo = haceDias(1)
    const r = evaluarUsoLimite({ usoMaxPorPersona: 2, usoVentana: 'semana' }, [nuevo, viejo], NOW)
    expect(r.bloqueado).toBe(true)
    expect(r.nextDisponible).toBe(new Date(viejo.getTime() + 7 * DIA).toISOString())
  })
  it('sin canjes nunca bloquea (todas las ventanas)', () => {
    for (const v of ['devida', 'semana', 'quincena', 'mes', 'ilimitado'] as const) {
      expect(evaluarUsoLimite({ usoMaxPorPersona: 1, usoVentana: v }, [], NOW).bloqueado).toBe(false)
    }
  })
})
