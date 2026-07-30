import { describe, it, expect } from 'vitest'
import { clasificarError, puedeRecargarSola } from './errorRecuperacion'

// [cazabug loop2] Espejo del test de la PWA. La lógica está duplicada por
// convención del repo (los fronts no comparten paquete), así que el test también
// va duplicado: si divergen, uno de los dos se pone en rojo.
//
// El render del boundary está cubierto por el test de la PWA
// (apps/web/src/components/ErrorBoundary.test.tsx): el componente es el mismo
// salvo los estilos, y el panel no tiene testing-library instalado.

describe('clasificarError', () => {
  it('🔴 chunk que no baja en Chrome → recargar', () => {
    expect(
      clasificarError(new TypeError('Failed to fetch dynamically imported module: /assets/x-a1b2.js')),
    ).toBe('recargar')
  })

  it('🔴 chunk que no baja en Firefox → recargar', () => {
    expect(clasificarError(new Error('error loading dynamically imported module'))).toBe('recargar')
  })

  it('🔴 chunk que no baja en Safari → recargar', () => {
    expect(clasificarError(new Error('Importing a module script failed.'))).toBe('recargar')
  })

  it('ChunkLoadError por nombre, sin mensaje útil → recargar', () => {
    const e = new Error('algo')
    e.name = 'ChunkLoadError'
    expect(clasificarError(e)).toBe('recargar')
  })

  it('un bug común de render se reintenta, no recarga (no se le lleva puesto lo que estaba haciendo)', () => {
    expect(clasificarError(new TypeError("Cannot read properties of undefined (reading 'titulo')"))).toBe(
      'reintentar',
    )
  })

  it('lo que no reconocemos cae en reintentar: el default seguro es NO recargar sola', () => {
    expect(clasificarError('un string suelto')).toBe('reintentar')
    expect(clasificarError(null)).toBe('reintentar')
    expect(clasificarError(undefined)).toBe('reintentar')
    expect(clasificarError({ raro: true })).toBe('reintentar')
  })
})

describe('puedeRecargarSola', () => {
  function storageFalso() {
    const datos = new Map<string, string>()
    return {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, v),
    }
  }

  it('la primera vez sí', () => {
    expect(puedeRecargarSola(storageFalso())).toBe(true)
  })

  it('🔴 la segunda NO: si la recarga no arregló, no lo metemos en un bucle', () => {
    const s = storageFalso()
    expect(puedeRecargarSola(s)).toBe(true)
    expect(puedeRecargarSola(s)).toBe(false)
    expect(puedeRecargarSola(s)).toBe(false)
  })

  it('si no se puede escribir (Safari privado) no recarga sola: no podríamos frenar el bucle', () => {
    const roto = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(puedeRecargarSola(roto)).toBe(false)
  })
})
