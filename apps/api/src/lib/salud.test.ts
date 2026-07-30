import { describe, it, expect } from 'vitest'
import { evaluarSalud } from './salud'

// [cazabug loop2] El healthcheck le mentía a Railway.
//
// `/api/v1/health` (el path que usa railway.json) devolvía SIEMPRE `ok: true` con
// HTTP 200, aun reportando `db: 'disconnected'` en el mismo body. Como el arranque
// levanta el server igual si la conexión falla, un deploy con la MONGODB_URI
// equivocada pasaba el healthcheck y entraba a servir tráfico — con todas las
// rutas fallando, porque todas tocan la base.

describe('evaluarSalud', () => {
  it('🔴 con la base caída NO responde 200: el deploy no debe entrar a servir', () => {
    expect(evaluarSalud(0)).toEqual({ ok: false, db: 'disconnected', status: 503 })
  })

  it('conectada responde sano', () => {
    expect(evaluarSalud(1)).toEqual({ ok: true, db: 'connected', status: 200 })
  })

  it('🔴 "conectando" todavía no es sano: no se puede consultar nada en ese estado', () => {
    expect(evaluarSalud(2).ok).toBe(false)
    expect(evaluarSalud(2).status).toBe(503)
  })

  it('desconectándose tampoco es sano', () => {
    expect(evaluarSalud(3).ok).toBe(false)
  })

  it('un readyState desconocido se trata como NO sano, no como sano por defecto', () => {
    expect(evaluarSalud(99).ok).toBe(false)
    expect(evaluarSalud(-1).ok).toBe(false)
  })
})
