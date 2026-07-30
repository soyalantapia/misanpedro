import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clasificarError, puedeRecargarSola, type Recuperacion } from '@/lib/errorRecuperacion'

/**
 * ESPEJO de `apps/web/src/components/ErrorBoundary.tsx` (mismo comportamiento,
 * estilos del panel). Sin esto, cualquier throw en render dejaba al super-admin
 * con la pantalla en blanco: ni mensaje ni salida, y este panel es justo desde
 * donde se apagan incendios. [cazabug loop2]
 */

type Props = { children: ReactNode }
type State = { error: unknown | null; recuperacion: Recuperacion }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, recuperacion: 'reintentar' }

  static getDerivedStateFromError(error: unknown): State {
    return { error, recuperacion: clasificarError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[error-boundary]', error, info?.componentStack)
    if (
      clasificarError(error) === 'recargar' &&
      typeof window !== 'undefined' &&
      puedeRecargarSola(window.sessionStorage)
    ) {
      window.location.reload()
    }
  }

  reintentar = () => this.setState({ error: null, recuperacion: 'reintentar' })
  recargar = () => window.location.reload()

  render() {
    if (!this.state.error) return this.props.children

    const esChunk = this.state.recuperacion === 'recargar'
    return (
      <div
        role="alert"
        className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <h1 className="text-lg font-bold text-neutral-900">
          {esChunk ? 'Se actualizó el panel' : 'Se rompió esta pantalla'}
        </h1>
        <p className="text-sm text-neutral-600">
          {esChunk
            ? 'Salió una versión nueva mientras lo tenías abierto. Recargá para seguir.'
            : 'No pudimos mostrarla. Reintentá; si sigue igual, recargá el panel.'}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {!esChunk && (
            <button
              type="button"
              onClick={this.reintentar}
              className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5"
            >
              Reintentar
            </button>
          )}
          <button
            type="button"
            onClick={this.recargar}
            className={
              esChunk
                ? 'rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5'
                : 'rounded-2xl bg-white px-5 py-3 text-sm font-bold text-neutral-700 ring-1 ring-neutral-200 transition-all hover:-translate-y-0.5'
            }
          >
            Recargar
          </button>
        </div>
      </div>
    )
  }
}
