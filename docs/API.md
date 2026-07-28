# API Reference — Mi Ciudad

Referencia de la API HTTP (`apps/api`, Hono). Extraída del código real de `apps/api/src/routes/`.
Contexto y flujos: [`../PROJECT.MD`](../PROJECT.MD) §7. Modelo de datos: [`DATA-MODEL.md`](DATA-MODEL.md).

## Convenciones

- **Base URL:** `https://api.micuidad.com/api/v1` (alias `https://api-production-43c52.up.railway.app/api/v1`).
  Las rutas por-ciudad también responden en `https://<ciudad>.micuidad.com/api/v1`.
- **Tenant:** salvo `owner`/`admin`/`tenant`, todo endpoint resuelve la ciudad por el **host** o el
  header **`X-Tenant-Slug: <slug>`** (ej. `sanpedro`). El `appId` sale del host/header, **nunca del token**.
- **Auth:** `Authorization: Bearer <accessToken>`. Tipos de sesión:
  - **público** — sin token.
  - **requireUserAuth** — vecino (`type=user`).
  - **requireMerchantAuth** — comercio (`type=merchant_user`); **requireMerchantActive** además exige
    que el comercio no esté suspendido/cancelado.
  - **requireOwnerAuth** (+ **requireOwnerRole(...)** para RBAC) — owner (`type=owner`).
  - **requireSuperAdmin** — header `x-admin-token` (token de servicio, panel admin legacy).
- **Middleware global:** `requestId`, `securityHeaders`, `httpsRedirect`, `logger`, CORS (origin-aware
  + wildcard de subdominios). El de impersonación (`auditImpersonation`) audita cada mutación en modo soporte.
- **Health (sin tenant):** `GET /api/v1/health` · `/health/live` · `/health/ready`.

---

## `/api/v1/merchant/auth` — login del comercio (OTP passwordless)

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| POST | `/signup` | público · 3/h | Crea comercio + usuario admin, devuelve tokens |
| POST | `/request-otp` | público · 5/h | Envía código OTP al email (devuelve `registered:true/false`) |
| POST | `/verify-otp` | público · 10/min | Verifica OTP → access + refresh |
| POST | `/refresh` | público | Renueva el access con un refresh válido |
| POST | `/support-exchange` | público · 20/min | Canjea un código de soporte (one-time) por una sesión impersonada |
| POST | `/logout` | público | Revoca el refresh enviado |
| POST | `/logout-all` | requireMerchantAuth | Revoca todas las sesiones del usuario |
| GET | `/me` | requireMerchantAuth | Info del usuario + comercio autenticado |

## `/api/v1/auth` — login del vecino

| Método | Path | Auth | Qué hace |
|---|---|---|---|
La identidad del vecino es el **email**. El alta de una cuenta nueva NO pide código (sería fricción en
el mostrador y crear la cuenta propia no ataca a nadie); el código de 6 dígitos aparece sólo cuando el
email **ya existe**, que es el caso "me cambié de celular" — y es donde estaba el agujero (S1-01).

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| POST | `/claim` | público · 30/h (+5/h si manda mail) | Email nuevo → crea y devuelve sesión. Email existente → **NO** da sesión: manda código y responde `needsCode` |
| POST | `/request-otp` | público · 5/h | Manda el código al vecino que ya tiene cuenta ("Entrar desde mi cuenta") |
| POST | `/verify-otp` | público · 10/min | Canjea el código por sesión (access + refresh) |
| POST | `/refresh` | refresh token | Renueva el access. No rota el refresh (a propósito) |
| POST | `/logout` | refresh token | Cierra la sesión de ese dispositivo |
| POST | `/logout-all` | requireUserAuth | Cierra la sesión en TODOS los dispositivos → `{revoked}` |
| GET | `/sessions` | requireUserAuth | Dispositivos con sesión abierta (pantalla de Perfil) |
| GET | `/me` | requireUserAuth | Info del vecino |
| GET | `/me/data-export` | requireUserAuth | Exporta los datos personales del vecino |
| DELETE | `/me` | requireUserAuth | Borra la cuenta del vecino (anonimiza) |

## `/api/v1/merchants` — comercios

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| GET | `/` | público | Lista comercios activos del tenant (filtros categoría/búsqueda) |
| GET | `/:slug` | público | Detalle público de un comercio + cupones activos |
| GET | `/me/profile` | requireMerchantAuth | Perfil completo del comercio (incl. fiscal) |
| PATCH | `/me` | requireMerchantAuth | Edita el perfil (nombre, dirección, logo, redes, fiscal) |
| GET | `/me/stats` | requireMerchantAuth | Métricas rápidas (canjes, ahorro, ingresos, clientes) |
| GET | `/me/stats/asesor` | requireMerchantAuth | Estadísticas por período (mes/7d/todo) |

## `/api/v1/coupons` — cupones

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| GET | `/` | público | Lista cupones activos y vigentes del tenant |
| GET | `/:id` | público | Detalle de un cupón |
| GET | `/mine/list` | requireMerchantAuth | Cupones del comercio autenticado |
| POST | `/` | requireMerchantAuth + Active | Crea cupón (dispara referral + web push) |
| PATCH | `/:id` | requireMerchantAuth + Active | Edita cupón (ownership) |
| DELETE | `/:id` | requireMerchantAuth + Active | Borra cupón (ownership) |

## `/api/v1/activations` — activaciones del vecino

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| POST | `/` | requireUserAuth | El vecino activa un cupón → código único + QR |
| GET | `/me` | requireUserAuth | Activaciones del vecino (filtro por status) |
| GET | `/:id` | requireUserAuth | Detalle de una activación (ownership) |
| POST | `/:id/cancel` | requireUserAuth | Cancela una activación en curso (ownership) |

## `/api/v1/redemptions` — canje (el camino del dinero)

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| POST | `/validate` | requireMerchantAuth + Active · 60/min | Valida el código/QR → datos para confirmar |
| POST | `/confirm` | requireMerchantAuth + Active · 60/min | Confirma el canje (stock atómico + crea Redemption) |
| GET | `/recent` | requireMerchantAuth | Últimos canjes (hasta 200) |
| GET | `/clientes` | requireMerchantAuth | Clientes únicos + métricas (canjes, ahorro, visitas) |
| GET | `/clientes/:userId/notes` | requireMerchantAuth | Notas internas sobre un cliente |
| POST | `/clientes/notes` | requireMerchantAuth | Crea una nota interna |
| DELETE | `/clientes/notes/:id` | requireMerchantAuth | Borra una nota (ownership del creador) |

## `/api/v1/billing` — suscripciones (MercadoPago)

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| POST | `/webhook` | público (firma MP) | Webhook de MP → actualiza la suscripción |
| GET | `/return` | público | Landing de retorno post-pago |
| POST | `/preapproval` | requireMerchantAuth | Crea suscripción → redirige a MP |
| GET | `/me` | requireMerchantAuth | Suscripción activa del comercio |
| POST | `/cancel` | requireMerchantAuth | Cancela la suscripción |
| POST | `/mock-confirm` | requireMerchantAuth | Confirma pago sin MP (solo si no hay `MP_ACCESS_TOKEN`) |

## `/api/v1/wa` — WhatsApp del comercio

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| GET | `/stream` | token en query + requireMerchantAuth | SSE: estado/QR de la sesión |
| GET | `/status` | requireMerchantAuth | Estado + quota de campañas |
| POST | `/start` | requireMerchantAuth + Active | Inicia sesión (genera QR) |
| POST | `/stop` | requireMerchantAuth | Detiene la sesión |
| POST | `/send` | requireMerchantAuth + Active | Envía un mensaje individual |
| POST | `/campaign` | requireMerchantAuth + Active | Campaña masiva (máx 4/mes) |
| GET | `/campaigns` | requireMerchantAuth | Últimas 50 campañas |

## `/api/v1/templates` · `/api/v1/notifications` · `/api/v1/push`

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| GET | `/templates/coupons/:categoria` | público | Templates de cupones por rubro |
| GET | `/notifications/stream` | token en query + requireMerchantAuth | SSE: notificaciones en vivo del comercio |
| GET | `/push/vapid-public` | público | Clave pública VAPID |
| POST | `/push/subscribe` | público | Suscribe el browser a push (por categoría) |
| POST | `/push/unsubscribe` | público | Desuscribe el browser |

## `/api/v1/referrals` — referidos comercio→comercio

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| GET | `/me` | requireMerchantAuth | Código de referido + stats (pendientes/confirmados) |
| GET | `/mine` | requireMerchantAuth | Lista de referidos del comercio |

## `/api/v1/tenant` — config de ciudad (público)

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| GET | `/:slug/config` | público | Config del tenant (branding, geo, pricing) |
| GET | `/` | público | Lista de tenants activos |

## `/api/v1/owner` — super-admin (cross-tenant, OTP + RBAC)

Roles: `super`, `admin`, `finanzas`, `soporte`, `viewer`.

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| POST | `/auth/request-otp` | público · 5/h | OTP al email del owner |
| POST | `/auth/verify-otp` | público · 10/min | Verifica OTP → tokens de owner |
| POST | `/auth/refresh` | público | Renueva el access (rota el refresh) |
| POST | `/auth/logout` | público | Revoca el refresh |
| GET | `/me` | requireOwnerAuth | Info del owner logueado |
| GET | `/me/audit` | requireOwnerAuth | Sus últimas 20 acciones |
| GET | `/admins` | super | Lista de administradores |
| POST | `/admins` | super | Invita un admin (OTP) |
| PATCH | `/admins/:id` | super | Cambia rol / habilita-deshabilita |
| DELETE | `/admins/:id` | super | Soft-delete (revoca sesiones) |
| GET | `/audit` | super, admin | Auditoría completa paginada (filtros) |
| GET | `/metrics` | requireOwnerAuth | KPIs globales (apps, comercios, usuarios, MRR) |
| GET | `/stats` | requireOwnerAuth | Estadísticas en vivo (sin MRR si rol=soporte) |
| GET | `/stats/mrr-trend` | super, admin, finanzas, viewer | Tendencia de MRR (90 días) |
| GET | `/apps` | requireOwnerAuth | Lista de apps/ciudades + KPIs |
| POST | `/apps` | super, admin | Crea una ciudad |
| GET | `/apps/:id` | requireOwnerAuth | Detalle de una ciudad |
| PATCH | `/apps/:id` | super, admin | Edita una ciudad (marca, legales, geo) |
| GET | `/apps/:id/metrics` | requireOwnerAuth | KPIs de una ciudad |
| GET | `/merchants` | requireOwnerAuth | Comercios cross-app (filtros) |
| PATCH | `/merchants/:id` | super, admin, soporte | Suspende/reactiva un comercio |
| POST | `/merchants/:id/support-session` | requireOwnerAuth · 30/min | **Genera el código de modo soporte** |
| POST | `/merchants/:id/revoke-support` | requireOwnerAuth | Revoca las sesiones de soporte del comercio |
| GET | `/users` | requireOwnerAuth | Vecinos cross-app (búsqueda) |
| GET | `/subscriptions` | super, admin, finanzas, viewer | Suscripciones (filtros) |
| PATCH | `/subscriptions/:id` | super, admin, finanzas | Pausa/cancela/reactiva una suscripción |
| GET | `/activations/active` | requireOwnerAuth | Conteo de activaciones en curso (debug) |

## `/api/v1/admin` — panel admin legacy (token de servicio)

| Método | Path | Auth | Qué hace |
|---|---|---|---|
| GET | `/metrics` | requireSuperAdmin | Métricas globales |
| GET | `/merchants` | requireSuperAdmin | Lista de comercios (filtros) |
| GET | `/merchants/:id` | requireSuperAdmin | Historial completo de un comercio |
| PATCH | `/merchants/:id/estado` | requireSuperAdmin | Cambia el estado de un comercio |
| POST | `/merchants/:id/refund` | requireSuperAdmin | Marca para refund (manual en MP) |

> El panel **owner** (con OTP + RBAC) es el que usamos hoy; `admin` es anterior y se opera con un token de servicio.
