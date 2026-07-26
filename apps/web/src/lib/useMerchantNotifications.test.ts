import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadStored,
  persistNotif,
  notifStorageKey,
  type MerchantNotifEvent,
} from './useMerchantNotifications'

// [cazabug S10-01 · P1] El historial de notificaciones del comercio (con PII de
// clientes: canjes) se guardaba bajo una key GLOBAL de localStorage. En un
// dispositivo compartido, el comercio B veía las notificaciones del comercio A.
// El fix scopea la key por merchantId y borra el bucket global viejo.

const ev = (id: string): MerchantNotifEvent => ({
  id,
  type: 'redemption.created',
  occurredAt: '2026-01-01T00:00:00Z',
  receivedAt: 0,
  read: false,
  payload: { cliente: 'PII' },
})

describe('useMerchantNotifications — aislamiento de PII por comercio', () => {
  beforeEach(() => localStorage.clear())

  it('el bucket de un comercio NO es legible por otro en el mismo browser', () => {
    persistNotif('comercioA', [ev('a1'), ev('a2')])
    expect(loadStored('comercioA').map((e) => e.id)).toEqual(['a1', 'a2'])
    // El comercio B, en el mismo browser, NO hereda nada de A.
    expect(loadStored('comercioB')).toEqual([])
  })

  it('la key GLOBAL vieja (con PII) se borra al cargar y no se sirve a ningún comercio', () => {
    localStorage.setItem('misanpedro.merchant.notif.v1', JSON.stringify([ev('leak')]))
    expect(loadStored('comercioB')).toEqual([])
    expect(localStorage.getItem('misanpedro.merchant.notif.v1')).toBeNull()
  })

  it('sin merchantId no lee ni persiste', () => {
    persistNotif(null, [ev('x')])
    expect(localStorage.length).toBe(0)
    expect(loadStored(null)).toEqual([])
  })

  it('la key queda scopeada por merchantId', () => {
    expect(notifStorageKey('comercioA')).toBe('misanpedro.merchant.notif.v1.comercioA')
  })
})
