import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { rateLimit, tooManyForKey, _resetRateLimits } from '@/middleware/security'

// [cazabug loop2] Los rate-limits se saltean mandando un X-Forwarded-For inventado.
//
// El proxy de borde APPENDEA la IP real al final del XFF que ya venía del cliente,
// así que el PRIMER elemento es el que puso el atacante y el ÚLTIMO es el único
// confiable. Tomando el primero, cada request cae en un bucket distinto y el freno
// no existe: se puede bombardear de códigos OTP la casilla de cualquier vecino,
// comercio u owner, y quemar la reputación del remitente SMTP.
//
// Esto afecta a los 13 limitadores de la plataforma de una sola vez, porque todos
// comparten el mismo helper `clientKey`.

const app = new Hono()
app.use('/limitado', rateLimit({ prefix: 'test-spoof', max: 3, windowMs: 60_000 }))
app.get('/limitado', (c) => c.json({ ok: true }))

async function pedir(xff: string) {
  const r = await app.request('/limitado', { headers: { 'x-forwarded-for': xff } })
  return r.status
}

const TRUST_ORIGINAL = process.env.TRUST_PROXY

beforeEach(() => {
  _resetRateLimits()
  // En producción el API corre detrás del proxy de Railway (nixpacks.toml).
  process.env.TRUST_PROXY = 'true'
})

afterEach(() => {
  if (TRUST_ORIGINAL === undefined) delete process.env.TRUST_PROXY
  else process.env.TRUST_PROXY = TRUST_ORIGINAL
})

describe('rate limit — no se puede evadir falsificando X-Forwarded-For', () => {
  it('el atacante rota el primer elemento del XFF y IGUAL lo frena', async () => {
    // El proxy real siempre agrega la misma IP al final (200.1.2.3). El atacante
    // cambia lo que él controla: el principio de la cadena.
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      statuses.push(await pedir(`1.2.3.${i}, 200.1.2.3`))
    }
    // Con max=3, a partir del cuarto tiene que cortar.
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200])
    expect(statuses.slice(3)).toEqual([429, 429, 429])
  })

  it('dos clientes REALES distintos siguen teniendo su propio cupo', async () => {
    // Mismo prefijo de cliente falsificado, pero IPs reales distintas al final:
    // son dos personas de verdad y cada una tiene sus 3.
    for (let i = 0; i < 3; i++) expect(await pedir('9.9.9.9, 200.1.2.3')).toBe(200)
    expect(await pedir('9.9.9.9, 200.1.2.3')).toBe(429)
    // Otro cliente real, cupo limpio.
    expect(await pedir('9.9.9.9, 200.1.2.4')).toBe(200)
  })

  it('un XFF de un solo elemento (sin proxy delante) se sigue tomando tal cual', async () => {
    for (let i = 0; i < 3; i++) expect(await pedir('200.1.2.5')).toBe(200)
    expect(await pedir('200.1.2.5')).toBe(429)
  })
})

describe('freno por RECURSO — protege la casilla de la víctima, no sólo al servidor', () => {
  it('aunque el atacante cambie de IP REAL, no puede bombardear el mismo email', () => {
    const victima = 'otp-user:victima@mail.com'
    // 5 permitidos (el atacante puede venir de 5 IPs distintas: da igual).
    for (let i = 0; i < 5; i++) expect(tooManyForKey(victima, 5, 60 * 60_000)).toBe(false)
    // El sexto se corta, venga de donde venga.
    expect(tooManyForKey(victima, 5, 60 * 60_000)).toBe(true)
  })

  it('otra casilla tiene su propio cupo (no castigamos a un vecino por otro)', () => {
    for (let i = 0; i < 5; i++) tooManyForKey('otp-user:uno@mail.com', 5, 60 * 60_000)
    expect(tooManyForKey('otp-user:uno@mail.com', 5, 60 * 60_000)).toBe(true)
    expect(tooManyForKey('otp-user:otro@mail.com', 5, 60 * 60_000)).toBe(false)
  })
})
