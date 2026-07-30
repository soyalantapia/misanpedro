import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clasificarError, puedeRecargarSola, type Recuperacion } from '@/lib/errorRecuperacion'

/**
 * Red de última instancia: sin esto, cualquier throw durante el render dejaba la
 * pantalla EN BLANCO — sin mensaje, sin botón, sin nada que el vecino pueda
 * hacer más que cerrar la app. Ninguna de las cuatro apps tenía una.
 *
 * El caso que más se da no es un bug raro: es deployar mientras alguien tiene la
 * app abierta. Las rutas se cargan con `lazy()`, los chunks viejos dejan de
 * existir y el próximo click a otra pestaña tira. Ver lib/errorRecuperacion.ts
 * para por qué ese caso se recarga y el resto se reintenta. [cazabug loop2]
 */

type Props = { children: ReactNode }
type State = { error: unknown | null; recuperacion: Recuperacion }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, recuperacion: 'reintentar' }

  static getDerivedStateFromError(error: unknown): State {
    return { error, recuperacion: clasificarError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Queda en la consola del dispositivo del vecino, que es lo único que
    // tenemos: estos fronts no reportan a ningún servicio.
    console.error('[error-boundary]', error, info?.componentStack)

    // Chunk viejo tras un deploy: la recarga trae el index.html nuevo con los
    // hashes nuevos (el SW está en autoUpdate + skipWaiting). Una sola vez por
    // sesión — si no arregló, mejor que lea el mensaje a que se cicle.
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
        <h1 className="text-lg font-bold text-fin-ink">
          {esChunk ? 'Actualizamos la app' : 'Se nos rompió algo'}
        </h1>
        <p className="text-sm text-fin-soft">
          {esChunk
            ? 'Salió una versión nueva mientras la tenías abierta. Recargá y seguís donde estabas.'
            : 'No pudimos mostrar esta pantalla. Podés reintentar; si sigue igual, recargá la app.'}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {!esChunk && (
            <button
              type="button"
              onClick={this.reintentar}
              className="rounded-2xl bg-fin-lime px-5 py-3 text-sm font-bold text-fin-bg transition-all hover:-translate-y-0.5"
            >
              Reintentar
            </button>
          )}
          <button
            type="button"
            onClick={this.recargar}
            className={
              esChunk
                ? 'rounded-2xl bg-fin-lime px-5 py-3 text-sm font-bold text-fin-bg transition-all hover:-translate-y-0.5'
                : 'rounded-2xl bg-fin-surface2 px-5 py-3 text-sm font-bold text-fin-ink ring-1 ring-fin-line transition-all hover:-translate-y-0.5'
            }
          >
            Recargar
          </button>
        </div>
      </div>
    )
  }
}
