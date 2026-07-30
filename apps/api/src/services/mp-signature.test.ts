import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyMpSignature, mapMpStatus } from './mp-signature'

const SECRET = 'test-secret-mp-webhook'
const NOW = Date.parse('2026-05-28T15:00:00Z')

function buildSignature(opts: {
  dataId: string
  requestId: string
  ts: number
  secret?: string
}) {
  const secret = opts.secret ?? SECRET
  const manifest = `id:${opts.dataId.toLowerCase()};request-id:${opts.requestId};ts:${opts.ts};`
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex')
  return `ts=${opts.ts},v1=${v1}`
}

describe('verifyMpSignature', () => {
  describe('política sin secret', () => {
    it('producción + sin secret → rechaza (fail-closed)', () => {
      const result = verifyMpSignature({
        signatureHeader: 'whatever',
        requestId: 'req-1',
        dataId: '123',
        secret: undefined,
        isProduction: true,
        now: NOW,
      })
      expect(result).toBe(false)
    })

    it('dev + sin secret → acepta (testing local)', () => {
      const result = verifyMpSignature({
        signatureHeader: undefined,
        requestId: undefined,
        dataId: '123',
        secret: undefined,
        isProduction: false,
        now: NOW,
      })
      expect(result).toBe(true)
    })
  })

  describe('con secret seteado', () => {
    it('firma válida + ts reciente → acepta', () => {
      const ts = NOW
      const sig = buildSignature({ dataId: '999', requestId: 'req-x', ts })
      const result = verifyMpSignature({
        signatureHeader: sig,
        requestId: 'req-x',
        dataId: '999',
        secret: SECRET,
        isProduction: true,
        now: NOW,
      })
      expect(result).toBe(true)
    })

    it('firma con secret incorrecto → rechaza', () => {
      const ts = NOW
      const sig = buildSignature({
        dataId: '999',
        requestId: 'req-x',
        ts,
        secret: 'otro-secret-distinto',
      })
      const result = verifyMpSignature({
        signatureHeader: sig,
        requestId: 'req-x',
        dataId: '999',
        secret: SECRET,
        isProduction: true,
        now: NOW,
      })
      expect(result).toBe(false)
    })

    it('timestamp viejo (>5 min) → rechaza (anti-replay)', () => {
      const ts = NOW - 6 * 60 * 1000 // 6 min atrás
      const sig = buildSignature({ dataId: '999', requestId: 'req-x', ts })
      const result = verifyMpSignature({
        signatureHeader: sig,
        requestId: 'req-x',
        dataId: '999',
        secret: SECRET,
        isProduction: true,
        now: NOW,
      })
      expect(result).toBe(false)
    })

    it('timestamp futuro (>5 min) → rechaza', () => {
      const ts = NOW + 10 * 60 * 1000 // 10 min en el futuro
      const sig = buildSignature({ dataId: '999', requestId: 'req-x', ts })
      const result = verifyMpSignature({
        signatureHeader: sig,
        requestId: 'req-x',
        dataId: '999',
        secret: SECRET,
        isProduction: true,
        now: NOW,
      })
      expect(result).toBe(false)
    })

    it('falta requestId → rechaza', () => {
      const ts = NOW
      const sig = buildSignature({ dataId: '999', requestId: 'req-x', ts })
      const result = verifyMpSignature({
        signatureHeader: sig,
        requestId: undefined,
        dataId: '999',
        secret: SECRET,
        isProduction: true,
        now: NOW,
      })
      expect(result).toBe(false)
    })

    it('header malformado (sin v1) → rechaza', () => {
      const result = verifyMpSignature({
        signatureHeader: `ts=${NOW}`,
        requestId: 'req-x',
        dataId: '999',
        secret: SECRET,
        isProduction: true,
        now: NOW,
      })
      expect(result).toBe(false)
    })

    it('dataId distinto al firmado → rechaza (manipulación)', () => {
      const ts = NOW
      const sig = buildSignature({ dataId: '999', requestId: 'req-x', ts })
      const result = verifyMpSignature({
        signatureHeader: sig,
        requestId: 'req-x',
        dataId: '888', // dataId distinto al firmado
        secret: SECRET,
        isProduction: true,
        now: NOW,
      })
      expect(result).toBe(false)
    })

    it('dataId case-insensitive (MP a veces manda mayúsculas)', () => {
      const ts = NOW
      const sig = buildSignature({ dataId: 'ABC123', requestId: 'req-x', ts })
      const result = verifyMpSignature({
        signatureHeader: sig,
        requestId: 'req-x',
        dataId: 'abc123',
        secret: SECRET,
        isProduction: true,
        now: NOW,
      })
      expect(result).toBe(true)
    })
  })
})

describe('mapMpStatus', () => {
  it('mapea status conocidos de MP', () => {
    expect(mapMpStatus('authorized')).toBe('authorized')
    expect(mapMpStatus('paused')).toBe('paused')
    expect(mapMpStatus('cancelled')).toBe('cancelled')
    expect(mapMpStatus('rejected')).toBe('rejected')
  })

  it('status desconocido → pending (defensivo)', () => {
    expect(mapMpStatus('foo')).toBe('pending')
    expect(mapMpStatus('')).toBe('pending')
    expect(mapMpStatus('PROCESSING')).toBe('pending')
  })
})

// [cazabug loop2] El `ts` de Mercado Pago venía en dos unidades distintas.
//
// La verificación compara `ts` contra `Date.now()` —milisegundos— con ventana de
// 5 minutos. Pero los propios docs de MP muestran los dos formatos:
//
//   · ARG  ts=1704908010      → 10/01/2024 leído como SEGUNDOS (como ms sería 1970)
//   · BR   ts=1742505638683   → 20/03/2025 leído como MILISEGUNDOS (como s, absurdo)
//
// Con un `ts` en segundos, |Date.now() - ts| da ~1.78e12 ms: siempre fuera de la
// ventana. O sea 401 a TODO webhook, y ninguna suscripción se activaría nunca.
// El test viejo no podía detectarlo porque construía la firma con ts en
// milisegundos, la misma suposición que el código.
//
// No se elige una unidad: se aceptan las dos. La magnitud desambigua sin lugar a
// duda (1e11 segundos = año 5138; 1e11 ms = 1973), y no debilita el anti-replay,
// porque un ts viejo sigue quedando fuera de la ventana en cualquiera de las dos.
describe('unidad del ts (segundos vs milisegundos)', () => {
  const REQ = 'req-unidad'
  const DATA_ID = 'PRE-UNIDAD'

  function firmar(ts: number) {
    const manifest = `id:${DATA_ID.toLowerCase()};request-id:${REQ};ts:${ts};`
    return `ts=${ts},v1=${createHmac('sha256', SECRET).update(manifest).digest('hex')}`
  }

  it('🔴 acepta el ts en SEGUNDOS, que es como lo documenta MP en ARG', () => {
    const tsSegundos = Math.floor(NOW / 1000)
    expect(
      verifyMpSignature({
        signatureHeader: firmar(tsSegundos),
        requestId: REQ,
        dataId: DATA_ID,
        secret: SECRET,
        isProduction: true,
        now: NOW,
      }),
    ).toBe(true)
  })

  it('sigue aceptando el ts en MILISEGUNDOS, que es como lo documenta MP en BR', () => {
    expect(
      verifyMpSignature({
        signatureHeader: firmar(NOW),
        requestId: REQ,
        dataId: DATA_ID,
        secret: SECRET,
        isProduction: true,
        now: NOW,
      }),
    ).toBe(true)
  })

  it('el anti-replay sigue vivo en segundos: uno de hace una hora se rechaza', () => {
    const haceUnaHora = Math.floor((NOW - 60 * 60 * 1000) / 1000)
    expect(
      verifyMpSignature({
        signatureHeader: firmar(haceUnaHora),
        requestId: REQ,
        dataId: DATA_ID,
        secret: SECRET,
        isProduction: true,
        now: NOW,
      }),
    ).toBe(false)
  })

  it('el anti-replay sigue vivo en milisegundos', () => {
    expect(
      verifyMpSignature({
        signatureHeader: firmar(NOW - 60 * 60 * 1000),
        requestId: REQ,
        dataId: DATA_ID,
        secret: SECRET,
        isProduction: true,
        now: NOW,
      }),
    ).toBe(false)
  })

  it('un ts futuro tampoco pasa, en ninguna de las dos unidades', () => {
    expect(
      verifyMpSignature({
        signatureHeader: firmar(Math.floor((NOW + 60 * 60 * 1000) / 1000)),
        requestId: REQ, dataId: DATA_ID, secret: SECRET, isProduction: true, now: NOW,
      }),
    ).toBe(false)
    expect(
      verifyMpSignature({
        signatureHeader: firmar(NOW + 60 * 60 * 1000),
        requestId: REQ, dataId: DATA_ID, secret: SECRET, isProduction: true, now: NOW,
      }),
    ).toBe(false)
  })
})
