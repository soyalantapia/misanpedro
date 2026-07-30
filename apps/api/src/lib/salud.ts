/**
 * ¿Está sano el API? — la respuesta que mira Railway para decidir si un deploy
 * entra a servir tráfico.
 *
 * `/api/v1/health` devolvía SIEMPRE `ok: true` con HTTP 200, incluso informando
 * `db: 'disconnected'` en el mismo body. Y el arranque, a propósito, levanta el
 * server aunque la conexión falle ("failed to connect DB; starting anyway"), que
 * está bien —si se cayera el proceso quedaría en crashloop y no podría
 * reconectar— pero combinado con un health que miente da el peor resultado:
 * un deploy con la MONGODB_URI equivocada pasa el healthcheck, Railway lo marca
 * sano y lo pone a servir. Todas las rutas tocan la base, así que "sano" ahí
 * significa 100% de errores.
 *
 * Es exactamente la forma del incidente que dejó prod caída 8 minutos por un
 * deploy que necesitaba variables que no estaban cargadas.
 *
 * `readyState` de mongoose: 0 desconectado · 1 conectado · 2 conectando ·
 * 3 desconectando. Sólo 1 sirve: en 2 todavía no se puede consultar nada.
 * [cazabug loop2]
 */
export type Salud = { ok: boolean; db: 'connected' | 'disconnected'; status: 200 | 503 }

export function evaluarSalud(readyState: number): Salud {
  const conectada = readyState === 1
  return {
    ok: conectada,
    db: conectada ? 'connected' : 'disconnected',
    status: conectada ? 200 : 503,
  }
}
