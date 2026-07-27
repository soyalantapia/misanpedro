import { describe, it, expect } from 'vitest'
import { normalizeTelefono } from '@misanpedro/shared'

// [cazabug S1-02 · P1] La identidad del vecino es (appId, telefono canónico).
// normalizeTelefono aplicaba reglas ARGENTINAS a todos los tenants del pivote
// Mi[Ciudad]: sacaba el "54" y —peor— cualquier "9" inicial, que en Chile es el
// primer dígito de TODOS los celulares. Resultado: cuentas partidas (el mismo
// vecino no recuperaba su ahorro en otro celular) o corrompidas.

describe('normalizeTelefono — Argentina (comportamiento histórico intacto)', () => {
  // CRÍTICO: estas salidas son la forma en la que YA está guardada la identidad
  // de los vecinos existentes. Si cambian, se fragmentan las cuentas de prod.
  it('converge al mismo canónico escriba como escriba', () => {
    for (const raw of ['3329421234', '+54 9 3329 421234', '54 9 3329 421234', '03329421234']) {
      expect(normalizeTelefono(raw)).toBe('3329421234')
    }
  })

  it('el prefijo +54 explícito da el mismo resultado que el default', () => {
    expect(normalizeTelefono('+54 9 11 5566-7788', '+54')).toBe('1155667788')
    expect(normalizeTelefono('+54 9 11 5566-7788')).toBe('1155667788')
  })
})

describe('normalizeTelefono — multi-país (pivote Mi[Ciudad])', () => {
  it('Chile: NO le come el 9 inicial del celular', () => {
    // Celular chileno: 9 + 8 dígitos. Con las reglas AR quedaba "87654321".
    expect(normalizeTelefono('987654321', '+56')).toBe('987654321')
    expect(normalizeTelefono('+56 9 8765 4321', '+56')).toBe('987654321')
  })

  it('Colombia: saca su propio código de país, no el 54', () => {
    expect(normalizeTelefono('3001234567', '+57')).toBe('3001234567')
    expect(normalizeTelefono('+57 300 123 4567', '+57')).toBe('3001234567')
    expect(normalizeTelefono('0057 300 123 4567', '+57')).toBe('3001234567')
  })

  it('el mismo vecino en dos dispositivos cae en la MISMA cuenta (con y sin prefijo)', () => {
    const dispositivoA = normalizeTelefono('+57 300 1234567', '+57')
    const dispositivoB = normalizeTelefono('300 1234567', '+57')
    expect(dispositivoA).toBe(dispositivoB)
  })

  it('no confunde un número local que arranca con el código de país', () => {
    // 57… local corto: no le saca el "57" porque no queda nacional plausible.
    expect(normalizeTelefono('5712345', '+57')).toBe('5712345')
  })
})
