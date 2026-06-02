/**
 * Setup global para tests del API.
 *
 * Mockea env vars que el código importa al cargar. Si no se setean acá,
 * los imports de `@/env` van a fallar con "MONGODB_URI is required".
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test'
process.env.PORT = process.env.PORT ?? '3001'
process.env.MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/misanpedro-test'
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-jwt-secret-32-chars-minimum-padding-padding'
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ??
  'test-jwt-refresh-secret-32-chars-minimum-padding-padding'
process.env.APP_URL_FRONT = process.env.APP_URL_FRONT ?? 'http://localhost:5180'
process.env.APP_URL_API = process.env.APP_URL_API ?? 'http://localhost:3001'
process.env.PLAN_AMOUNT_ARS = process.env.PLAN_AMOUNT_ARS ?? '50000'
