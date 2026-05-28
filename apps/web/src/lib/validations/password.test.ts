import { describe, it, expect } from 'vitest'
import { evaluatePassword } from './password'

describe('evaluatePassword', () => {
  it('score 0 si vacía', () => {
    expect(evaluatePassword('').score).toBe(0)
  })

  it('muy débil si < 6 caracteres', () => {
    expect(evaluatePassword('abc').score).toBe(1)
    expect(evaluatePassword('123').score).toBe(1)
  })

  it('penaliza solo dígitos', () => {
    expect(evaluatePassword('12345678').score).toBeLessThan(3)
  })

  it('penaliza solo letras', () => {
    expect(evaluatePassword('abcdefghi').score).toBeLessThan(3)
  })

  it('penaliza secuencias comunes', () => {
    expect(evaluatePassword('123456789').score).toBe(1)
    expect(evaluatePassword('qwerty123').score).toBe(1)
    expect(evaluatePassword('Password1').score).toBe(1)
  })

  it('mezcla letras+números+símbolos da score alto', () => {
    expect(evaluatePassword('Mi$anPedro2026').score).toBe(4)
  })

  it('mayús+minus+números pero corta no llega a fuerte', () => {
    expect(evaluatePassword('AbCd1234').score).toBeLessThan(4)
  })

  it('hint solo aparece si score < 3', () => {
    expect(evaluatePassword('Mi$anPedro2026').hint).toBeNull()
    expect(evaluatePassword('abc123').hint).toBeTruthy()
  })
})
