import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'

// [cazabug loop2] Sin ErrorBoundary, un throw en render dejaba la pantalla EN
// BLANCO: ni mensaje ni botón. Este test parte de ahí — primero comprueba que un
// componente que tira efectivamente no pinta NADA, y después que envuelto en el
// boundary el vecino recibe algo con lo que salir adelante.

function Explota({ error }: { error: unknown }): never {
  throw error
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  // React loguea el error capturado; lo silenciamos para no ensuciar la salida.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  sessionStorage.clear()
})

afterEach(() => {
  consoleError.mockRestore()
  vi.unstubAllGlobals()
})

describe('ErrorBoundary', () => {
  it('🔴 sin boundary, un throw en render no deja NADA en pantalla', () => {
    // La demostración del bug: React desmonta todo el árbol y queda el body vacío.
    expect(() =>
      render(<Explota error={new TypeError("Cannot read properties of undefined")} />),
    ).toThrow()
  })

  it('un bug de render deja al vecino con mensaje y con salida', () => {
    render(
      <ErrorBoundary>
        <Explota error={new TypeError("Cannot read properties of undefined (reading 'titulo')")} />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Se nos rompió algo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy()
  })

  it('🔴 chunk viejo tras un deploy: lo dice y ofrece recargar, no "reintentar"', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    render(
      <ErrorBoundary>
        <Explota error={new TypeError('Failed to fetch dynamically imported module: /assets/x-a1b2.js')} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Actualizamos la app')).toBeTruthy()
    // Reintentar re-renderiza el mismo módulo que no existe: no serviría de nada.
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy()
    // Y se recarga sola una vez, que es lo que realmente lo arregla.
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('🔴 no se recarga sola dos veces: sin candado sería un bucle sin salida', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const chunkErr = new TypeError('Failed to fetch dynamically imported module')

    render(
      <ErrorBoundary>
        <Explota error={chunkErr} />
      </ErrorBoundary>,
    )
    render(
      <ErrorBoundary>
        <Explota error={chunkErr} />
      </ErrorBoundary>,
    )

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('un bug común NO recarga sola: no se lleva puesto lo que el vecino estaba haciendo', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    render(
      <ErrorBoundary>
        <Explota error={new Error('boom')} />
      </ErrorBoundary>,
    )
    expect(reload).not.toHaveBeenCalled()
  })

  it('Reintentar vuelve a montar: si el error fue pasajero, se recupera solo', async () => {
    let deboFallar = true
    function AVeces() {
      if (deboFallar) throw new Error('falla la primera vez')
      return <p>Contenido</p>
    }

    render(
      <ErrorBoundary>
        <AVeces />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()

    deboFallar = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(screen.getByText('Contenido')).toBeTruthy()
  })

  it('sin error, no se mete en el medio', () => {
    render(
      <ErrorBoundary>
        <p>Todo bien</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Todo bien')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
