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
