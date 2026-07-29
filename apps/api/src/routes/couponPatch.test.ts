import { describe, it, expect } from 'vitest'
import { couponUpdateSchema, couponCreateSchema } from '@misanpedro/shared'

// [cazabug loop2] Pausar un descuento le borraba la configuración al comercio.
//
// `couponUpdateSchema` es `couponShape.partial()`, y en zod v4 `.partial()` hace
// el campo opcional pero NO desactiva su `.default(...)`. Entonces un
// PATCH {estado:'pausado'} —que es exactamente lo que manda el botón "Pausar"—
// salía del parseo con condiciones:'', usoMaxPorPersona:1 y usoVentana:'devida'.
// Como el handler asigna todo lo que no venga `undefined`, el comercio perdía sus
// condiciones y su límite de usos sin tocar nada.
//
// Efecto en el mostrador: el vecino que ya lo había usado una vez pasa a ver
// "ya usaste este cupón el máximo de veces" y el cajero no entiende por qué.

describe('couponUpdateSchema — un PATCH parcial no puede inventar campos', () => {
  it('🔴 PATCH {estado} devuelve SÓLO estado, sin defaults colados', () => {
    const r = couponUpdateSchema.safeParse({ estado: 'pausado' })
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ estado: 'pausado' })
  })

  it('lo mandado explícitamente sí llega', () => {
    const r = couponUpdateSchema.safeParse({ estado: 'activo', usoMaxPorPersona: 3, usoVentana: 'semana' })
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ estado: 'activo', usoMaxPorPersona: 3, usoVentana: 'semana' })
  })

  it('un PATCH vacío no toca nada', () => {
    const r = couponUpdateSchema.safeParse({})
    expect(r.success).toBe(true)
    expect(r.data).toEqual({})
  })

  it('una condición vacía a propósito SÍ se respeta (borrar es una decisión válida)', () => {
    const r = couponUpdateSchema.safeParse({ condiciones: '' })
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ condiciones: '' })
  })

  it('el schema de ALTA conserva sus defaults (ahí sí corresponden)', () => {
    const r = couponCreateSchema.safeParse({
      titulo: 'Veinte por ciento',
      descripcion: 'Un descuento de prueba con descripcion larga',
      porcentaje: 20,
      vigenciaHasta: '2026-12-31',
    })
    expect(r.success).toBe(true)
    // En el alta, no mandar el límite significa "1 vez de por vida", y está bien.
    expect(r.data?.usoMaxPorPersona).toBe(1)
    expect(r.data?.usoVentana).toBe('devida')
  })
})
