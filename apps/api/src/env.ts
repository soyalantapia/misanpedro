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

  WHATSAPP_SESSIONS_DIR: z.string().default('/tmp/wa-sessions'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:')
  console.error(parsed.error.format())
  process.exit(1)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === 'production'
