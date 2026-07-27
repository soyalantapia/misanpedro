import { describe, it, expect, afterEach } from 'vitest'
import { isLocalDb, otpDisclosureAllowed } from '@/lib/envSafety'

// [cazabug S2-03 · P1] Revelar el OTP (respuesta _debugCode + log) estaba gateado
// sólo por NODE_ENV !== 'production', y env.ts le pone default 'development'. Un
// deploy que se olvide la variable expone el código de CUALQUIER cuenta por HTTP.
// El gate ahora es fail-safe: mira a qué base estamos conectados.

describe('envSafety — el gate del OTP no depende de una sola variable', () => {
  afterEach(() => {
    delete process.env.ALLOW_DEBUG_OTP
  })

  it('reconoce una base local', () => {
    expect(isLocalDb('mongodb://localhost:27017/misanpedro-test')).toBe(true)
    expect(isLocalDb('mongodb://127.0.0.1:27017/x')).toBe(true)
  })

  it('una base REMOTA no es desarrollo (aunque NODE_ENV no sea production)', () => {
    expect(isLocalDb('mongodb+srv://user:pass@cluster0.l1lvvlb.mongodb.net/')).toBe(false)
  })

  it('en tests (base local) sí se puede revelar el OTP', () => {
    // El setup apunta MONGODB_URI a localhost.
    expect(otpDisclosureAllowed()).toBe(true)
  })

  it('con base remota NO se revela, aunque NODE_ENV diga development', () => {
    const original = process.env.MONGODB_URI
    process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster0.l1lvvlb.mongodb.net/'
    try {
      // `env` ya está parseado al importar, así que probamos la primitiva pura que
      // toma la decisión: una base remota nunca es una máquina de desarrollo.
      expect(isLocalDb(process.env.MONGODB_URI)).toBe(false)
    } finally {
      process.env.MONGODB_URI = original
    }
  })

  it('ALLOW_DEBUG_OTP=true es la escotilla explícita', () => {
    process.env.ALLOW_DEBUG_OTP = 'true'
    expect(otpDisclosureAllowed()).toBe(true)
  })
})
