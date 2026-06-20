# Estrategia de pagos — multi-ciudad / multi-proveedor

Cada ciudad cobra con **su propia cuenta** y, si está en otro país, con **otro proveedor**
(MercadoPago en AR; Stripe en CO/otros). Modelo elegido: **"Conectar MercadoPago/Stripe"
tipo OAuth** (como Stripe Connect) — el operador conecta su cuenta con un botón y la
plataforma cobra en su nombre.

## Estado hoy (single-account, global)
- `mp.service.ts` usa UNA cuenta MP global vía env `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` /
  `MP_WEBHOOK_SECRET`. Suscripción recurrente (MP preapproval). Sin token → **modo mock**.
- El modelo `App` NO tiene config de pagos. `Subscription` tiene `amountARS` + `currency`.

## Fase 1 — San Pedro YA (cero código)
Mientras solo San Pedro cobra, el token "global" del env ES el de San Pedro. Pasos (usuario,
son secretos → van en Railway, no pasan por el asistente):
1. Cuenta MP de San Pedro (la que recibe la plata).
2. MP Developers → Crear aplicación (Suscripciones) → Access Token + Public Key de PRODUCCIÓN.
3. Webhook: URL `https://api-production-43c52.up.railway.app/api/v1/billing/webhook`, evento
   `preapproval`; copiar el secret de firma.
4. Railway (service api, prod): `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`.
5. (Bloqueante aparte: `RESEND_API_KEY` para que el comercio reciba el OTP y pueda suscribirse.)
Regla: con esto, una 2da ciudad que cobre usaría la MISMA cuenta → Fase 1 = solo San Pedro.

## Fase 2 — "Conectar MercadoPago/Stripe" por ciudad (cuando cobre la 2da)
### Modelo de datos
`App.payment = { provider: 'mercadopago' | 'stripe' | 'none', status: 'disconnected' |
'connected', mpUserId?, accessToken?, refreshToken?, tokenExpiresAt?, publicKey?,
webhookSecret?, connectedByOwnerId?, connectedAt? }`. Tokens **encriptados at-rest**
(la DB de prod es interna, pero igual ciframos el access/refresh).

### Flujo OAuth (MercadoPago)
1. Plataforma registrada como app MP con OAuth (CLIENT_ID/CLIENT_SECRET + redirect_uri).
2. Panel owner → ciudad → botón **"Conectar MercadoPago"** → redirige a
   `auth.mercadopago.com/authorization?client_id=...&response_type=code&platform_id=mp&redirect_uri=...&state=<appId firmado>`.
3. El operador autoriza → MP vuelve con `code` a nuestro endpoint → backend hace
   `POST /oauth/token` (code → access_token + refresh_token + user_id + expires) → guarda en
   `App.payment` con connectedBy/connectedAt → status `connected` → el panel muestra
   **"MercadoPago conectado"** (mp_user_id, fecha, quién).
4. Refresh automático del token antes de que expire (cron/lazy).

### Cobro por ciudad
`billing.ts` deja de usar el env global: lee `tenant.payment` → elige el proveedor →
crea el preapproval/charge con el token de ESA ciudad. El webhook se rutea por ciudad
(el `externalReference` ya lleva el slug) y verifica con el secreto de esa ciudad.

### Stripe (Colombia / otros)
Mismo patrón con **Stripe Connect** (OAuth): botón "Conectar Stripe", `account_id` + tokens
en `App.payment`, charges con `stripe_account`. Abstracción `PaymentProvider`
(crearSuscripción / verificarWebhook / parseWebhook) con impl MercadoPago y Stripe; el
billing elige según `tenant.payment.provider`.

### Pendientes de la Fase 2
- App registrada en MP con OAuth + redirect_uri (administracion.micuidad.com / endpoint API).
- Cuenta/empresa Stripe para Colombia (Stripe opera en CO).
- Encriptación de tokens en DB. Refresh de tokens. Webhook por-cuenta.
- Migrar San Pedro del env global a su conexión OAuth (re-conectar con el botón).
