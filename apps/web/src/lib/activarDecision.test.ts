import { describe, it, expect } from 'vitest'
import { decidirActivacion } from './activarDecision'

// [cazabug loop2 · P0] El vecino se llevaba al mostrador un código INVENTADO.
//
// El camino de demo ("activá local, sin backend") se elegía cuando NO había token.
// Pero en producción "no hay token" no significa "estoy en modo demo": significa
// "tu sesión se murió". Dos estados distintos compartiendo el mismo discriminante.
//
// Resultado: al vecino se le mostraba un QR y un código de 6 dígitos igual que
// siempre, el cajero lo tipeaba y salía "No encontramos este código". El vecino
// con el código en pantalla, jurando que lo tiene. Y nunca vio un cartel de
// "tu sesión venció".
//
// Ahora el discriminante del modo demo es el CUPÓN (uno de seed no tiene id de
// Mongo), no la ausencia de token.

const REAL = '6a68c00983592027a899c125' // ObjectId de Mongo
const DEMO = 'c-pizza-2x1' // cupón sembrado local

describe('decidirActivacion — qué pasa cuando el vecino toca "Canjear"', () => {
  it('🔴 EL BUG: cupón REAL y sesión muerta → lo mandamos a entrar, NO inventamos un código', () => {
    expect(decidirActivacion({ hayUser: true, hayToken: false, couponId: REAL })).toEqual({
      tipo: 'pedir-datos',
    })
  })

  it('cupón real con sesión viva → va al backend', () => {
    expect(decidirActivacion({ hayUser: true, hayToken: true, couponId: REAL })).toEqual({
      tipo: 'backend',
    })
  })

  it('cupón de DEMO → activación local (ese camino sí es legítimo)', () => {
    expect(decidirActivacion({ hayUser: true, hayToken: true, couponId: DEMO })).toEqual({
      tipo: 'local',
    })
    // Y sin token también: en la demo no hay backend que valga.
    expect(decidirActivacion({ hayUser: true, hayToken: false, couponId: DEMO })).toEqual({
      tipo: 'local',
    })
  })

  it('sin vecino identificado → primero que cargue sus datos', () => {
    expect(decidirActivacion({ hayUser: false, hayToken: false, couponId: REAL })).toEqual({
      tipo: 'pedir-datos',
    })
    expect(decidirActivacion({ hayUser: false, hayToken: true, couponId: REAL })).toEqual({
      tipo: 'pedir-datos',
    })
  })

  it('un id raro (ni ObjectId ni demo conocido) se trata como demo, no como real', () => {
    // Defensivo: si no podemos afirmar que el cupón vive en el backend, no
    // mandamos un request que va a fallar; pero tampoco es el caso peligroso,
    // porque un cupón que no está en el backend nunca se iba a poder canjear.
    expect(decidirActivacion({ hayUser: true, hayToken: true, couponId: 'xxx' })).toEqual({
      tipo: 'local',
    })
  })
})
