import { describe, it, expect } from 'vitest'
import * as wa from '@/services/whatsapp.service'
import * as notif from '@/services/notifications.service'

// [cazabug loop2] Un `unsubscribe()` llamado dos veces mataba la suscripción DE OTRO.
//
// El closure que devuelve `subscribe()` cierra sobre el Set del momento:
//
//   return () => { set.delete(listener); if (set.size === 0) listeners.delete(id) }
//
// Cuando el último listener se va, la entrada del mapa se borra. Si después alguien
// reconecta, se crea un Set NUEVO. Pero el closure viejo sigue apuntando al Set
// viejo: al llamarlo de nuevo ve `size === 0` —siempre va a verlo, está vacío— y
// ejecuta `listeners.delete(id)`, que borra del mapa el Set del que reconectó.
//
// El efecto es feo y silencioso: la conexión nueva queda abierta, mandando
// heartbeats, pero no recibe NINGÚN evento. Al comercio no le aparece el QR ni le
// cambia el estado de WhatsApp, y no hay nada que falle.
//
// Se volvió alcanzable al arreglar la fuga de SSE: ahora `unsubscribe()` corre en
// `onAbort` y otra vez al salir del loop del heartbeat (hasta 25s después). Antes
// no corría nunca, así que el segundo llamado no existía. El arreglo no es llamar
// una sola vez —cualquier llamador podría repetir— sino que el closure no pueda
// pisar a un tercero.

describe('el unsubscribe de un stream muerto no puede pisar al que reconectó', () => {
  it('🔴 wa: llamarlo dos veces no deja sin suscripción al nuevo', () => {
    const soltarA = wa.subscribe('m-doble', () => {})
    expect(wa._listenersDe('m-doble')).toBe(1)

    soltarA() // el cliente A corta → onAbort
    expect(wa._listenersDe('m-doble')).toBe(0)

    const soltarB = wa.subscribe('m-doble', () => {}) // reconecta: Set nuevo
    expect(wa._listenersDe('m-doble')).toBe(1)

    soltarA() // el loop del heartbeat de A despierta y vuelve a llamar

    // Sin el fix acá quedaba 0: B seguía conectado pero sin recibir nada.
    expect(wa._listenersDe('m-doble')).toBe(1)

    soltarB()
    expect(wa._listenersDe('m-doble')).toBe(0)
  })

  it('🔴 notifications: la misma causa copiada', () => {
    const soltarA = notif.subscribe('m-doble', () => {})
    soltarA()
    const soltarB = notif.subscribe('m-doble', () => {})
    soltarA()

    expect(notif._listenersDe('m-doble')).toBe(1)
    soltarB()
    expect(notif._listenersDe('m-doble')).toBe(0)
  })

  it('llamarlo dos veces seguidas, sin nadie en el medio, es inocuo', () => {
    const soltar = wa.subscribe('m-idem', () => {})
    soltar()
    soltar()
    expect(wa._listenersDe('m-idem')).toBe(0)
  })

  it('con dos conectados, soltar a uno no se lleva al otro', () => {
    const a = wa.subscribe('m-dos', () => {})
    const b = wa.subscribe('m-dos', () => {})
    expect(wa._listenersDe('m-dos')).toBe(2)

    a()
    a() // y aunque el viejo insista
    expect(wa._listenersDe('m-dos')).toBe(1)

    b()
    expect(wa._listenersDe('m-dos')).toBe(0)
  })
})
