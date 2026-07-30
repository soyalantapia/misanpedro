import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'

// [cazabug loop2] Los streams SSE no se soltaban NUNCA.
//
// Las dos rutas de stream (/wa/stream y /notifications/stream) tienen la misma
// forma: se suscriben al pub/sub, entran en un `while (alive)` que manda un
// heartbeat cada 25s, y llaman a `unsubscribe()` DESPUÉS del loop. La única
// forma de que `alive` pase a false es que `stream.writeSSE` tire.
//
// Pero el `write` de Hono se traga todos los errores:
//
//   async write(input) { try { await this.writer.write(input) } catch {} ; return this }
//   (hono@4.12.18/dist/utils/stream.js)
//
// O sea que el `catch { alive = false }` de las rutas es CÓDIGO MUERTO: no puede
// dispararse nunca. El loop queda girando para siempre, el `unsubscribe()` no se
// ejecuta jamás y el listener queda colgado por el resto de la vida del proceso.
//
// Y el EventSource del browser RECONECTA solo: cada bajón de señal, cada pestaña
// que se cierra, cada celular que se duerme, suma otro listener permanente y otro
// timer de 25s. Un comercio con el panel abierto en 4G los acumula todo el día.
// Después cada evento se le entrega N veces.
//
// Hono sí expone la API correcta —`stream.onAbort()` y `stream.aborted`, que en
// Node se disparan cuando el cliente corta— sólo que las rutas no la usaban.

vi.mock('@/services/jwt.service', async (orig) => {
  const real = (await orig()) as any
  return { ...real, resolveSseMerchant: () => 'merchant-fuga' }
})

let whatsappRoutes: any
let notificationsRoutes: any
let wa: any
let notif: any
const api = new Hono()

beforeAll(async () => {
  ;({ whatsappRoutes } = await import('@/routes/whatsapp'))
  ;({ notificationsRoutes } = await import('@/routes/notifications'))
  wa = await import('@/services/whatsapp.service')
  notif = await import('@/services/notifications.service')
  api.route('/wa', whatsappRoutes)
  api.route('/notifications', notificationsRoutes)
})

afterAll(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  expect(wa._listenersDe('merchant-fuga')).toBe(0)
  expect(notif._listenersDe('merchant-fuga')).toBe(0)
})

/**
 * Espera a que se cumpla una condición, con presupuesto generoso.
 *
 * El handler del stream corre en background (`streamSSE` no espera al callback),
 * así que entre el request y el `subscribe()` hay un tick que no controlamos. Con
 * la suite completa corriendo en paralelo ese tick se estira: una espera corta
 * hace que el test falle solo a veces, que es peor que no tenerlo. El presupuesto
 * es un techo, no una demora: en cuanto se cumple, sigue.
 */
async function esperarA(cond: () => boolean, queEsperaba: string) {
  const limite = Date.now() + 10_000
  while (!cond() && Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 10))
  }
  if (!cond()) throw new Error(`timeout esperando: ${queEsperaba}`)
}

/**
 * Abre el stream y espera a que el handler se haya suscrito.
 *
 * ⚠️ Que `api.request()` resuelva NO garantiza que el `subscribe()` ya haya
 * corrido: `streamSSE` lanza el callback con `run(stream, cb)` sin esperarlo, así
 * que según el orden de microtasks la respuesta puede volver antes. Medido: a
 * veces resuelve con 0 listeners. Por eso se espera un conteo ABSOLUTO en vez de
 * un delta — con deltas, una suscripción que llega tarde corre la cuenta y el
 * test falla solo a veces.
 */
async function abrirStream(esperado = 1) {
  const res = await api.request('/wa/stream?ticket=lo-que-sea')
  expect(res.status).toBe(200)
  await esperarA(
    () => wa._listenersDe('merchant-fuga') === esperado,
    `${esperado} listener(s) tras abrir`,
  )
  return res
}

/** El cliente se va: cerrar la pestaña, perder señal, dormir el celular. */
async function cortarCliente(res: Response, quedan = 0) {
  await res.body!.cancel()
  await esperarA(
    () => wa._listenersDe('merchant-fuga') === quedan,
    `que queden ${quedan} listeners`,
  )
}

describe('los streams SSE se sueltan cuando el cliente se va', () => {
  it('🔴 al cortar el cliente, el listener se libera', async () => {
    const res = await abrirStream()
    expect(wa._listenersDe('merchant-fuga')).toBe(1)

    await cortarCliente(res)

    // Sin esto el listener queda colgado por el resto de la vida del proceso.
    expect(wa._listenersDe('merchant-fuga')).toBe(0)
  })

  it('🔴 reconectar no apila listeners: el EventSource reconecta solo', async () => {
    // Cinco bajones de señal seguidos, que es lo que vive un celular en la calle.
    for (let i = 0; i < 5; i++) {
      const res = await abrirStream()
      await cortarCliente(res)
    }

    // Antes acá quedaban 5. Con un panel abierto todo el día, decenas.
    expect(wa._listenersDe('merchant-fuga')).toBe(0)
  }, 60_000)

  it('dos pestañas abiertas a la vez cuentan dos, y cada una se suelta sola', async () => {
    const a = await abrirStream(1)
    const b = await abrirStream(2)
    expect(wa._listenersDe('merchant-fuga')).toBe(2)

    await cortarCliente(a, 1)
    expect(wa._listenersDe('merchant-fuga')).toBe(1)

    await cortarCliente(b, 0)
    expect(wa._listenersDe('merchant-fuga')).toBe(0)
  })

  // Blast radius: /notifications/stream es la MISMA causa copiada. Se arregla en
  // los dos lados o el que quede afuera sigue acumulando listeners igual.
  it('🔴 /notifications/stream tiene la misma fuga y también se suelta', async () => {
    const res = await api.request('/notifications/stream?ticket=lo-que-sea')
    expect(res.status).toBe(200)
    await esperarA(() => notif._listenersDe('merchant-fuga') === 1, 'que el stream se suscriba')

    await res.body!.cancel()
    await esperarA(() => notif._listenersDe('merchant-fuga') === 0, 'que se suelte el listener')
  })
})
