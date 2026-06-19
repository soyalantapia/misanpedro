import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  MONGODB_URI: z.string().url().or(z.string().startsWith('mongodb')),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  APP_URL_FRONT: z.string().url().default('http://localhost:5180'),
  APP_URL_API: z.string().url().default('http://localhost:3001'),

  MP_ACCESS_TOKEN: z.string().optional(),
  MP_PUBLIC_KEY: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Mi San Pedro <onboarding@resend.dev>'),

  SENTRY_DSN: z.string().optional(),

  // Web Push (VAPID). Si faltan las claves, el push queda en no-op.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:soporte@misanpedro.app'),

  WHATSAPP_SESSIONS_DIR: z.string().default('/tmp/wa-sessions'),

  /** Plan mensual en ARS — precio FINAL al comercio (monotributo emite factura C sin IVA discriminado). NO sumar IVA encima. */
  PLAN_AMOUNT_ARS: z.coerce.number().default(50_000),

  /** Email de soporte (visible en TyC y panel ayuda). */
  SUPPORT_EMAIL: z.string().default('soporte@misanpedro.app'),
  /** WhatsApp de soporte (link wa.me). */
  SUPPORT_WHATSAPP: z.string().default('+5493329000000'),

  /**
   * Token para el panel super admin (vos como dueño). Setear con:
   *   openssl rand -base64 48
   * Si no está setado o tiene <16 chars, los endpoints /admin devuelven 503.
   */
  SUPER_ADMIN_TOKEN: z.string().default(''),

  // CORS: lista coma-separada de orígenes adicionales permitidos.
  // APP_URL_FRONT siempre se incluye automáticamente.
  CORS_ORIGINS: z.string().default(''),

  // Trust proxy (X-Forwarded-Proto / X-Forwarded-For). En Railway, Render,
  // Heroku setear a 'true'. Local: 'false'.
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  /**
   * Si true, el flujo de login del Owner Panel exige TOTP (2FA con QR).
   * Si false (default), el primer login emite tokens directo con email + password.
   * Recomendado activar antes de exponer el Owner Panel en prod.
   *
   * Cambiar a 'true' en prod cuando estés listo para escanear el QR.
   */
  OWNER_2FA_REQUIRED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  /**
   * Bootstrap ONE-TIME del Owner (super-admin) en prod. La DB de prod es INTERNA
   * de Railway → no se puede crear el owner desde local. Seteá estas dos vars en
   * Railway: al arrancar, si no existe un Owner con ese email, lo crea (idempotente).
   * DESPUÉS borrá OWNER_BOOTSTRAP_PASSWORD del env por seguridad.
   */
  OWNER_BOOTSTRAP_EMAIL: z.string().email().optional(),
  OWNER_BOOTSTRAP_PASSWORD: z.string().optional(),
  OWNER_BOOTSTRAP_NOMBRE: z.string().min(1).default('Owner'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:')
  console.error(parsed.error.format())
  process.exit(1)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === 'production'
