# @misanpedro/api

Backend de Mi San Pedro — Hono + Mongoose + Zod.

## Stack

- **Runtime**: Node 22+ con `tsx` (sin step de build en dev)
- **Framework**: [Hono](https://hono.dev) sobre `@hono/node-server`
- **DB**: MongoDB Atlas (Mongoose ODM)
- **Validación**: Zod (schemas compartidos en `@misanpedro/shared`)
- **Auth**: JWT access (15 min) + refresh opaco (30 días, hasheado) **con rotation**
- **Pagos**: Mercado Pago Preapproval (suscripciones mensuales) + webhook firmado HMAC
- **WhatsApp**: `whatsapp-web.js` opcional (modo stub si no está instalada)

## Quickstart

```bash
# Instalación
pnpm install

# Configurar entorno
cp apps/api/.env.example apps/api/.env
# Editar .env con MONGODB_URI + JWT_SECRET + JWT_REFRESH_SECRET (32+ chars)

# Desarrollo (hot reload)
cd apps/api
pnpm dev
# → http://localhost:3001
# → health: http://localhost:3001/api/v1/health

# Build (no se usa en dev, sólo para producción)
pnpm build
pnpm start
```

## Endpoints

Todos prefijados con `/api/v1`.

### Health
- `GET /` → `{name, version}`
- `GET /health` → estado DB + uptime

### Auth comercio (`/merchant/auth`)
- `POST /login` `{email, password}` → access + refresh + user + merchant
- `POST /refresh` `{refreshToken}` → access + nuevo refresh (rotation)
- `POST /logout` `{refreshToken}` → revoca el token
- `POST /logout-all` (auth) → revoca todos los tokens del subject
- `GET /me` (auth) → user + merchant

Login devuelve **403** si `merchant.estado` es `suspendido` o `cancelado`.

### Auth vecino (`/auth`)
- `POST /register` `{dni, nombre, email, whatsapp, fechaNacimiento, acceptedTc}` → auto-login
- `POST /request-otp` `{email}` → manda código de 6 dígitos por email (Resend) o lo loguea
- `POST /verify-otp` `{email, code}` → tokens + user
- `POST /refresh` (idem comercio, con rotation)
- `POST /logout` `{refreshToken}`
- `GET /me` (auth)

OTP: 6 dígitos, hash SHA256 en DB, TTL 5 min, max 5 intentos. Anti-enumeration: `request-otp` siempre devuelve 200.

### Catálogo público
- `GET /merchants?categoria=&q=` → comercios activos
- `GET /merchants/:slug` → comercio + cupones vigentes
- `GET /coupons?categoria=&merchant=` → cupones activos no vencidos
- `GET /coupons/:id` → detalle

### Activations (vecino)
- `POST /activations` (auth user) `{couponId}` → activación con código de 6 dígitos + QR payload `msp:act:CODE:COUPONID`
- `GET /activations/me?status=` → mis activaciones
- `GET /activations/:id` → detalle (sólo dueño)
- `POST /activations/:id/cancel` → cancela

Activación idempotente: si el usuario ya tiene una activación activa para ese cupón, devuelve la existente. Code generation con retry hasta 3x si colisiona el unique index.

### Redemptions (comercio)
- `POST /redemptions/validate` (auth merchant) `{codigoNumerico}` o `{qrPayload}` → user + cupón
- `POST /redemptions/confirm` (auth merchant) `{activationId, montoTicket?}` → crea Redemption + marca canjeado
- `GET /redemptions/recent?limit=` → últimos canjes
- `GET /redemptions/clientes` → clientes únicos con LTV (canjes, ahorro, ingresos, primer/último)

Validate verifica ownership (cupón ↔ comercio autenticado). 409 si ya canjeado/expirado/cancelado.

### CRUD cupones (comercio)
- `GET /coupons/mine/list` → todos los cupones del comercio
- `POST /coupons` → crear
- `PATCH /coupons/:id` → editar (solo dueño)
- `DELETE /coupons/:id` → eliminar (solo dueño)

### Edit comercio + stats
- `PATCH /merchants/me` → editar perfil propio
- `GET /merchants/me/stats` → `{canjes, ahorroTotal, ingresosTotal, clientesUnicos}`

### Billing (Mercado Pago)
- `POST /billing/preapproval` → crea preapproval con `back_url`, devuelve `init_point`
- `GET /billing/me` → última suscripción
- `GET /billing/return` → endpoint que MP usa como back_url (no muta nada)
- `POST /billing/webhook` → notificaciones de MP. Valida firma HMAC SHA256 con `MP_WEBHOOK_SECRET` (si está configurado). Cuando `status=authorized` activa el comercio.
- `POST /billing/mock-confirm` (sólo dev, auth merchant) → simula pago confirmado

### WhatsApp (`/wa`)
- `GET /status` → estado de la sesión + cupo `{used, max:4, remaining}`
- `POST /start` → inicia sesión, devuelve QR para escanear
- `POST /stop` → cierra sesión
- `POST /send` `{to, text, campaignId?}` → mensaje individual
- `POST /campaign` `{recipients[], text}` → envío masivo (rate-limited a **4 campañas/mes**)
- `GET /campaigns` → historial agrupado por campaignId

## Servicios internos

### `services/jwt.service.ts`
- `signAccessToken(payload)` / `verifyAccessToken(token)`
- `issueRefreshToken({...})` → genera token random 48 bytes, hashea SHA256 en DB
- `rotateRefreshToken(oldToken)` → revoca + emite nuevo. **Detecta reuso de tokens revocados** y revoca toda la cadena del subject.
- `revokeRefreshToken(token)` / `revokeAllForSubject(subjectId)`

### `services/mp.service.ts`
- `createPreapproval({reason, externalReference, payerEmail, amountARS, backUrl})` → POST a MP
- `getPreapproval(id)` → GET detalle
- Si `MP_ACCESS_TOKEN` está vacío, modo MOCK (devuelve init_point falso).

### `services/expiry.service.ts`
- `runExpirySweep()` → marca cupones con `vigenciaHasta < now` como `vencido` y activations con `expiresAt < now` como `expirado`. Idempotente.
- `startExpiryLoop()` → corre al boot + cada 10 min.

### `services/whatsapp.service.ts`
- Singleton in-memory de sesiones por `merchantId`
- `getStatus(id)` / `startSession(id)` / `stopSession(id)` / `sendMessage(id, to, text)`
- Si `whatsapp-web.js` no está instalado, modo stub (loguea sends).

### `services/seed.service.ts`
- `seedIfEmpty()` → al boot, si no hay merchants, siembra 8 comercios + 11 cupones + 3 staff (`demo123`).

## Modelos

| Modelo | Indexes |
|---|---|
| `User` | dni, email, whatsapp (unique each) |
| `Merchant` | slug (unique), `location` (2dsphere) |
| `MerchantUser` | email (unique), merchantId |
| `Coupon` | merchantId+estado, vigenciaHasta |
| `Activation` | codigoNumerico (unique), couponId+userId+status, status+expiresAt |
| `Redemption` | activationId (unique), merchantId+redeemedAt desc, merchantId+userId |
| `RefreshToken` | tokenHash (unique), expiresAt (TTL), subjectId+revokedAt |
| `Otp` | email, expiresAt (TTL 5 min) |
| `Subscription` | merchantId, preapprovalId, externalReference, status |
| `WaSend` | merchantId+sentAt desc, campaignId |

## Deployment

### Railway / Render

```bash
# Railway
railway init
railway link
# Variables → setear MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, etc
railway up

# Render
# 1. Connect repo
# 2. Build: pnpm install && pnpm --filter @misanpedro/api build
# 3. Start: cd apps/api && node dist/index.js
# 4. Env: setear vars
```

### MongoDB Atlas
- Network Access → 0.0.0.0/0 (o IP del provider)
- Database User → SCRAM-SHA-1
- Connect → Drivers → copiar URI

### Mercado Pago
- Crear app en https://www.mercadopago.com.ar/developers/panel
- Copiar **Access Token** + **Public Key** (production)
- Ir a Notifications → Webhooks → agregar URL `https://API_URL/api/v1/billing/webhook`
- Eventos: `subscription_preapproval`, `preapproval`
- Copiar el **Secret** del webhook → `MP_WEBHOOK_SECRET`

### WhatsApp Web (opcional)
```bash
pnpm --filter @misanpedro/api add whatsapp-web.js qrcode-terminal
```
- En el server hostear con sistema con Chromium disponible (apt: `chromium-browser`)
- Persistir `WHATSAPP_SESSIONS_DIR` (volume) para no perder la sesión al redeploy

## Testing manual con curl

```bash
# Health
curl -s http://localhost:3001/api/v1/health | python3 -m json.tool

# Login comercio
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/merchant/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cajero@laesquina.com","password":"demo123"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["accessToken"])')

# Stats
curl -s http://localhost:3001/api/v1/merchants/me/stats \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Listar cupones
curl -s http://localhost:3001/api/v1/coupons/mine/list \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Validar código
curl -s -X POST http://localhost:3001/api/v1/redemptions/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"codigoNumerico":"123456"}' | python3 -m json.tool
```

## Seguridad — checklist pre-prod

- [ ] Rotar `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`
- [ ] Setear `MP_WEBHOOK_SECRET` (sin esto el webhook acepta todo)
- [ ] Setear `RESEND_API_KEY` (sin esto el OTP no llega por email)
- [ ] CORS allowlist real (no `localhost`)
- [ ] HTTPS obligatorio (cookies seguras si se migran)
- [ ] Sentry DSN para alertas
- [ ] Backups Mongo Atlas (built-in en M10+)
- [ ] Rate limiting reverso (Cloudflare / proxy)
