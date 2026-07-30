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

/** Abre el stream y espera a que el handler haya llegado a suscribirse. */
async function abrirStream() {
  const res = await api.request('/wa/stream?ticket=lo-que-sea')
  expect(res.status).toBe(200)
  for (let i = 0; i < 50 && wa._listenersDe('merchant-fuga') === 0; i++) {
    await new Promise((r) => setTimeout(r, 10))
  }
  return res
}

/** El cliente se va: cerrar la pestaña, perder señal, dormir el celular. */
async function cortarCliente(res: Response) {
  await res.body!.cancel()
  for (let i = 0; i < 50 && wa._listenersDe('merchant-fuga') > 0; i++) {
    await new Promise((r) => setTimeout(r, 10))
  }
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
  })

  it('dos pestañas abiertas a la vez cuentan dos, y cada una se suelta sola', async () => {
    const a = await api.request('/wa/stream?ticket=t1')
    const b = await api.request('/wa/stream?ticket=t2')
    for (let i = 0; i < 50 && wa._listenersDe('merchant-fuga') < 2; i++) {
      await new Promise((r) => setTimeout(r, 10))
    }
    expect(wa._listenersDe('merchant-fuga')).toBe(2)

    await cortarCliente(a)
    expect(wa._listenersDe('merchant-fuga')).toBe(1)

    await cortarCliente(b)
    expect(wa._listenersDe('merchant-fuga')).toBe(0)
  })

  // Blast radius: /notifications/stream es la MISMA causa copiada. Se arregla en
  // los dos lados o el que quede afuera sigue acumulando listeners igual.
  it('🔴 /notifications/stream tiene la misma fuga y también se suelta', async () => {
    const res = await api.request('/notifications/stream?ticket=lo-que-sea')
    expect(res.status).toBe(200)
    for (let i = 0; i < 50 && notif._listenersDe('merchant-fuga') === 0; i++) {
      await new Promise((r) => setTimeout(r, 10))
    }
    expect(notif._listenersDe('merchant-fuga')).toBe(1)

    await res.body!.cancel()
    for (let i = 0; i < 50 && notif._listenersDe('merchant-fuga') > 0; i++) {
      await new Promise((r) => setTimeout(r, 10))
    }
    expect(notif._listenersDe('merchant-fuga')).toBe(0)
  })
})
