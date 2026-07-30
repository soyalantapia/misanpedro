import { describe, it, expect } from 'vitest'
// El canónico se importa por ruta relativa a propósito: `apps/web` NO tiene
// @misanpedro/shared como dependencia —de ahí la convención de duplicar—, y este
// test necesita las DOS implementaciones de verdad, no una copia de la copia.
// Vive acá y no en apps/api porque el tsconfig de la API fija `rootDir: src` y
// rechaza importar fuera de su carpeta (ese guardarraíl está bien, no lo aflojamos).
// `valor.ts` es una función pura sin imports, así que no arrastra nada al bundle
// de tests.
import { calcAhorroCanje as canonico } from '../../../../packages/shared/src/valor'
import { calcAhorroCanje as copiaDelFront } from './cuponValor'

// [cazabug loop2] El ahorro se calcula en dos lugares y el candado era imaginario.
//
// `calcAhorroCanje` decide cuántos pesos se GRABAN en el canje: es el número que
// después ve el vecino en su billetera, el que suma su nivel del club y el que el
// comercio ve en sus estadísticas. Vive duplicado:
//
//   · packages/shared/src/valor.ts   → CANÓNICO, es el que usa el backend al persistir
//   · apps/web/src/lib/cuponValor.ts → copia, es el preview que ve el cajero al cobrar
//
// La copia del front decía: "Lockeado por cuponValor.test.ts con los mismos
// vectores que valor.test.ts". Ese archivo NO EXISTE — `packages/shared` no tiene
// ningún test, ni siquiera un runner. O sea que el canónico, el que define plata
// real, no tenía una sola prueba, y el candado apuntaba a la mitad equivocada: si
// alguien toca el canónico, el test del front sigue en verde porque prueba la copia.
//
// El resultado sería mudo y desagradable: el cajero le promete "ahorrás $X" al
// vecino y la base guarda $Y. No falla nada; simplemente los números dejan de
// cerrar entre el mostrador y la billetera.
//
// Este test cubre las dos mitades a la vez: fija el comportamiento del canónico Y
// exige que la copia coincida, caso por caso. Una divergencia no puede pasar
// desapercibida.

type Caso = {
  nombre: string
  coupon: { tipoOferta?: string | null; porcentaje: number; precioFijo?: number | null }
  monto: number
  espera: number
}

const CASOS: Caso[] = [
  // ── Porcentaje simple ───────────────────────────────────────────────
  { nombre: '20% sobre 5.000', coupon: { porcentaje: 20 }, monto: 5000, espera: 1000 },
  { nombre: '15% sobre 3.333 redondea', coupon: { porcentaje: 15 }, monto: 3333, espera: 500 },
  { nombre: '100% = el ticket entero', coupon: { porcentaje: 100 }, monto: 2500, espera: 2500 },
  { nombre: '1% de un ticket chico', coupon: { porcentaje: 1 }, monto: 150, espera: 2 },

  // ── happy_hour cae en la rama del porcentaje ────────────────────────
  {
    nombre: 'happy hour usa el porcentaje',
    coupon: { tipoOferta: 'happy_hour', porcentaje: 30 },
    monto: 4000,
    espera: 1200,
  },

  // ── Precio fijo: el ahorro es la DIFERENCIA, no el porcentaje ───────
  {
    nombre: 'precio fijo: ticket 5.000, paga 3.000',
    coupon: { tipoOferta: 'precio_fijo', porcentaje: 40, precioFijo: 3000 },
    monto: 5000,
    espera: 2000,
  },
  {
    nombre: 'precio fijo con ticket MENOR al precio fijo no da ahorro negativo',
    coupon: { tipoOferta: 'precio_fijo', porcentaje: 40, precioFijo: 3000 },
    monto: 1000,
    espera: 0,
  },
  {
    nombre: 'precio fijo SIN precioFijo cargado cae al porcentaje',
    coupon: { tipoOferta: 'precio_fijo', porcentaje: 25, precioFijo: null },
    monto: 4000,
    espera: 1000,
  },
  {
    nombre: 'precio fijo en 0 es un precio válido: se ahorra todo el ticket',
    coupon: { tipoOferta: 'precio_fijo', porcentaje: 50, precioFijo: 0 },
    monto: 1800,
    espera: 1800,
  },

  // ── Bordes del monto: nunca bloquean ni inventan plata ──────────────
  { nombre: 'monto 0 → ahorro 0', coupon: { porcentaje: 20 }, monto: 0, espera: 0 },
  { nombre: 'monto negativo → ahorro 0', coupon: { porcentaje: 20 }, monto: -500, espera: 0 },
  {
    nombre: 'monto 0 con precio fijo tampoco inventa ahorro',
    coupon: { tipoOferta: 'precio_fijo', porcentaje: 40, precioFijo: 3000 },
    monto: 0,
    espera: 0,
  },
]

describe('calcAhorroCanje — el canónico, que es el que persiste la plata', () => {
  for (const caso of CASOS) {
    it(caso.nombre, () => {
      expect(canonico(caso.coupon, caso.monto)).toBe(caso.espera)
    })
  }

  it('siempre devuelve un entero: son pesos, no puede haber centavos flotando', () => {
    for (const caso of CASOS) {
      expect(Number.isInteger(canonico(caso.coupon, caso.monto))).toBe(true)
    }
  })

  it('nunca devuelve negativo: un canje no puede COBRARLE al vecino', () => {
    for (const caso of CASOS) {
      expect(canonico(caso.coupon, caso.monto)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('🔴 el preview del cajero y lo que se graba no pueden divergir', () => {
  for (const caso of CASOS) {
    it(`coinciden en: ${caso.nombre}`, () => {
      expect(copiaDelFront(caso.coupon, caso.monto)).toBe(canonico(caso.coupon, caso.monto))
    })
  }

  it('coinciden también sobre montos al azar, no sólo sobre los casos elegidos', () => {
    // Barrido determinístico (sin random: un test que falla distinto cada vez no
    // sirve). Cubre redondeos que ningún caso escrito a mano va a pensar.
    for (let monto = 1; monto <= 20_000; monto += 137) {
      for (const pct of [1, 7, 15, 33, 50, 99, 100]) {
        expect(copiaDelFront({ porcentaje: pct }, monto)).toBe(canonico({ porcentaje: pct }, monto))
      }
      for (const fijo of [0, 999, 5000]) {
        const c = { tipoOferta: 'precio_fijo', porcentaje: 40, precioFijo: fijo }
        expect(copiaDelFront(c, monto)).toBe(canonico(c, monto))
      }
    }
  })
})
