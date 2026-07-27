# Login del vecino por email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el P0 S1-01 — que nadie pueda entrar a la cuenta de otro vecino sabiendo un dato público — moviendo la identidad del vecino del teléfono al email, sin agregarle fricción al alta en el mostrador.

**Architecture:** El alta sigue sin pedir código: si el email es nuevo, el vecino entra al instante. El código de 6 dígitos aparece **sólo** cuando el email ya tiene cuenta (el caso "me cambié de celular"), en la misma pantalla. La sesión pasa de un token irrevocable de 10 años a un par access (1h, se renueva solo) + refresh que no vence pero **sí se puede revocar**. Todo el patrón OTP y de refresh ya existe en `merchant-auth.ts`: esto es reusar, no inventar.

**Tech Stack:** Hono · Mongoose · Zod · vitest + mongodb-memory-server (backend) · React 19 + Vite + vitest/jsdom (front) · monorepo pnpm + turbo.

## Global Constraints

- **Worktree:** `/Users/alannaimtapia/dev/misanpedro-cazabug`, rama `cazabug/loop1-iso`. NO trabajar en `/Users/alannaimtapia/dev/misanpedro` (lo comparten otras sesiones).
- **Node 22:** cada shell arranca con `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.
- **La Mongo del `.env` es la MISMA de producción.** Ningún test ni script toca esa base: los tests usan `mongodb-memory-server` (aislada, in-memory) y nunca cargan el `.env`.
- **Gate antes de cada commit:** `pnpm --filter @misanpedro/api test` · `pnpm --filter @misanpedro/web test` · `pnpm typecheck` (6 paquetes) · `pnpm check:tenant`.
- **Commits selectivos por path.** Nunca `git add -A` ni `git add .`.
- **Idioma:** todo el texto que ve el vecino, en español rioplatense. Comentarios de código en español, explicando el *por qué*.
- **TDD estricto:** el test se escribe primero y hay un paso explícito para verlo FALLAR. Un test que pasa antes del fix no prueba nada.

---

## File Structure

**Contrato compartido (fuente de verdad FE/BE)**
- `packages/shared/src/types.ts` — `User.email` pasa a obligatorio.
- `packages/shared/src/schemas.ts` — `userClaimSchema` (+email), `userOtpRequestSchema`, `userOtpVerifySchema` (nuevos).

**Backend**
- `apps/api/src/models/User.ts` — email required + único por ciudad; teléfono deja de ser único.
- `apps/api/src/routes/user-auth.ts` — el archivo que concentra todo el cambio: `/claim` reescrito + 6 endpoints nuevos.
- `apps/api/src/routes/user-auth.integration.test.ts` *(nuevo)* — toda la regresión del flujo.
- `apps/api/scripts/migrate-vecinos-email.ts` *(nuevo)* — borra las 4 cuentas de prueba.

**Front**
- `apps/web/src/lib/validations/claim.ts` *(nuevo)* — validación pura del formulario (sin React → testeable).
- `apps/web/src/lib/validations/claim.test.ts` *(nuevo)*.
- `apps/web/src/lib/api.ts` — `userApi`: claim con email, requestOtp, verifyOtp, logout, logoutAll, sessions.
- `apps/web/src/pages/RegistroPage.tsx` — campo email + paso del código en la misma pantalla.
- `apps/web/src/pages/PerfilPage.tsx` — "Entrar desde mi cuenta" + "Cerrar sesión en todos lados".

---

### Task 1: Identidad = email (contrato + modelo)

**Files:**
- Modify: `packages/shared/src/types.ts:165-177`
- Modify: `packages/shared/src/schemas.ts` (bloque `userClaimSchema`)
- Modify: `apps/api/src/models/User.ts`
- Test: `apps/api/src/models/userIdentity.integration.test.ts` *(crear)*

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: `userClaimSchema` con forma `{ nombre: string; email: string; telefono: string; acceptedTc: true }`; `userOtpRequestSchema` `{ email: string }`; `userOtpVerifySchema` `{ email: string; code: string }`. Índice único `{appId, email}` en `users`.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/src/models/userIdentity.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { User } from '@/models'

// [cazabug S1-01] La identidad del vecino pasa del TELÉFONO al EMAIL. El email
// es único por ciudad (dos vecinos no pueden compartirlo) y el teléfono deja de
// ser único (una familia puede compartir un celular).

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const otroAppId = new Types.ObjectId()

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await User.syncIndexes()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await User.deleteMany({})
})

describe('User — identidad por email', () => {
  it('el email es obligatorio', async () => {
    await expect(
      User.create({ appId, nombre: 'Sin Mail', telefono: '3329421234' }),
    ).rejects.toThrow()
  })

  it('dos vecinos de la MISMA ciudad no pueden compartir email', async () => {
    await User.create({ appId, nombre: 'Ana', email: 'ana@mail.com', telefono: '3329421234' })
    await expect(
      User.create({ appId, nombre: 'Otra Ana', email: 'ana@mail.com', telefono: '3329999999' }),
    ).rejects.toMatchObject({ code: 11000 })
  })

  it('el MISMO email puede existir en otra ciudad', async () => {
    await User.create({ appId, nombre: 'Ana', email: 'ana@mail.com', telefono: '3329421234' })
    const otra = await User.create({
      appId: otroAppId,
      nombre: 'Ana',
      email: 'ana@mail.com',
      telefono: '3329421234',
    })
    expect(otra._id).toBeDefined()
  })

  it('dos vecinos SÍ pueden compartir el teléfono (ya no es la identidad)', async () => {
    await User.create({ appId, nombre: 'Mamá', email: 'mama@mail.com', telefono: '3329421234' })
    const hijo = await User.create({
      appId,
      nombre: 'Hijo',
      email: 'hijo@mail.com',
      telefono: '3329421234',
    })
    expect(hijo._id).toBeDefined()
  })

  it('el email se guarda en minúsculas', async () => {
    const u = await User.create({
      appId,
      nombre: 'Ana',
      email: '  ANA@Mail.COM  ',
      telefono: '3329421234',
    })
    expect(u.email).toBe('ana@mail.com')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que FALLA**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api exec vitest run src/models/userIdentity.integration.test.ts
```

Esperado: fallan al menos 3 casos — "el email es obligatorio" (hoy se crea igual), "no pueden compartir email" (no hay índice único) y "SÍ pueden compartir el teléfono" (hoy el único es `{appId,telefono}` y tira 11000).

- [ ] **Step 3: Cambiar el modelo `User`**

En `apps/api/src/models/User.ts`, reemplazar los campos y los índices:

```ts
    /** La identidad del vecino es el EMAIL: es lo único que puede probar que la
     *  cuenta es suya (le llega un código). El teléfono NO sirve como identidad
     *  porque es público y adivinable. [cazabug S1-01] */
    email: { type: String, required: true, lowercase: true, trim: true },
    /** Dato de CONTACTO (campañas de WhatsApp del comercio), ya no identidad. */
    telefono: { type: String, required: true },
```

Y reemplazar el bloque de índices existente por:

```ts
// Identidad = (ciudad, email), único. El mismo email puede ser vecino en dos
// ciudades distintas sin colisionar.
userSchema.index({ appId: 1, email: 1 }, { unique: true })
// El teléfono se busca (destinatarios de campañas) pero NO es único: una familia
// puede compartir un celular. Antes era el índice de identidad. [cazabug S1-01]
userSchema.index({ appId: 1, telefono: 1 })
```

- [ ] **Step 4: Correr el test y verificar que PASA**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api exec vitest run src/models/userIdentity.integration.test.ts
```

Esperado: `Tests 5 passed (5)`.

- [ ] **Step 5: Actualizar el tipo compartido**

En `packages/shared/src/types.ts:165`, reemplazar el bloque `User`:

```ts
export type User = {
  id: string
  nombre: string
  /** El EMAIL es la identidad del vecino: es lo que puede verificar. */
  email: string
  /** Dato de contacto para las campañas de WhatsApp del comercio. */
  telefono: string
  // ─── Legacy / opcionales (cuentas viejas) ───
  dni?: string
  whatsapp?: string
  fechaNacimiento?: string
  acceptedTcAt?: string
  createdAt?: string
}
```

- [ ] **Step 6: Actualizar los schemas Zod**

En `packages/shared/src/schemas.ts`, reemplazar `userClaimSchema` por:

```ts
/** Alta del vecino: nombre + email + teléfono. NO pide código: crear la cuenta
 *  propia no ataca a nadie. El código aparece sólo si el email YA existe (ver
 *  POST /auth/claim). [cazabug S1-01] */
export const userClaimSchema = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  email: z.string().trim().toLowerCase().email('Poné un email válido'),
  // Se valida en CRUDO y la normalización canónica la hace el backend, que es el
  // único que conoce el país del tenant. [cazabug S1-02]
  telefono: z
    .string()
    .refine((s) => {
      const d = s.replace(/\D/g, '')
      return d.length >= 8 && d.length <= 15
    }, 'Poné tu celular con código de área'),
  acceptedTc: z.literal(true, { error: 'Necesitamos que aceptes los términos' }),
})

/** Pedir el código para entrar a una cuenta que YA existe. */
export const userOtpRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

/** Canjear el código por una sesión. */
export const userOtpVerifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().regex(/^\d{6}$/, 'Código de 6 dígitos'),
})
```

- [ ] **Step 7: Correr typecheck (va a marcar los usos rotos, es esperado)**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm typecheck 2>&1 | grep -E "error TS" | head -20
```

Esperado: errores en `apps/web` (el front todavía arma `User` sin email) y en `user-auth.ts`. Se resuelven en las tareas 2 y 5-6. **No commitear todavía si el typecheck no pasa** — este paso es sólo para conocer el alcance.

- [ ] **Step 8: Commit**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && git add packages/shared/src/types.ts packages/shared/src/schemas.ts apps/api/src/models/User.ts apps/api/src/models/userIdentity.integration.test.ts && git commit -m "feat(vecino): la identidad pasa del teléfono al email

El email es único por ciudad y es lo único que el vecino puede probar (le llega
un código). El teléfono queda como dato de contacto para las campañas de
WhatsApp y deja de ser único: una familia puede compartir un celular.

Parte 1/8 del plan de login por email. [cazabug S1-01]"
```

---

### Task 2: `/claim` con email — crea o pide código (el agujero)

**Files:**
- Modify: `apps/api/src/routes/user-auth.ts:35-77`
- Test: `apps/api/src/routes/user-auth.integration.test.ts` *(crear)*

**Interfaces:**
- Consumes: `userClaimSchema` de Task 1.
- Produces:
  - `POST /auth/claim` → email nuevo: `201 { ok:true, created:true, accessToken, refreshToken, user }`; email existente: `200 { ok:true, created:false, needsCode:true, _debugCode? }` **sin tokens**.
  - Helper interno `issueUserOtp(c, appId, email): Promise<string>` (devuelve el código en claro, para el `_debugCode`).
  - `serializeUser(user)` ahora incluye `email`.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/api/src/routes/user-auth.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { userAuthRoutes } from '@/routes/user-auth'
import { App, User, Otp } from '@/models'
import { _resetRateLimits } from '@/middleware/security'

// [cazabug S1-01 · P0] EL TEST QUE JUSTIFICA TODO EL TRABAJO:
// antes, sabiendo un dato público del vecino se entraba a su cuenta. Ahora, con
// el email de otro NO se entra: hay que probar que la casilla es tuya.

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()

const api = new Hono()
api.route('/auth', userAuthRoutes)

async function post(path: string, body: unknown, slug = 'ciudada') {
  const res = await api.request(`/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': slug },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

const alta = (over: Record<string, unknown> = {}) => ({
  nombre: 'María González',
  email: 'maria@mail.com',
  telefono: '3329421234',
  acceptedTc: true,
  ...over,
})

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await User.syncIndexes()
  await App.create({
    _id: appId,
    slug: 'ciudada',
    subdomain: 'ciudada',
    nombre: 'Mi CiudadA',
    ciudad: 'A',
    status: 'active',
    phonePrefix: '+54',
  })
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Otp.deleteMany({})])
  _resetRateLimits()
})

describe('POST /auth/claim — alta sin fricción', () => {
  it('vecino NUEVO entra al instante, SIN código', async () => {
    const r = await post('/claim', alta())
    expect(r.status).toBe(201)
    expect(r.body.created).toBe(true)
    expect(r.body.accessToken).toBeTruthy()
    expect(r.body.refreshToken).toBeTruthy()
    expect(r.body.user.email).toBe('maria@mail.com')
    // No se generó ningún código: el alta no lo necesita.
    expect(await Otp.countDocuments({})).toBe(0)
  })

  it('🔴 EL AGUJERO: con el email de otro NO se entra — pide código', async () => {
    await post('/claim', alta()) // María ya tiene cuenta

    // Un atacante que sabe su email intenta entrar.
    const r = await post('/claim', alta({ nombre: 'Atacante' }))

    expect(r.status).toBe(200)
    expect(r.body.created).toBe(false)
    expect(r.body.needsCode).toBe(true)
    // Lo esencial: NO le dimos sesión.
    expect(r.body.accessToken).toBeUndefined()
    expect(r.body.refreshToken).toBeUndefined()
  })

  it('el atacante NO puede pisarle el nombre a la víctima', async () => {
    await post('/claim', alta())
    await post('/claim', alta({ nombre: 'Atacante' }))
    const maria = await User.findOne({ appId, email: 'maria@mail.com' })
    expect(maria!.nombre).toBe('María González')
  })

  it('el email repetido genera un código para recuperar la cuenta', async () => {
    await post('/claim', alta())
    await post('/claim', alta())
    expect(await Otp.countDocuments({ appId, email: 'maria@mail.com', purpose: 'user' })).toBe(1)
  })

  it('sin email → 400 (cliente viejo con el bundle cacheado)', async () => {
    const r = await post('/claim', { nombre: 'Vieja App', telefono: '3329421234', acceptedTc: true })
    expect(r.status).toBe(400)
  })

  it('el mismo email en OTRA ciudad es otra cuenta', async () => {
    await App.create({
      _id: new Types.ObjectId(),
      slug: 'ciudadb',
      subdomain: 'ciudadb',
      nombre: 'B',
      ciudad: 'B',
      status: 'active',
    })
    await post('/claim', alta())
    const r = await post('/claim', alta(), 'ciudadb')
    expect(r.status).toBe(201)
    expect(r.body.created).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que FALLA**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api exec vitest run src/routes/user-auth.integration.test.ts
```

Esperado: falla el test del agujero con algo como `expected undefined to be false` o devolviendo `accessToken` — porque hoy `/claim` loguea a quien sepa el dato. **Anotá la salida cruda: es la prueba de que el bug existía.**

- [ ] **Step 3: Reescribir `/claim`**

En `apps/api/src/routes/user-auth.ts`, reemplazar los imports de las líneas 1-7 por:

```ts
import { Hono } from 'hono'
import { createHash, randomInt } from 'node:crypto'
import {
  userClaimSchema,
  userOtpRequestSchema,
  userOtpVerifySchema,
  normalizeTelefono,
} from '@misanpedro/shared'
import { User, Otp } from '@/models'
import {
  signAccessToken,
  issueRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllForSubject,
} from '@/services/jwt.service'
import { requireUserAuth } from '@/middleware/auth'
import { rateLimit } from '@/middleware/security'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { sendOtpCode } from '@/services/email.service'
import { otpDisclosureAllowed } from '@/lib/envSafety'
```

Reemplazar el bloque de constantes y `serializeUser` (líneas 14-28) por:

```ts
// Rate-limit del alta: no manda mensajes, sólo evitamos abuso grosero.
const claimLimiter = rateLimit({ prefix: 'user-claim', max: 30, windowMs: 60 * 60_000 })
// Pedir código: 5 por hora (cada uno manda un mail).
const otpRequestLimiter = rateLimit({ prefix: 'user-otp-request', max: 5, windowMs: 60 * 60_000 })
// Canjear código: 10 por minuto (freno a la fuerza bruta sobre 6 dígitos).
const otpVerifyLimiter = rateLimit({ prefix: 'user-otp-verify', max: 10, windowMs: 60_000 })

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}
function generateOtp(): string {
  return randomInt(100_000, 1_000_000).toString()
}

function serializeUser(user: any) {
  return {
    id: user._id.toString(),
    nombre: user.nombre,
    email: user.email,
    telefono: user.telefono,
  }
}

/** Emite la sesión del vecino: access corto (se renueva solo) + refresh que no
 *  vence pero SÍ se puede revocar. Antes era un token de 10 años irrevocable:
 *  si te robaban el celular no había forma de cerrar la sesión. [cazabug S1-01] */
async function issueSession(c: any, user: any, appId: unknown) {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'user',
    appId: String(appId),
  })
  const { token: refreshToken } = await issueRefreshToken({
    subjectType: 'user',
    subjectId: user._id.toString(),
    userAgent: c.req.header('user-agent'),
    // La sesión del vecino no vence: no le pedimos el código nunca más en ese
    // celular. Lo que ganamos es poder revocarla.
    neverExpires: true,
  })
  return { accessToken, refreshToken }
}

/** Genera y manda el código de 6 dígitos. Devuelve el código en claro para el
 *  `_debugCode` de desarrollo. */
async function issueUserOtp(c: any, appId: unknown, email: string): Promise<string> {
  await Otp.deleteMany({ appId, email, purpose: 'user' })
  const code = generateOtp()
  await Otp.create({
    appId,
    email,
    purpose: 'user',
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  })
  // El código es bearer-equivalente (5 min): nunca en logs de prod. [cazabug S1-04]
  if (otpDisclosureAllowed()) console.log(`[otp/user] ${email} (app ${appId}) → ${code}`)

  const tenant = c.get('tenant') as
    | { nombre?: string; subdomain?: string; brand?: { primaryColor?: string; logoUrl?: string } }
    | undefined
  sendOtpCode(email, code, tenant?.nombre ?? 'Mi Ciudad', {
    brandColor: tenant?.brand?.primaryColor,
    logoUrl: tenant?.brand?.logoUrl,
    loginUrl: tenant?.subdomain ? `https://${tenant.subdomain}.micuidad.com/#/perfil` : undefined,
  }).catch((err) => console.error('[user-otp-email]', err))

  return code
}
```

Reemplazar el handler `/claim` completo (líneas 30-77 del original) por:

```ts
/**
 * POST /auth/claim — alta del vecino en el mostrador.
 *
 * Email NUEVO  → crea la cuenta y entra al instante (sin código). Crear la
 *                cuenta propia no ataca a nadie: no hace falta verificar.
 * Email EXISTE → NO loguea. Manda un código al mail. Es el caso "me cambié de
 *                celular", y es donde estaba el agujero: antes alcanzaba con
 *                saber un dato público del otro para quedarse con su cuenta.
 *                [cazabug S1-01]
 */
userAuthRoutes.post('/claim', claimLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = userClaimSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const { nombre, email } = parsed.data
  // Normalizamos con el país del TENANT. [cazabug S1-02]
  const tenant = c.get('tenant') as { phonePrefix?: string } | undefined
  const telefono = normalizeTelefono(parsed.data.telefono, tenant?.phonePrefix)
  if (!/^\d{8,13}$/.test(telefono)) {
    return c.json({ ok: false, error: 'Poné tu celular con código de área' }, 400)
  }

  const existing = await User.findOne({ appId, email })
  if (existing) {
    // Cuenta ajena (o propia en otro celular): hay que probar la casilla.
    const code = await issueUserOtp(c, appId, email)
    return c.json({
      ok: true,
      created: false,
      needsCode: true,
      ...(otpDisclosureAllowed() ? { _debugCode: code } : {}),
    })
  }

  let user
  try {
    user = await User.create({ appId, nombre, email, telefono, acceptedTcAt: new Date() })
  } catch (err) {
    // Carrera: dos altas simultáneas con el mismo email → el índice único rechaza
    // la segunda. Tratamos ese caso igual que "ya existe": mandamos código.
    if ((err as { code?: number })?.code === 11000) {
      const code = await issueUserOtp(c, appId, email)
      return c.json({
        ok: true,
        created: false,
        needsCode: true,
        ...(otpDisclosureAllowed() ? { _debugCode: code } : {}),
      })
    }
    throw err
  }

  const { accessToken, refreshToken } = await issueSession(c, user, appId)
  return c.json({ ok: true, created: true, accessToken, refreshToken, user: serializeUser(user) }, 201)
})
```

- [ ] **Step 4: Correr el test y verificar que PASA**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api exec vitest run src/routes/user-auth.integration.test.ts
```

Esperado: `Tests 6 passed (6)`.

- [ ] **Step 5: Commit**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && git add apps/api/src/routes/user-auth.ts apps/api/src/routes/user-auth.integration.test.ts && git commit -m "fix(seguridad): /claim ya no entrega la cuenta de otro vecino

P0 S1-01. Antes, findOne por un dato público + login inmediato: cualquiera que
supiera ese dato entraba a la cuenta ajena, veía PII, pisaba el nombre y podía
borrarla. Ahora, si el email ya existe NO se emite sesión: se manda un código al
mail. El alta de una cuenta nueva sigue sin fricción.

La sesión pasa a access(1h)+refresh revocable; antes era un token de 10 años que
no se podía cancelar ni aunque te robaran el celular.

Parte 2/8. Test de regresión verificado en rojo antes del fix."
```

---

### Task 3: Recuperar la cuenta — `request-otp` + `verify-otp`

**Files:**
- Modify: `apps/api/src/routes/user-auth.ts` (agregar después de `/claim`)
- Test: `apps/api/src/routes/user-auth.integration.test.ts` (agregar bloque)

**Interfaces:**
- Consumes: `issueUserOtp`, `issueSession`, `serializeUser` (Task 2); `userOtpRequestSchema`, `userOtpVerifySchema` (Task 1).
- Produces:
  - `POST /auth/request-otp` → `200 { ok:true, registered:boolean, _debugCode? }`
  - `POST /auth/verify-otp` → `200 { ok:true, accessToken, refreshToken, user }`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `apps/api/src/routes/user-auth.integration.test.ts`:

```ts
describe('recuperar la cuenta con el código', () => {
  async function crearMaria() {
    const r = await post('/claim', alta())
    return r.body.user.id as string
  }

  it('con el código correcto entra y CONSERVA su cuenta (mismo id)', async () => {
    const idOriginal = await crearMaria()

    const pedido = await post('/request-otp', { email: 'maria@mail.com' })
    expect(pedido.status).toBe(200)
    expect(pedido.body.registered).toBe(true)
    const code = pedido.body._debugCode as string
    expect(code).toMatch(/^\d{6}$/)

    const entrada = await post('/verify-otp', { email: 'maria@mail.com', code })
    expect(entrada.status).toBe(200)
    expect(entrada.body.accessToken).toBeTruthy()
    expect(entrada.body.refreshToken).toBeTruthy()
    // Es la MISMA cuenta: su historial sigue colgando de este id.
    expect(entrada.body.user.id).toBe(idOriginal)
  })

  it('el código sirve UNA sola vez (anti-replay)', async () => {
    await crearMaria()
    const code = (await post('/request-otp', { email: 'maria@mail.com' })).body._debugCode
    expect((await post('/verify-otp', { email: 'maria@mail.com', code })).status).toBe(200)
    expect((await post('/verify-otp', { email: 'maria@mail.com', code })).status).toBe(401)
  })

  it('código vencido → 401', async () => {
    await crearMaria()
    const code = (await post('/request-otp', { email: 'maria@mail.com' })).body._debugCode
    await Otp.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })
    expect((await post('/verify-otp', { email: 'maria@mail.com', code })).status).toBe(401)
  })

  it('código equivocado → 401, y a los 5 intentos corta', async () => {
    await crearMaria()
    await post('/request-otp', { email: 'maria@mail.com' })
    for (let i = 0; i < 5; i++) {
      expect((await post('/verify-otp', { email: 'maria@mail.com', code: '000000' })).status).toBe(401)
    }
    expect((await post('/verify-otp', { email: 'maria@mail.com', code: '000000' })).status).toBe(429)
  })

  it('email sin cuenta → registered:false y NO manda código', async () => {
    const r = await post('/request-otp', { email: 'nadie@mail.com' })
    expect(r.status).toBe(200)
    expect(r.body.registered).toBe(false)
    expect(await Otp.countDocuments({})).toBe(0)
  })

  it('un código de la ciudad A no sirve en la ciudad B', async () => {
    await App.create({
      _id: new Types.ObjectId(),
      slug: 'ciudadc',
      subdomain: 'ciudadc',
      nombre: 'C',
      ciudad: 'C',
      status: 'active',
    })
    await crearMaria()
    const code = (await post('/request-otp', { email: 'maria@mail.com' })).body._debugCode
    expect((await post('/verify-otp', { email: 'maria@mail.com', code }, 'ciudadc')).status).toBe(401)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que FALLA**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api exec vitest run src/routes/user-auth.integration.test.ts
```

Esperado: los 6 casos nuevos fallan con 404 (las rutas no existen).

- [ ] **Step 3: Implementar los dos endpoints**

Agregar en `apps/api/src/routes/user-auth.ts`, justo después del handler `/claim`:

```ts
/**
 * POST /auth/request-otp — "Entrar desde mi cuenta" (Perfil). Manda el código al
 * mail del vecino que ya tiene cuenta.
 *
 * Devolvemos `registered` explícito para que el front sepa si mandarlo al alta.
 * Es el mismo trade-off de enumeración que ya acepta el login del comercio: saber
 * que un mail está registrado en la app es información de bajo valor.
 */
userAuthRoutes.post('/request-otp', otpRequestLimiter, async (c) => {
  const appId = getAppId(c)
  const parsed = userOtpRequestSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { email } = parsed.data

  const user = await User.findOne({ appId, email })
  if (!user) return c.json({ ok: true, registered: false })

  const code = await issueUserOtp(c, appId, email)
  return c.json({
    ok: true,
    registered: true,
    ...(otpDisclosureAllowed() ? { _debugCode: code } : {}),
  })
})

/** POST /auth/verify-otp — canjea el código por una sesión. */
userAuthRoutes.post('/verify-otp', otpVerifyLimiter, async (c) => {
  const appId = getAppId(c)
  const parsed = userOtpVerifySchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { email, code } = parsed.data

  const otp = await Otp.findOne({ appId, email, purpose: 'user' })
  if (!otp || otp.consumedAt) return c.json({ ok: false, error: 'código inválido' }, 401)
  if (otp.expiresAt.getTime() < Date.now()) {
    return c.json({ ok: false, error: 'código expirado' }, 401)
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return c.json({ ok: false, error: 'demasiados intentos' }, 429)
  }
  if (sha256(code) !== otp.codeHash) {
    otp.attempts += 1
    await otp.save()
    return c.json({ ok: false, error: 'código inválido' }, 401)
  }

  // Consumo ATÓMICO: si dos requests traen el mismo código a la vez, sólo una
  // gana el findOneAndUpdate sobre consumedAt:null. Anti-replay y anti-carrera.
  const consumed = await Otp.findOneAndUpdate(
    { _id: otp._id, consumedAt: null },
    { consumedAt: new Date() },
    { new: true },
  )
  if (!consumed) return c.json({ ok: false, error: 'código inválido' }, 401)

  // Buscamos al vecino DESPUÉS de validar el código, pero si no existe el código
  // ya quedó consumido — es lo correcto: un código gastado no debe poder reusarse.
  const user = await User.findOne({ appId, email })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)

  user.lastLoginAt = new Date()
  await user.save()

  const { accessToken, refreshToken } = await issueSession(c, user, appId)
  return c.json({ ok: true, accessToken, refreshToken, user: serializeUser(user) })
})
```

- [ ] **Step 4: Correr el test y verificar que PASA**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api exec vitest run src/routes/user-auth.integration.test.ts
```

Esperado: `Tests 12 passed (12)`.

- [ ] **Step 5: Commit**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && git add apps/api/src/routes/user-auth.ts apps/api/src/routes/user-auth.integration.test.ts && git commit -m "feat(vecino): recuperar la cuenta con un código al email

request-otp + verify-otp con el mismo patrón ya probado del comercio: TTL 5 min,
5 intentos, consumo atómico anti-replay y scoping por ciudad. Es el camino del
vecino que se cambió de celular: entra con el código y conserva su historial.

Parte 3/8."
```

---

### Task 4: Sesión revocable — refresh, logout, logout-all, sessions

**Files:**
- Modify: `apps/api/src/routes/user-auth.ts` (agregar después de `verify-otp`)
- Test: `apps/api/src/routes/user-auth.integration.test.ts` (agregar bloque)

**Interfaces:**
- Consumes: `consumeRefreshToken`, `revokeRefreshToken`, `revokeAllForSubject` de `@/services/jwt.service`.
- Produces:
  - `POST /auth/refresh` → `200 { ok:true, accessToken, refreshToken }`
  - `POST /auth/logout` → `200 { ok:true }`
  - `POST /auth/logout-all` → `200 { ok:true, revoked:number }` (requiere auth)
  - `GET /auth/sessions` → `200 { ok:true, sessions: [{ id, dispositivo, ultimaVez, actual }] }` (requiere auth)

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `apps/api/src/routes/user-auth.integration.test.ts`:

```ts
describe('sesión persistente pero revocable', () => {
  async function sesionNueva() {
    const r = await post('/claim', alta())
    return { access: r.body.accessToken as string, refresh: r.body.refreshToken as string }
  }

  async function get(path: string, access: string) {
    const res = await api.request(`/auth${path}`, {
      headers: { 'x-tenant-slug': 'ciudada', authorization: `Bearer ${access}` },
    })
    return { status: res.status, body: (await res.json()) as Record<string, any> }
  }

  it('el refresh devuelve un access nuevo (la sesión se renovó sola)', async () => {
    const s = await sesionNueva()
    const r = await post('/refresh', { refreshToken: s.refresh })
    expect(r.status).toBe(200)
    expect(r.body.accessToken).toBeTruthy()
  })

  it('cerrar sesión en todos lados deja afuera al otro dispositivo DE VERDAD', async () => {
    const celularViejo = await sesionNueva()
    // El vecino entra en un celular nuevo con su código.
    const code = (await post('/request-otp', { email: 'maria@mail.com' })).body._debugCode
    const celularNuevo = await post('/verify-otp', { email: 'maria@mail.com', code })

    // Desde el celular nuevo, echa a todos.
    const res = await api.request('/auth/logout-all', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-slug': 'ciudada',
        authorization: `Bearer ${celularNuevo.body.accessToken}`,
      },
      body: '{}',
    })
    expect(res.status).toBe(200)

    // El celular perdido ya no puede renovar: quedó afuera.
    expect((await post('/refresh', { refreshToken: celularViejo.refresh })).status).toBe(401)
  })

  it('logout revoca sólo ese dispositivo', async () => {
    const s = await sesionNueva()
    expect((await post('/logout', { refreshToken: s.refresh })).status).toBe(200)
    expect((await post('/refresh', { refreshToken: s.refresh })).status).toBe(401)
  })

  it('lista las sesiones abiertas para mostrarlas en Perfil', async () => {
    const s = await sesionNueva()
    const r = await get('/sessions', s.access)
    expect(r.status).toBe(200)
    expect(r.body.sessions.length).toBeGreaterThanOrEqual(1)
    expect(r.body.sessions[0]).toHaveProperty('ultimaVez')
  })

  it('un refresh inventado → 401', async () => {
    expect((await post('/refresh', { refreshToken: 'no-existe' })).status).toBe(401)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que FALLA**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api exec vitest run src/routes/user-auth.integration.test.ts
```

Esperado: los 5 casos nuevos fallan con 404.

- [ ] **Step 3: Implementar los cuatro endpoints**

Agregar en `apps/api/src/routes/user-auth.ts`, después de `verify-otp`:

```ts
/**
 * POST /auth/refresh — renueva el access. NO rota el refresh: la sesión del
 * vecino es persistente y rotar arriesga desloguearlo si se pierde una respuesta
 * de red (mismo criterio que el comercio).
 */
userAuthRoutes.post('/refresh', async (c) => {
  const appId = getAppId(c)
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (!refreshToken || typeof refreshToken !== 'string') {
    return c.json({ ok: false, error: 'refresh token required' }, 400)
  }
  const consumed = await consumeRefreshToken(refreshToken)
  if (!consumed || consumed.subjectType !== 'user') {
    return c.json({ ok: false, error: 'invalid refresh token' }, 401)
  }
  const user = await User.findOne({ _id: consumed.subjectId, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 401)

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'user',
    appId: String(appId),
  })
  return c.json({ ok: true, accessToken, refreshToken })
})

/** POST /auth/logout — cierra la sesión de ESTE dispositivo. */
userAuthRoutes.post('/logout', async (c) => {
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (refreshToken) await revokeRefreshToken(refreshToken)
  return c.json({ ok: true })
})

/**
 * POST /auth/logout-all — cierra la sesión en TODOS los dispositivos. Es lo que
 * el vecino usa cuando pierde el celular: hasta ahora era imposible, porque el
 * token de 10 años no se podía revocar. [cazabug S1-01]
 */
userAuthRoutes.post('/logout-all', requireUserAuth, async (c) => {
  const auth = c.get('auth')
  await revokeAllForSubject(auth.sub)
  return c.json({ ok: true })
})

/** GET /auth/sessions — dispositivos con sesión abierta (pantalla de Perfil). */
userAuthRoutes.get('/sessions', requireUserAuth, async (c) => {
  const { RefreshToken } = await import('@/models')
  const auth = c.get('auth')
  const docs = await RefreshToken.find({
    subjectId: auth.sub,
    subjectType: 'user',
    revokedAt: { $exists: false },
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean()

  return c.json({
    ok: true,
    sessions: docs.map((d: any) => ({
      id: String(d._id),
      // El user-agent crudo es ilegible para el vecino; mostramos algo humano.
      dispositivo: describirDispositivo(d.userAgent),
      ultimaVez: d.updatedAt ?? d.createdAt,
    })),
  })
})

/** Traduce el user-agent a algo que un vecino entienda. */
function describirDispositivo(ua?: string): string {
  if (!ua) return 'Un dispositivo'
  if (/iPhone|iPad/i.test(ua)) return 'iPhone o iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Una computadora Windows'
  if (/Mac OS/i.test(ua)) return 'Una Mac'
  return 'Un dispositivo'
}
```

- [ ] **Step 4: Correr el test y verificar que PASA**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api exec vitest run src/routes/user-auth.integration.test.ts
```

Esperado: `Tests 17 passed (17)`.

- [ ] **Step 5: Correr la suite entera del backend**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api test 2>&1 | tail -6
```

Esperado: todo verde. Si `tenant-isolation.integration.test.ts` o `redemptions.integration.test.ts` fallan, es porque crean vecinos sin email — actualizá esos fixtures agregando `email: '<algo>@test.com'` y volvé a correr.

- [ ] **Step 6: Commit**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && git add apps/api/src/routes/user-auth.ts apps/api/src/routes/user-auth.integration.test.ts && git commit -m "feat(vecino): sesión persistente pero revocable

refresh + logout + logout-all + sessions. El vecino no vuelve a ver un código en
ese celular, pero ahora la sesión SE PUEDE cerrar: antes era un token de 10 años
irrevocable, así que un celular robado quedaba adentro para siempre.

Parte 4/8."
```

---

### Task 5: Front — cliente API y validación del formulario

**Files:**
- Create: `apps/web/src/lib/validations/claim.ts`
- Create: `apps/web/src/lib/validations/claim.test.ts`
- Modify: `apps/web/src/lib/api.ts:269-280` (tipo `ApiUserSession`) y `:435-454` (`userApi`)

**Interfaces:**
- Consumes: los endpoints de las tareas 2-4.
- Produces:
  - `validateClaim(form: ClaimForm): ClaimErrors`
  - `userApi.claim(payload)` → `{ ok, created, needsCode?, accessToken?, refreshToken?, user?, _debugCode? }`
  - `userApi.requestOtp(email)` → `{ ok, registered, _debugCode? }`
  - `userApi.verifyOtp(email, code)` → `{ ok, accessToken, refreshToken, user }`
  - `userApi.logoutAll()`, `userApi.sessions()`

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/web/src/lib/validations/claim.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateClaim, type ClaimForm } from './claim'

const valido: ClaimForm = {
  nombre: 'María González',
  email: 'maria@mail.com',
  telefono: '3329 42-1234',
  acceptedTc: true,
}

describe('validateClaim — alta del vecino', () => {
  it('acepta un formulario válido', () => {
    expect(validateClaim(valido)).toEqual({})
  })

  it('exige el nombre', () => {
    expect(validateClaim({ ...valido, nombre: 'A' }).nombre).toBeTruthy()
  })

  it('exige un email con forma de email', () => {
    expect(validateClaim({ ...valido, email: '' }).email).toBeTruthy()
    expect(validateClaim({ ...valido, email: 'maria' }).email).toBeTruthy()
    expect(validateClaim({ ...valido, email: 'maria@mail' }).email).toBeTruthy()
  })

  it('acepta el email con espacios o mayúsculas (se limpia después)', () => {
    expect(validateClaim({ ...valido, email: '  MARIA@Mail.com ' }).email).toBeUndefined()
  })

  it('exige el celular con código de área', () => {
    expect(validateClaim({ ...valido, telefono: '421234' }).telefono).toBeTruthy()
  })

  it('exige aceptar los términos', () => {
    expect(validateClaim({ ...valido, acceptedTc: false }).acceptedTc).toBeTruthy()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que FALLA**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/web exec vitest run src/lib/validations/claim.test.ts
```

Esperado: FAIL — no existe `./claim`.

- [ ] **Step 3: Crear el validador**

Crear `apps/web/src/lib/validations/claim.ts`:

```ts
/**
 * Validación del alta del vecino (nombre + email + celular + T&C).
 * Función pura, sin React ni stores → fácil de testear.
 *
 * El EMAIL es la identidad: es lo único con lo que el vecino puede recuperar su
 * cuenta en otro celular. Por eso es obligatorio. [cazabug S1-01]
 */

export type ClaimForm = {
  nombre: string
  email: string
  telefono: string
  acceptedTc: boolean
}

export type ClaimErrors = Partial<Record<keyof ClaimForm, string>>

export function validateClaim(form: ClaimForm): ClaimErrors {
  const errs: ClaimErrors = {}

  const nombre = form.nombre.trim()
  if (nombre.length < 2) errs.nombre = 'Decinos tu nombre'
  else if (nombre.length > 80) errs.nombre = 'Máximo 80 caracteres'

  const email = form.email.trim()
  if (!email) errs.email = 'Necesitamos tu email para que puedas recuperar tu cuenta'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Revisá el email, parece incompleto'

  const tel = form.telefono.replace(/\D/g, '')
  if (tel.length < 8) errs.telefono = 'Poné tu celular con código de área'

  if (!form.acceptedTc) errs.acceptedTc = 'Necesitamos que aceptes los términos'

  return errs
}
```

- [ ] **Step 4: Correr el test y verificar que PASA**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/web exec vitest run src/lib/validations/claim.test.ts
```

Esperado: `Tests 6 passed (6)`.

- [ ] **Step 5: Actualizar `ApiUserSession`**

En `apps/web/src/lib/api.ts:269`, reemplazar el tipo:

```ts
export type ApiUserSession = {
  id: string
  nombre: string
  /** Identidad del vecino: con esto recupera su cuenta en otro celular. */
  email: string
  telefono: string
  // ─── Legacy / opcionales (cuentas viejas) ───
  dni?: string
  whatsapp?: string
  fechaNacimiento?: string
```

- [ ] **Step 6: Reescribir `userApi`**

En `apps/web/src/lib/api.ts:435`, reemplazar el objeto `userApi` completo:

```ts
export const userApi = {
  /**
   * Alta en el mostrador. Si el email es NUEVO, el backend devuelve la sesión y
   * el vecino entra al instante. Si el email YA existe, NO devuelve sesión:
   * devuelve `needsCode` y manda un código al mail (es el caso "me cambié de
   * celular"). El llamador tiene que contemplar los dos desenlaces.
   */
  async claim(payload: { nombre: string; email: string; telefono: string; acceptedTc: true }) {
    const data = await request<{
      ok: boolean
      created: boolean
      needsCode?: boolean
      accessToken?: string
      refreshToken?: string
      user?: ApiUserSession
      _debugCode?: string
    }>('/auth/claim', json(payload))
    if (data.accessToken) tokens.set('user', data.accessToken, data.refreshToken)
    return data
  },
  /** Pide el código para entrar a una cuenta que ya existe. */
  async requestOtp(email: string) {
    return request<{ ok: boolean; registered: boolean; _debugCode?: string }>(
      '/auth/request-otp',
      json({ email }),
    )
  },
  /** Canjea el código por la sesión. */
  async verifyOtp(email: string, code: string) {
    const data = await request<{
      ok: boolean
      accessToken: string
      refreshToken: string
      user: ApiUserSession
    }>('/auth/verify-otp', json({ email, code }))
    tokens.set('user', data.accessToken, data.refreshToken)
    return data
  },
  async me() {
    return request<{ ok: boolean; user: ApiUserSession }>('/auth/me', { subject: 'user' })
  },
  /** Dispositivos con sesión abierta (pantalla de Perfil). */
  async sessions() {
    return request<{
      ok: boolean
      sessions: { id: string; dispositivo: string; ultimaVez: string }[]
    }>('/auth/sessions', { subject: 'user' })
  },
  /** Cierra la sesión en TODOS los dispositivos y limpia este. */
  async logoutAll() {
    const data = await request<{ ok: boolean }>('/auth/logout-all', {
      ...json({}),
      subject: 'user',
    })
    tokens.clear('user')
    return data
  },
}
```

- [ ] **Step 7: Correr typecheck del front**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/web typecheck 2>&1 | grep -E "error TS" | head -20
```

Esperado: errores sólo en `RegistroPage.tsx` y `PerfilPage.tsx` (los arregla la Task 6 y 7) y en cualquier lugar que arme un `User` sin email. Anotá la lista.

- [ ] **Step 8: Commit**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && git add apps/web/src/lib/validations/claim.ts apps/web/src/lib/validations/claim.test.ts apps/web/src/lib/api.ts && git commit -m "feat(web): cliente y validación del alta con email

userApi contempla los dos desenlaces del alta (entra directo / necesita código) y
suma requestOtp, verifyOtp, sessions y logoutAll. doRefresh ya ruteaba el refresh
del vecino a /auth/refresh, así que la renovación automática funciona sola.

Parte 5/8."
```

---

### Task 6: Front — alta con email y código en la misma pantalla

**Files:**
- Modify: `apps/web/src/pages/RegistroPage.tsx`
- Modify: `apps/web/src/lib/stores.ts:124-142` (`userActions.replace` recibe el email)

**Interfaces:**
- Consumes: `validateClaim`, `userApi.claim`, `userApi.verifyOtp` (Task 5).
- Produces: pantalla de alta con dos fases (`datos` → `codigo`) sin cambiar de ruta.

- [ ] **Step 1: Reescribir el formulario**

En `apps/web/src/pages/RegistroPage.tsx`:

1. Agregar el estado del email y de la fase, junto a los que ya existen:

```tsx
  const [email, setEmail] = useState('')
  // 'datos' = alta normal · 'codigo' = el email ya tenía cuenta y hay que probarla
  const [fase, setFase] = useState<'datos' | 'codigo'>('datos')
  const [codigo, setCodigo] = useState('')
```

2. Reemplazar el tipo local `Errors` de la línea 10 (que sólo contempla nombre/telefono/acceptedTc) por el del validador, para que acepte el error de email:

```tsx
import { validateClaim, type ClaimErrors } from '@/lib/validations/claim'
```

y cambiar la declaración del estado a `useState<ClaimErrors>({})`. Borrar el `type Errors = …` local: ahora vive junto al validador (una sola definición).

3. Reemplazar la validación inline (líneas 33-35 del original) por el validador puro:

```tsx
    const errs = validateClaim({ nombre, email, telefono, acceptedTc })
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
```

4. Reemplazar el envío (línea 48 del original) por:

```tsx
      const data = await userApi.claim({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        telefono,
        acceptedTc: true,
      })
      if (data.needsCode) {
        // El email ya tenía cuenta: no lo logueamos, le pedimos el código acá
        // mismo. Es el vecino que se cambió de celular. [cazabug S1-01]
        if (data._debugCode) setCodigo(data._debugCode)
        setFase('codigo')
        return
      }
      const user = data.user!
      userActions.replace({
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        telefono: user.telefono,
      })
```

5. Agregar el handler del código:

```tsx
  async function handleCodigo(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const data = await userApi.verifyOtp(email.trim().toLowerCase(), codigo)
      userActions.replace({
        id: data.user.id,
        nombre: data.user.nombre,
        email: data.user.email,
        telefono: data.user.telefono,
      })
      navigate('/')
    } catch {
      setErrors({ email: 'Ese código no es correcto o ya venció. Pedí uno nuevo.' })
    } finally {
      setSubmitting(false)
    }
  }
```

6. Agregar el campo email al formulario, entre Nombre y Celular:

```tsx
        <Field label="Email" error={errors.email} icon={Mail}>
          <input
            id="registro-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => {
              setEmail(ev.target.value)
              setErrors((x) => ({ ...x, email: undefined }))
            }}
            placeholder="tu@email.com"
            className="w-full bg-transparent text-base text-fin-ink outline-none placeholder:text-fin-faint"
          />
        </Field>
```

(importar `Mail` de `lucide-react`).

7. Envolver el formulario de datos en `{fase === 'datos' && (...)}` y agregar la fase del código:

```tsx
      {fase === 'codigo' && (
        <form onSubmit={handleCodigo} className="flex flex-col gap-4">
          <div className="rounded-2xl bg-fin-surface p-4 ring-1 ring-fin-line">
            <p className="text-sm font-bold text-fin-ink">Ya tenés una cuenta con ese email</p>
            <p className="mt-1 text-xs text-fin-soft">
              Te mandamos un código de 6 dígitos a <span className="font-bold">{email}</span>.
              Ponelo acá y recuperás todos tus canjes.
            </p>
          </div>
          <Field label="Código" error={errors.email} icon={KeyRound}>
            <input
              id="registro-codigo"
              name="codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              onChange={(ev) => setCodigo(ev.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full bg-transparent text-center text-2xl font-bold tracking-[0.4em] text-fin-ink outline-none placeholder:text-fin-faint"
            />
          </Field>
          <button
            type="submit"
            disabled={submitting || codigo.length !== 6}
            className="rounded-2xl bg-fin-lime px-5 py-3.5 text-sm font-bold text-fin-bg shadow-fin-glow disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar y recuperar mis canjes'}
          </button>
          <button
            type="button"
            onClick={() => {
              setFase('datos')
              setCodigo('')
              setErrors({})
            }}
            className="text-center text-xs font-bold text-fin-soft hover:text-fin-ink"
          >
            ← Usar otro email
          </button>
        </form>
      )}
```

(importar `KeyRound` de `lucide-react`).

8. Actualizar el copy de la línea 102, que hoy miente:

```tsx
          Tu nombre, tu email y tu celular, una vez. El email es tu cuenta: con él la
          recuperás en cualquier celular.
```

- [ ] **Step 2: Actualizar el store**

En `apps/web/src/lib/stores.ts`, el tipo `User` que consume `userActions.replace` viene de `apps/web/src/lib/types.ts:212`. Agregarle el email obligatorio ahí, igual que en el shared:

```ts
  /** Identidad del vecino. */
  email: string
```

- [ ] **Step 3: Correr typecheck y tests del front**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/web typecheck && pnpm --filter @misanpedro/web test 2>&1 | tail -6
```

Esperado: typecheck sin errores y todos los tests verdes. Si algún test/seed arma un `User` sin email, agregarle uno.

- [ ] **Step 4: Verificar en el browser**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api dev
```

En otra terminal, `pnpm --filter @misanpedro/web dev`. Abrir `http://localhost:5180/#/datos` y comprobar:
1. Alta con un email nuevo → entra directo, sin código.
2. Repetir con el MISMO email → aparece el paso del código (en desarrollo viene precargado).
3. Poner el código → entra y ve su cuenta.

- [ ] **Step 5: Commit**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && git add apps/web/src/pages/RegistroPage.tsx apps/web/src/lib/types.ts && git commit -m "feat(web): el alta pide email y resuelve el código en la misma pantalla

Si el email ya tenía cuenta, el vecino no se va a ningún lado: en el mismo
formulario le aparece el paso del código y entra con su historial. El copy dejó
de prometer 'sin códigos: tu teléfono es tu cuenta'.

Parte 6/8."
```

---

### Task 7: Front — Perfil: entrar desde mi cuenta y cerrar sesiones

**Files:**
- Modify: `apps/web/src/pages/PerfilPage.tsx`

**Interfaces:**
- Consumes: `userApi.requestOtp`, `userApi.verifyOtp`, `userApi.sessions`, `userApi.logoutAll` (Task 5).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Agregar "Entrar desde mi cuenta" en la rama sin sesión**

En `apps/web/src/pages/PerfilPage.tsx`, en el bloque anónimo (el que hoy invita a canjear el primer cupón, alrededor de la línea 95), agregar debajo del CTA existente:

```tsx
            <button
              type="button"
              onClick={() => setModoEntrar(true)}
              className="mt-2 text-left text-xs font-bold text-fin-soft underline hover:text-fin-ink"
            >
              Ya tengo cuenta — entrar desde mi email
            </button>
```

Y el formulario, que se muestra cuando `modoEntrar` está activo:

```tsx
        {modoEntrar && (
          <section className="rounded-3xl bg-fin-surface p-5 ring-1 ring-fin-line shadow-fin-card">
            {faseEntrar === 'email' ? (
              <form onSubmit={handlePedirCodigo} className="flex flex-col gap-3">
                <h2 className="text-sm font-bold text-fin-ink">Entrar con mi cuenta</h2>
                <p className="text-xs text-fin-soft">
                  Poné el email con el que te registraste y te mandamos un código.
                </p>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={emailEntrar}
                  onChange={(e) => setEmailEntrar(e.target.value)}
                  placeholder="tu@email.com"
                  className="rounded-2xl bg-fin-surface2 px-4 py-3 text-sm text-fin-ink outline-none ring-1 ring-fin-line"
                />
                {errorEntrar && <p className="text-xs font-bold text-fin-danger">{errorEntrar}</p>}
                <button
                  type="submit"
                  disabled={enviandoEntrar || !emailEntrar.includes('@')}
                  className="rounded-2xl bg-fin-lime px-4 py-3 text-sm font-bold text-fin-bg disabled:opacity-60"
                >
                  {enviandoEntrar ? 'Enviando…' : 'Mandarme el código'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleEntrarConCodigo} className="flex flex-col gap-3">
                <h2 className="text-sm font-bold text-fin-ink">Revisá tu email</h2>
                <p className="text-xs text-fin-soft">
                  Te mandamos un código a <span className="font-bold">{emailEntrar}</span>.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={codigoEntrar}
                  onChange={(e) => setCodigoEntrar(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="rounded-2xl bg-fin-surface2 px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-fin-ink outline-none ring-1 ring-fin-line"
                />
                {errorEntrar && <p className="text-xs font-bold text-fin-danger">{errorEntrar}</p>}
                <button
                  type="submit"
                  disabled={enviandoEntrar || codigoEntrar.length !== 6}
                  className="rounded-2xl bg-fin-lime px-4 py-3 text-sm font-bold text-fin-bg disabled:opacity-60"
                >
                  {enviandoEntrar ? 'Entrando…' : 'Entrar'}
                </button>
              </form>
            )}
          </section>
        )}
```

Con el estado y los handlers:

```tsx
  const [modoEntrar, setModoEntrar] = useState(false)
  const [faseEntrar, setFaseEntrar] = useState<'email' | 'codigo'>('email')
  const [emailEntrar, setEmailEntrar] = useState('')
  const [codigoEntrar, setCodigoEntrar] = useState('')
  const [enviandoEntrar, setEnviandoEntrar] = useState(false)
  const [errorEntrar, setErrorEntrar] = useState<string | null>(null)

  async function handlePedirCodigo(e: React.FormEvent) {
    e.preventDefault()
    setErrorEntrar(null)
    setEnviandoEntrar(true)
    try {
      const r = await userApi.requestOtp(emailEntrar.trim().toLowerCase())
      if (!r.registered) {
        setErrorEntrar('No encontramos una cuenta con ese email. Registrate canjeando tu primer cupón.')
        return
      }
      if (r._debugCode) setCodigoEntrar(r._debugCode)
      setFaseEntrar('codigo')
    } catch {
      setErrorEntrar('No pudimos mandar el código. Probá de nuevo en un rato.')
    } finally {
      setEnviandoEntrar(false)
    }
  }

  async function handleEntrarConCodigo(e: React.FormEvent) {
    e.preventDefault()
    setErrorEntrar(null)
    setEnviandoEntrar(true)
    try {
      const data = await userApi.verifyOtp(emailEntrar.trim().toLowerCase(), codigoEntrar)
      userActions.replace({
        id: data.user.id,
        nombre: data.user.nombre,
        email: data.user.email,
        telefono: data.user.telefono,
      })
      setModoEntrar(false)
    } catch {
      setErrorEntrar('Ese código no es correcto o ya venció.')
    } finally {
      setEnviandoEntrar(false)
    }
  }
```

- [ ] **Step 2: Agregar el bloque de sesiones en la rama CON sesión**

Dentro de la sección "Tu cuenta", reemplazar el párrafo que dice *"Tu teléfono es tu cuenta…"* por:

```tsx
            <p className="mt-3 text-[11px] text-fin-faint">
              Tu email es tu cuenta: con él recuperás tu ahorro en cualquier celular.
              ¿Necesitás corregir algo? Escribinos a{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-fin-lime">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
```

Y agregar `<Row icon={Mail} label="Email" value={user.email} />` junto a las otras filas.

Después, una sección nueva de sesiones:

```tsx
          <section className="rounded-3xl bg-fin-surface p-5 ring-1 ring-fin-line shadow-fin-card">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">
              Dónde tenés la sesión abierta
            </h2>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {sesiones.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-fin-soft">
                  <span>{s.dispositivo}</span>
                  <span className="text-[11px] text-fin-faint">{fmtRelative(s.ultimaVez)}</span>
                </div>
              ))}
              {sesiones.length === 0 && <p className="text-xs text-fin-faint">Sólo este dispositivo.</p>}
            </div>
            <button
              type="button"
              onClick={handleCerrarTodo}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-fin-surface2 px-4 py-3 text-sm font-bold text-fin-ink ring-1 ring-fin-line hover:bg-fin-line"
            >
              <LogOut size={14} /> Cerrar sesión en todos lados
            </button>
            <p className="mt-2 text-[11px] text-fin-faint">
              Si perdiste un celular, con esto lo dejás afuera. Vas a tener que volver a entrar con
              tu email.
            </p>
          </section>
```

Con:

```tsx
  const [sesiones, setSesiones] = useState<{ id: string; dispositivo: string; ultimaVez: string }[]>([])

  useEffect(() => {
    if (!user) return
    userApi
      .sessions()
      .then((r) => setSesiones(r.sessions))
      .catch(() => setSesiones([]))
  }, [user?.id])

  async function handleCerrarTodo() {
    await userApi.logoutAll().catch(() => {})
    userActions.signOut()
    navigate('/', { replace: true })
  }
```

(importar `LogOut` y `Mail` de `lucide-react`, y `fmtRelative` de `@/lib/format`).

- [ ] **Step 3: Entrar de un toque desde el botón del mail (magic link)**

El backend ya manda el link armado: `buildOtpMagicLink` (`apps/api/src/services/email.service.ts:271-285`)
le pega `?email=…&code=…` al `loginUrl` que pasamos en `issueUserOtp`, y `renderOtpEmail` lo usa
como CTA. **Falta que el front lo lea.** Sin esto el botón del mail deja al vecino en Perfil sin
hacer nada, que es peor que no tenerlo.

En `PerfilPage.tsx`, agregar el auto-login al montar:

```tsx
  const [params] = useSearchParams()

  // Magic-link del mail: ?email=…&code=…. Entramos solos y LIMPIAMOS la URL, para
  // que el código no quede en el historial del navegador. Corre una sola vez.
  const magicIntentado = useRef(false)
  useEffect(() => {
    if (magicIntentado.current || user) return
    const em = (params.get('email') ?? '').trim().toLowerCase()
    const cd = (params.get('code') ?? '').replace(/\D/g, '').slice(0, 6)
    if (!em || cd.length !== 6) return
    magicIntentado.current = true
    ;(async () => {
      try {
        const data = await userApi.verifyOtp(em, cd)
        userActions.replace({
          id: data.user.id,
          nombre: data.user.nombre,
          email: data.user.email,
          telefono: data.user.telefono,
        })
      } catch {
        // Link vencido o ya usado: le ofrecemos el camino manual.
        setModoEntrar(true)
        setEmailEntrar(em)
        setFaseEntrar('codigo')
        setErrorEntrar('Ese enlace ya venció o se usó. Pedí un código nuevo.')
      } finally {
        // Sacamos email y code de la URL pase lo que pase.
        navigate('/perfil', { replace: true })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

(importar `useSearchParams` de `react-router-dom` y `useRef` de `react`).

- [ ] **Step 4: Correr typecheck y tests**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/web typecheck && pnpm --filter @misanpedro/web test 2>&1 | tail -6
```

Esperado: verde.

- [ ] **Step 5: Verificar en el browser**

Con los dos dev servers levantados, en `http://localhost:5180/#/perfil`:
1. Sin sesión → aparece "Ya tengo cuenta — entrar desde mi email"; pedir código y entrar.
2. Con sesión → se ve el email, la lista de dispositivos y el botón de cerrar todo.
3. Tocar "Cerrar sesión en todos lados" → vuelve al inicio sin sesión.
4. **Magic link:** pedir un código, copiar el `_debugCode` de la consola del API y abrir
   `http://localhost:5180/#/perfil?email=<el email>&code=<el código>` → entra solo, y la barra de
   direcciones queda limpia (sin `email` ni `code`).

- [ ] **Step 6: Commit**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && git add apps/web/src/pages/PerfilPage.tsx && git commit -m "feat(web): Perfil — entrar desde mi cuenta, magic link y cerrar sesiones

El vecino que se cambió de celular entra con su email desde Perfil (o de un toque
con el botón del mail, limpiando el código de la URL), y el que perdió el suyo
puede echar a todos los dispositivos.

Parte 7/8."
```

---

### Task 8: Migración y verificación final

**Files:**
- Create: `apps/api/scripts/migrate-vecinos-email.ts`
- Modify: `CAZABUG-FINDINGS.md` (marcar S1-01 como cerrado)

**Interfaces:**
- Consumes: el modelo `User` de Task 1.
- Produces: nada de código.

- [ ] **Step 1: Escribir el script de migración**

Crear `apps/api/scripts/migrate-vecinos-email.ts`:

```ts
/**
 * Migración one-off: borra las cuentas de vecino SIN email.
 *
 * Con la identidad movida al email (cazabug S1-01), una cuenta sin email no
 * puede entrar nunca más. Verificado contra la base real el 2026-07-27: las 4
 * cuentas en esa situación son datos de prueba ("Vecino Uno", "Ana", "Beto",
 * "Cami"), creadas el mismo minuto y con CERO canjes.
 *
 * Corre en seco por defecto. Para ejecutar de verdad: --apply
 *
 *   node --env-file=.env --import tsx scripts/migrate-vecinos-email.ts
 *   node --env-file=.env --import tsx scripts/migrate-vecinos-email.ts --apply
 */
import mongoose from 'mongoose'
import { env } from '../src/env'
import { User, Activation, Redemption } from '../src/models'

const APPLY = process.argv.includes('--apply')

async function main() {
  await mongoose.connect(env.MONGODB_URI, { dbName: 'misanpedro' })

  const sinEmail = await User.find({
    $or: [{ email: { $exists: false } }, { email: null }, { email: '' }],
  }).lean()

  console.log(`Cuentas sin email: ${sinEmail.length}`)
  for (const u of sinEmail) {
    const [canjes, activaciones] = await Promise.all([
      Redemption.countDocuments({ userId: u._id }),
      Activation.countDocuments({ userId: u._id }),
    ])
    console.log(`  · ${u.nombre} — ${canjes} canjes, ${activaciones} activaciones`)
    // Guardrail: si aparece una cuenta CON canjes, frenamos. El supuesto de la
    // migración (son todas de prueba) dejó de valer y hay que revisar a mano.
    if (canjes > 0) {
      console.error('🔴 FRENO: esta cuenta tiene canjes reales. Revisar a mano antes de borrar.')
      await mongoose.disconnect()
      process.exit(1)
    }
  }

  if (!APPLY) {
    console.log('\n(simulación — nada se borró. Volvé a correr con --apply)')
    await mongoose.disconnect()
    return
  }

  const ids = sinEmail.map((u) => u._id)
  await Activation.deleteMany({ userId: { $in: ids } })
  const res = await User.deleteMany({ _id: { $in: ids } })
  console.log(`\n✅ ${res.deletedCount} cuentas borradas.`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Correrlo en seco contra la base real**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug/apps/api && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && node --env-file=/Users/alannaimtapia/dev/misanpedro/apps/api/.env --import tsx scripts/migrate-vecinos-email.ts
```

Esperado: lista 4 cuentas, todas con 0 canjes, y avisa que no borró nada. **Si alguna tiene canjes, el script frena solo — pará y avisá al usuario.**

- [ ] **Step 3: Gate completo**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm typecheck && pnpm --filter @misanpedro/api test 2>&1 | tail -5 && pnpm --filter @misanpedro/web test 2>&1 | tail -5 && pnpm check:tenant && pnpm build 2>&1 | tail -5
```

Esperado: typecheck 6/6, ambas suites verdes, `check:tenant` ✓ y el build sin errores.

- [ ] **Step 4: Verificación adversarial del agujero**

🔴 **NO levantes el API con el `.env` del repo para esto.** Ese `.env` apunta a la Mongo de
PRODUCCIÓN: un `POST /auth/claim` contra ese servidor crearía un vecino real en la base de los
clientes. La verificación va contra una base efímera.

El ataque original ya está reproducido end-to-end en `user-auth.integration.test.ts`, contra un
Mongo real (in-memory, no un mock) y atravesando la ruta Hono de verdad. Correlo aislado y leé la
salida:

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && pnpm --filter @misanpedro/api exec vitest run src/routes/user-auth.integration.test.ts -t "EL AGUJERO" --reporter=verbose
```

Esperado: pasa el caso `🔴 EL AGUJERO: con el email de otro NO se entra — pide código`, que afirma
`accessToken === undefined`. Ese assert es la prueba: antes del fix devolvía una sesión con acceso a
la PII de la víctima (verificado en rojo en la Task 2).

Si además querés pegarle por HTTP a mano, levantá el API apuntándolo a una base descartable:

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug/apps/api && export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && MONGODB_URI="mongodb://127.0.0.1:27017/misanpedro-scratch" JWT_SECRET="dev-secret-32-chars-minimum-padding-pad" JWT_REFRESH_SECRET="dev-refresh-32-chars-minimum-padding-pad" PORT=3002 NODE_ENV=development node --import tsx src/index.ts
```

(requiere un mongod local escuchando en 27017; si no lo tenés, alcanza con el test de arriba).

- [ ] **Step 5: Marcar el hallazgo como cerrado**

En `CAZABUG-FINDINGS.md`, cambiar `### [S1-01] ⬜ pendiente` por `### [S1-01] ✅ FIXEADO`, y en la tabla de resueltos agregar la fila:

```markdown
| (este plan) | S1-01(P0) | login del vecino por email — se cierra el account takeover |
```

- [ ] **Step 6: Commit**

```bash
cd /Users/alannaimtapia/dev/misanpedro-cazabug && git add apps/api/scripts/migrate-vecinos-email.ts CAZABUG-FINDINGS.md && git commit -m "chore(vecino): migración de cuentas sin email + cierre de S1-01

El script frena solo si encuentra una cuenta con canjes reales: el supuesto (son
todas de prueba) queda verificado en cada corrida, no asumido.

Parte 8/8. Con esto el P0 S1-01 queda cerrado."
```

---

## Notas para quien ejecute

- **El paso que importa** es el Step 2 de la Task 2: ver el test del agujero en ROJO. Guardá esa salida — es la prueba de que el bug era real y de que el fix lo cierra.
- Si un test viejo se rompe porque crea vecinos sin email, **arreglá el fixture**, no el modelo. El email obligatorio es la decisión, no un accidente.
- La Mongo del `.env` **es la de producción**. Ningún test la toca (usan `mongodb-memory-server`). El único que la toca es el script de la Task 8, y por defecto corre en seco.
