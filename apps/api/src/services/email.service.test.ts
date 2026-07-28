import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * [cazabug] El código OTP se filtraba a los logs de PRODUCCIÓN por una vía que
 * el fix anterior ("el OTP no va a los logs de prod", gateado por
 * `otpDisclosureAllowed()`) no cubría: el `subject` de los mails de OTP trae el
 * código en texto plano (ej. "Tu código Mi Ciudad: 483920"), y DOS lugares de
 * `sendEmail()` lo logueaban crudo, sin pasar por ese gate:
 *   1) "sin transporte configurado en producción" (console.error) — el reportado.
 *   2) el stub de dev (console.log) — más riesgoso de lo que parece EN ESTE
 *      REPO puntual: el .env local apunta al MISMO Atlas que prod, así que
 *      "NODE_ENV no dice production" no alcanza para asumir que es una laptop.
 *
 * Este archivo prueba que ninguno de los dos vuelve a filtrar el código, y que
 * el `logLabel` (etiqueta segura) sí aparece en su lugar.
 *
 * Truco de módulos: `@/env` se re-mockea con `vi.doMock` + `vi.resetModules()`
 * ANTES de cada `import()` dinámico de `email.service`, porque `isProd` se
 * calcula una sola vez al cargar `@/env` — no hay forma de cambiarlo después de
 * importado. `process.env.MONGODB_URI` (la env var REAL, no la mockeada) se
 * pisa aparte porque `isLocalDb()` la lee directo con prioridad sobre `env.*`.
 */

const ORIGINAL_MONGODB_URI = process.env.MONGODB_URI

async function loadEmailServiceWith(opts: {
  isProd: boolean
  NODE_ENV?: string
  mongodbUri?: string
}) {
  vi.resetModules()
  process.env.MONGODB_URI = opts.mongodbUri ?? ORIGINAL_MONGODB_URI
  vi.doMock('@/env', () => ({
    isProd: opts.isProd,
    env: {
      NODE_ENV: opts.NODE_ENV ?? (opts.isProd ? 'production' : 'development'),
      SMTP_HOST: undefined,
      SMTP_PORT: 465,
      SMTP_USER: undefined,
      SMTP_PASSWORD: undefined,
      SMTP_SECURE: true,
      RESEND_API_KEY: undefined,
      EMAIL_FROM: 'Mi Ciudad <no-reply@micuidad.com>',
      SUPPORT_EMAIL: 'soporte@micuidad.com',
      APP_URL_FRONT: 'http://localhost:5180',
      MONGODB_URI: opts.mongodbUri ?? ORIGINAL_MONGODB_URI,
    },
  }))
  return import('@/services/email.service')
}

afterEach(() => {
  vi.restoreAllMocks()
  process.env.MONGODB_URI = ORIGINAL_MONGODB_URI
})

describe('email.service — sin transporte en PRODUCCIÓN: nunca el subject crudo', () => {
  it('OTP del vecino: loguea el logLabel ("otp/vecino"), nunca el código', async () => {
    const { sendOtpCode } = await loadEmailServiceWith({ isProd: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await sendOtpCode('vecino@mail.com', '741852', 'Mi Ciudad')
    const logged = spy.mock.calls.map((args) => args.join(' ')).join('\n')
    expect(logged).not.toContain('741852')
    expect(logged).toContain('otp/vecino')
  })

  it('OTP del owner: loguea el logLabel ("otp/owner"), nunca el código', async () => {
    const { sendOwnerOtpCode } = await loadEmailServiceWith({ isProd: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await sendOwnerOtpCode('owner@mail.com', '963258')
    const logged = spy.mock.calls.map((args) => args.join(' ')).join('\n')
    expect(logged).not.toContain('963258')
    expect(logged).toContain('otp/owner')
  })

  it('OTP del comercio: loguea el logLabel ("otp/comercio"), nunca el código', async () => {
    const { sendMerchantOtpCode } = await loadEmailServiceWith({ isProd: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await sendMerchantOtpCode('dueno@comercio.com', '159357', 'Mi Ciudad')
    const logged = spy.mock.calls.map((args) => args.join(' ')).join('\n')
    expect(logged).not.toContain('159357')
    expect(logged).toContain('otp/comercio')
  })

  it('mail SIN logLabel (no sensible): cae a un genérico, nunca el subject', async () => {
    const { sendEmail } = await loadEmailServiceWith({ isProd: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await sendEmail({ to: 'vecino@mail.com', subject: 'Tu código secreto 246810', html: '<p>hola</p>' })
    const logged = spy.mock.calls.map((args) => args.join(' ')).join('\n')
    expect(logged).not.toContain('246810')
    expect(logged).toContain('email/generico')
  })
})

describe('email.service — stub de dev: mismo criterio que el debugCode de las rutas', () => {
  it('deploy sin NODE_ENV=production pero con Mongo REMOTA: el stub tampoco filtra el código', async () => {
    // Simula justo el escenario que describe envSafety.ts: NODE_ENV no dice
    // "production" (se olvidaron de setearlo), pero la base NO es local — no es
    // una laptop de desarrollo.
    const { sendOtpCode } = await loadEmailServiceWith({
      isProd: false,
      NODE_ENV: 'development',
      mongodbUri: 'mongodb+srv://prod-cluster.mongodb.net/misanpedro',
    })
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await sendOtpCode('vecino@mail.com', '135790', 'Mi Ciudad')
    const logged = spy.mock.calls.map((args) => args.join(' ')).join('\n')
    expect(logged).not.toContain('135790')
    expect(logged).toContain('otp/vecino')
  })

  it('dev LOCAL de verdad (Mongo localhost): el stub SÍ puede mostrar el código para testear a mano', async () => {
    const { sendOtpCode } = await loadEmailServiceWith({
      isProd: false,
      NODE_ENV: 'development',
      mongodbUri: 'mongodb://127.0.0.1:27017/misanpedro-dev',
    })
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await sendOtpCode('vecino@mail.com', '246801', 'Mi Ciudad')
    const logged = spy.mock.calls.map((args) => args.join(' ')).join('\n')
    expect(logged).toContain('246801')
  })
})
