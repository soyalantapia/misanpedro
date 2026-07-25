# PROJECT.MD — Mi Ciudad (`micuidad.com`)

> **La biblia del proyecto.** Un solo documento con TODO: qué es, por qué, cómo está
> armado, cómo se opera, qué se construyó, qué falta y cómo colaborar. Si entrás nuevo
> al equipo, leé esto de punta a punta y vas a tener contexto absoluto.
>
> Para el día a día de desarrollo (setup, comandos, deploy, gotchas) ver
> [`README.md`](README.md) y [`work-agent/`](work-agent/). Este documento es el "porqué"
> y el "qué hay" completo; el work-agent es el "estado vivo".

Última actualización: **2026-07-02**. Estado: **en producción, abriendo a los primeros comercios reales.**

---

## 1. Resumen ejecutivo

**Mi Ciudad** es una plataforma **SaaS marca-blanca, multi-ciudad y multi-país** de
**descuentos vecinales**. Una app donde los vecinos de una ciudad encuentran descuentos en
comercios locales y los activan desde el celular; el comercio los valida en 2 segundos y se
lleva clientes nuevos + los datos de quién le compra.

- **Un solo codebase** sirve a **muchas ciudades**. Cada ciudad es un *tenant* (documento `App`)
  con su nombre, color, moneda, idioma, precio y subdominio (`https://<ciudad>.micuidad.com`).
- Nació como **"Mi San Pedro"** (una ciudad, AR) y se generalizó a **"Mi Ciudad"** (`micuidad.com`).
- **Modelo de negocio:** suscripción mensual del comercio (SaaS B2B2C). Los primeros meses gratis,
  sin tarjeta, sin permanencia. Break-even por ciudad con ~3 comercios.
- **Estado hoy:** en producción. Ciudades vivas: **San Pedro** (Argentina, ARS) y **Mi Nariño**
  (Colombia, COP). Arrancando con los **primeros 3 comercios reales** de San Pedro.

**La tríada de superficies por ciudad + el panel global:**

| Superficie | Quién la usa | URL |
|---|---|---|
| **PWA del vecino** | vecinos: descubren y activan descuentos | `https://<ciudad>.micuidad.com/` |
| **Panel del comercio** | comercios adheridos: validan, gestionan, ven stats | `https://<ciudad>.micuidad.com/#/admin` |
| **Owner (super-admin)** | nosotros: crear/editar ciudades, métricas, soporte | `https://administracion.micuidad.com` |
| **API** | backend de todo | `https://api-production-43c52.up.railway.app/api/v1` |

---

## 2. El producto y el negocio

### 2.1 La tesis
El vecino quiere que **su plata rinda más** en el mandado de todos los días. El comercio de barrio
quiere **clientes nuevos** y dejar de competir solo por precio. Mi Ciudad es el puente: **"el club
de ahorro de la ciudad"**. El ahorro es **concreto y visible** (un % o un precio fijo en comercios
reales), no puntos abstractos.

### 2.2 Narrativa (LOCKED — respetar en todo el copy)
- Tagline: **"El club de ahorro de San Pedro"** · **"Tu plata rinde más"**.
- Decir **"tu ciudad"**, nunca "pueblo".
- **NUNCA** la palabra "fundador". Usar **"comercios" / "comercio adherido" / "los primeros 20 comercios"**.
- Para el vecino: lenguaje de ahorro real ("ahorraste", "vale la pena"), no de marketing vacío.

### 2.3 Los actores
- **Vecino** — descarga la PWA, se registra con nombre + teléfono (sin fricción), busca comercios,
  activa un cupón (obtiene un código de 6 dígitos + QR), lo muestra en la caja.
- **Comercio (cajero/dueño)** — entra al panel con su email (login por código, sin contraseña),
  publica descuentos, valida el código del vecino en 2 segundos, ve sus clientes y estadísticas.
- **Owner (nosotros)** — crea ciudades, edita su config, ve métricas globales (MRR, comercios,
  canjes), gestiona el equipo (multi-admin con roles) y **da soporte entrando al panel de cualquier
  comercio** (modo soporte / impersonación, ver §7.4).

### 2.4 Modelo de negocio y pricing
- **SaaS B2B:** el comercio paga una **suscripción mensual** (precio configurable por ciudad,
  `App.precioMensual`; San Pedro ~$50.000 ARS). El vecino **no paga**.
- **Onboarding:** **3 meses gratis, sin tarjeta, sin permanencia** (free trial; el comercio queda
  activo y visible desde el día 1).
- **Cobro:** MercadoPago (suscripciones/Preapproval). Fase 1 = una cuenta MP global (la de SP);
  Fase 2 = "Conectar MercadoPago/Stripe" por ciudad (OAuth, tokens por tenant). Ver `ESTRATEGIA-PAGOS.md`.
- **Unit economics:** break-even por ciudad ~3 comercios. Wedge = demanda (vecinos); el cuello es
  llenar la app de vecinos para que al comercio le "valga la pena".
- **Referidos:** comercio→comercio (+15 días al referido al publicar su 1er cupón, +7 días al
  referidor, tope 8 semanas).

### 2.5 Go-to-market
- Wedge **vecino-first** + founder-local (San Pedro) + alianza con la Cámara de Comercio + first-mover.
- Lanzamiento San Pedro 2026. Claude actúa como **gerente de marketing / CFO** del proyecto.
- **Onboarding manual de los primeros comercios:** nosotros les armamos la cuenta, los metemos a un
  grupo de WhatsApp ("Mi San Pedro · Comercios"), y les pedimos su primer descuento (el gancho).

---

## 3. Historia / línea de tiempo

| Etapa | Qué pasó |
|---|---|
| **Origen** | "Mi San Pedro": una sola ciudad, sitio en Hostinger + GitHub Pages. |
| **Pivot multi-ciudad** | Se generalizó a "Mi Ciudad" (`micuidad.com`): 1 codebase, datos por `appId`, marca blanca. Panel owner. |
| **Cutover a Railway** | Se migró todo (API + Mongo + fronts) a Railway. `micuidad.com` dejó de usar Hostinger (que quedó solo para el redirect 301 de `misanpedro.com` y el buzón de correo). |
| **Tanda pre-prod (23/06)** | Web Push scoped por appId, URLs por-tenant, owner backend+front, alta del comercio en 3 pasos, CI. |
| **Owner expandido (25/06)** | Auth OTP passwordless, multi-admin con RBAC (super/admin/finanzas/soporte/viewer), auditoría `OwnerAuditLog`, estadísticas en vivo + snapshot diario de MRR. |
| **Emails OTP (26/06)** | Rediseño de los emails de código: template único lindo, branded, con logo/monograma, código fácil de copiar, y **login de un toque** (magic-link). |
| **Onboarding del comercio (26/06)** | En el login, si el email no tiene comercio → redirige al **alta** con el flujo precargado. |
| **QA del canje (26/06)** | Auditoría del "camino del dinero" (canje): backend sólido + 13 tests de integración + e2e completo en prod. Fix de consistencia del ahorro `precio_fijo` (preview del cajero == backend). |
| **Aislamiento multi-tenant (26/06)** | Verificado de 3 formas: empírico en prod, 5 tests de integración, y auditoría de **207 queries → 0 leaks**. |
| **Barrido pre-launch (26/06)** | Bug-hunt de 7 dimensiones: 0 blockers, 5 hardening menores. Veredicto: listo para lanzar. |
| **Modo soporte (27/06)** | Cualquier owner entra al panel de cualquier comercio como el propietario (impersonación) con auditoría. Verificado e2e en prod. |
| **Primeros comercios (27/06)** | Onboarding manual de los 3 primeros comercios reales de San Pedro. |
| **Bug-hunt PM/UX (29/06)** | ~20 bugs de producto fixeados en 5 grupos (rama `fix/bug-hunt-26`): snapshot del cupón en el canje, fechas de vigencia en día local, cupo 0, alertas, polling. Tests 238→268. |
| **Aterrizaje (02/07)** | Auditoría integral → push de todo lo sin respaldo, merge del bug-hunt, deploy a prod, doc sincronizada. |

La auditoría de cada tanda y los reportes están en los `.md` de la raíz y en la memoria del asistente.

---

## 4. Arquitectura del código (monorepo)

`pnpm@10.28.2` workspaces + `turbo`. **Node ≥22** obligatorio. TypeScript estricto.

```
misanpedro/                      (repo: github.com/soyalantapia/misanpedro, rama main)
├── apps/
│   ├── api/             Hono + @hono/node-server + Mongoose (MongoDB). En PROD también
│   │                    sirve los fronts estáticos host-based (un solo servicio Railway).
│   ├── web/             PWA del vecino + panel del comercio (/#/admin). Vite 7 + React 19
│   │                    + Tailwind 4. HashRouter. vite-plugin-pwa (service worker).
│   ├── owner/           Panel super-admin (administracion.micuidad.com). Vite + React.
│   │                    BrowserRouter (base /). SIN service worker.
│   ├── landing/         Marketing del comercio (single-tenant San Pedro, legacy).
│   └── landing-vecino/  Marketing del vecino (single-tenant San Pedro, legacy).
├── packages/
│   └── shared/          @misanpedro/shared — Zod schemas + types + helpers puros
│                        (valor del cupón, límite de uso, legales). Compartido FE/BE…
│                        OJO: el FRONT no importa @misanpedro/shared (convención); la
│                        lógica chica se DUPLICA en el front (ej. calcAhorroCanje en
│                        web/lib/cuponValor.ts, lockeada con los mismos vectores de test).
├── scripts/             brand.mjs (genera la marca), check-no-hardcoded-tenant.mjs
│                        (guardrail), deploy-*.mjs (sitios legacy), e2e-limite-uso.sh.
├── brand/               Logos/isotipos SVG + favicons + lab de marca.
├── infra/               cloudflare-worker-micuidad.js (legacy, ya no se usa).
├── docs/                SPEC-referidos, deploy-railway, onboarding-new-city.
├── work-agent/          Handoff vivo (estado, pendientes, deploy, decisiones, QA).
├── nixpacks.toml        Cómo Railway buildea (un service buildea web+owner+api+landings).
├── railway.json         Config del deploy (start, healthcheck).
└── (raíz)               README.md, PROJECT.MD, CLAUDE.md, y muchos .md de auditorías/estrategia.
```

> **Las `landing*` son single-tenant (San Pedro) y NO se sirven en `micuidad.com`** hoy
> (`misanpedro.com` redirige). No las toca el guardrail multi-tenant.

### El dato no obvio: **un solo servicio de Railway sirve TODO**
`nixpacks.toml` buildea, en un solo build, **web + owner + api + landings**, y el `index.ts`
del API hace **static serving host-based**: `administracion.*` → `apps/owner/dist`, cualquier
otro host → `apps/web/dist`, `/api/*` tiene prioridad, SPA fallback a `index.html`. Por eso un
solo `railway up` deploya **backend + comercio + owner + landings** de una. En dev no se activa
(lo sirve Vite).

---

## 5. Multi-tenancy (el corazón del sistema)

### 5.1 `App` = tenant = ciudad
El modelo `App` (`apps/api/src/models/App.ts`) es el tenant. Campos clave: `slug`, `nombre`
("Mi Nariño"), `ciudad`/localidad ("Nariño"), `provincia`, `pais`, `moneda` (ISO-4217),
`locale` (BCP-47), `phonePrefix` ("+57"), `subdomain`, `customDomain`, `brand{primaryColor,
accentColor, logoUrl, hero*}`, `precioMensual`, `status`, `plan`, `geoCenter{lat,lng}`,
`legal{razonSocial, taxId, taxIdLabel, condicionFiscal, domicilio, jurisdiccion}`, `operator`,
`settings`.

### 5.2 Regla de oro: **todo dato de negocio lleva `appId`**
Llevan `appId` (scoped por ciudad): Coupon, Merchant, MerchantUser, User, Activation, Redemption,
Referral, CustomerNote, PushSubscription, Subscription, Otp, WaSend, SupportCode.
**NO** llevan appId (globales): Owner, RefreshToken, PasswordReset, OwnerAuditLog, **MrrSnapshot** (el
snapshot de MRR agrega todas las ciudades — lleva `mrrByCity[]` adentro, no un `appId`).

### 5.3 Resolución del tenant
- **Backend:** header `X-Tenant-Slug` (o el subdominio del host) → `middleware/tenant.ts`
  (`getAppId(c)`, `findTenantByKey` matchea slug **o** subdomain; `toAsciiLabel` hace punycode
  para la ñ → `minariño` = `xn--minario-9za`). **El `appId` SIEMPRE sale del host/header, NUNCA
  del token** — por eso una sesión de una ciudad no puede tocar otra ni cambiando el token.
- **Frontend** (`apps/web/src/lib/tenant.ts` `detectInitialSlug`): 1) `?tenant=` → 2) **subdominio
  (autoritativo en `*.micuidad.com`)** → 3) localStorage → 4) `VITE_TENANT_SLUG` → 5) fallback
  `sanpedro`. El subdominio gana sobre localStorage.

### 5.4 Branding por ciudad
`applyBrandingToDom` pisa la CSS var `--color-brand` con `brand.primaryColor` en runtime
(single-knob: toda la escala se deriva por `color-mix`). Marca por defecto = **naranja `#ea580c`**.
El **verde `#059669` está RESERVADO** para la semántica de "ahorro", no como color de marca.

### 5.5 Aislamiento — **verificado, 0 leaks**
Los datos de una ciudad NO se ven en otra. Verificado de 3 formas (26/06):
1. **Empírico en prod:** catálogos disjuntos + un token de comercio de una ciudad contra otra → 403.
2. **Test de integración** (`tenant-isolation.integration.test.ts`): 2 apps con datos, comercios+cupones
   no se cruzan, by-id/by-slug cross-tenant → 404, mismo teléfono de vecino en 2 ciudades = usuarios distintos.
3. **Auditoría de código** (workflow): **207 queries** en todas las rutas/servicios → **0 leaks**.
   Excepciones legítimas (no son leaks): owner.ts/ownerStats (dashboard global cross-tenant a propósito,
   con su propia auth), webhook de MercadoPago (resuelve el tenant desde el doc Subscription, no del host).

---

## 6. Modelo de datos (los modelos Mongoose)

`apps/api/src/models/`. Resumen de los principales:

| Modelo | Rol | Scoped |
|---|---|---|
| `App` | el tenant/ciudad (config, marca, moneda, precio, legales) | — (es el tenant) |
| `Merchant` | el comercio adherido (perfil público + fiscal + estado de suscripción) | appId |
| `MerchantUser` | cuenta de login del comercio (email, rol admin/cajero) | appId |
| `User` | el vecino (nombre + teléfono; único `{appId, telefono}`) | appId |
| `Coupon` | el descuento (porcentaje / precio_fijo / 2x1 / happy_hour; stock; límite de uso) | appId |
| `Activation` | el vecino activó un cupón → código de 6 dígitos + QR (estados: activo/canjeado/cancelado) | appId |
| `Redemption` | el canje confirmado (ahorro, montoTicket; índice único `{activationId}` = anti doble-canje) | appId |
| `Referral` | referido comercio→comercio (pending/confirmed) | appId |
| `CustomerNote` | nota privada del comercio sobre un cliente | appId |
| `Subscription` | suscripción MercadoPago del comercio | appId |
| `Otp` | código de un solo uso para login (vecino/comercio/owner) | appId (owner global por purpose) |
| `PushSubscription` | suscripción Web Push del vecino (único `{appId, endpoint}`) | appId |
| `WaSend` | registro de envío de WhatsApp | appId |
| `MrrSnapshot` | foto diaria del MRR (para el dashboard del owner) | — (global) |
| `Owner` | admin del panel de gestión (multi-admin, rol, enabled, TOTP opcional) | — (global) |
| `OwnerAuditLog` | auditoría append-only de TODO lo que hace cada owner (incluye soporte) | — (global) |
| `RefreshToken` | refresh hasheado (vecino/comercio/owner); lleva `impersonatedBy` si es soporte | — (global) |
| `SupportCode` | código de un solo uso del handoff de modo soporte (2 min) | appId |
| `PasswordReset` | reset de password (legacy) | — |

---

## 7. La API y los flujos

`apps/api` — Hono. 15 grupos de rutas bajo `/api/v1/`:
`merchant/auth` · `auth` (vecino) · `merchants` · `coupons` · `activations` · `redemptions` ·
`billing` · `wa` (WhatsApp) · `templates` · `notifications` · `admin` · `owner` · `tenant` ·
`referrals` · `push`.

### 7.1 Autenticación (3 tipos de sesión, todo passwordless por OTP)
JWT firmado (`signAccessToken`). Tres `type` de subject:
- **`user`** (vecino) — login por teléfono (claim sin OTP) o email OTP.
- **`merchant_user`** (comercio) — login OTP al email del comercio; **sesión sin vencimiento**
  (access 1h auto-refresh + refresh "infinito" revocable; el cajero no se desloguea).
- **`owner`** — login OTP passwordless al email del owner; 2FA TOTP cableado pero OFF por decisión.

El **access token** lleva: `sub`, `type`, `merchantId?`, `appId?`, `rol?`, `impersonatedBy?`
(este último solo en modo soporte). El **refresh** es opaco (random hasheado), guardado server-side
(revocable). El owner re-chequea `enabled` y el comercio re-chequea estado en cada `/refresh`.

### 7.2 El camino del dinero — el CANJE (auditado, sólido)
El corazón del producto (`redemptions.ts`). El vecino activa un cupón → código de 6 dígitos; el
cajero lo **valida** (`POST /redemptions/validate`) y lo **confirma** (`POST /redemptions/confirm`,
con el monto del ticket opcional). Invariantes blindados (13 tests de integración):
- **Ahorro correcto:** `calcAhorroCanje` (función pura compartida): `%` del ticket, o `ticket − precioFijo`
  para precio_fijo, o desde `precioReferencia` si no se tipea monto. El **preview del cajero usa la
  MISMA fórmula** que persiste el backend (se arregló una divergencia en precio_fijo).
- **No doble-canje:** Redemption se crea PRIMERO; su índice único `{activationId}` es el guard. Concurrente: solo 1 gana.
- **No oversell:** claim atómico de stock (`$inc` condicional a `stockUsado < stockMaximo`).
- **Compensación:** si el cierre falla con el Redemption ya creado, revierte (Mongo standalone = sin transacciones).
- **Rechazos:** vencido / pausado / agotado / cupón de otro comercio (403) / límite por persona.

### 7.3 Onboarding del comercio
En el login del comercio, si el email **no tiene un comercio** en esa ciudad → redirige al alta
(`/admin/registro?email=…&nuevo=1`) con el email precargado y un banner "tu email no tiene un comercio
creado, pero crealo en segundos". El alta es de 3 pasos (Comercio / Contacto / Cuenta), con draft en
localStorage **scopeado por email** (dos altas en pestañas distintas no se pisan). El `request-otp`
devuelve `registered:false/true` (cambio deliberado del anti-enumeración: los comercios son públicos).

### 7.4 Modo soporte (impersonación owner→comercio)
Cualquier owner entra al panel de cualquier comercio **como el propietario**, para soporte técnico,
con **auditoría silenciosa** (el comercio no se entera). Flujo:
1. Panel owner → botón "Soporte" → `POST /owner/merchants/:id/support-session` (chequea `Owner.enabled`)
   genera un **código de un solo uso** (`SupportCode`, randomBytes 32, 2 min).
2. Abre `{ciudad}.micuidad.com/#/admin/soporte?code=…` → `POST /merchant/auth/support-exchange`
   canjea el código por una sesión.
3. El token lleva `sub = MerchantUser admin` (TODO se atribuye al propietario) + `impersonatedBy = id del owner`
   (el rastro). El refresh guarda `impersonatedBy` y lo re-inyecta en cada access (sesión sin vencimiento,
   revocable con `revoke-support`). Soporte puede operar comercios suspendidos.
4. **Auditoría:** el middleware `auditImpersonation` (montado en `/api/v1/*`) loguea en `OwnerAuditLog`
   **cada mutación** hecha con `impersonatedBy` (quién entró + qué comercio). Verificado e2e en prod.
5. **Banner violeta** "Modo soporte · estás dentro de [comercio] como el propietario · Salir" visible
   en todo el panel (incluida la página de confirmar canje).

### 7.5 Emails transaccionales
`email.service.ts` — transporte GLOBAL nodemailer SMTP (`soporte@micuidad.com` en Hostinger,
`smtp.hostinger.com:465`), fallback Resend. Lo único per-tenant es el display name. Template ÚNICO
lindo (`renderOtpEmail`) para los 3 logins (vecino/comercio/owner): logo de marca o monograma, código
grande fácil de copiar, "vence en 5 minutos", y **botón de un toque** (magic-link que entra directo con
el código precargado). DNS de email TODO correcto (SPF + DKIM `hostingermail-a/-b/-c` + DMARC), llega al inbox.

### 7.6 Owner (super-admin)
`administracion.micuidad.com` (`apps/owner`). Auth OTP passwordless. Multi-admin con **RBAC**
(super/admin/finanzas/soporte/viewer). Crear/editar ciudades (wizard con localidad, país→moneda/locale/prefijo,
precio, color, geoCenter, legales). Métricas en vivo (MRR multi-moneda, comercios, canjes) + snapshot
diario. Sección Equipo. **Auditoría completa** (`OwnerAuditLog` + `GET /owner/audit`). Botón de **soporte**
por comercio. Suspender/reactivar comercios y suscripciones.

---

## 8. Frontends

- **`apps/web`** (PWA vecino + panel comercio). Vite 7 + React 19 + Tailwind 4 + React Router 7.
  **HashRouter** (las rutas viven tras el `#`). `vite-plugin-pwa` con service worker (Workbox).
  Vecino: explorar comercios (mapa Leaflet, filtros), activar cupón (código + QR), "club"/gamificación
  (`SavingsWallet`), Web Push, "armá tu plan". Comercio (`/#/admin`): dashboard, validar/confirmar canje,
  cupones (crear/editar), clientes (export, WhatsApp), estadísticas, comercio (micro-sitio).
- **`apps/owner`** (panel super-admin). Vite + React. **BrowserRouter** (base `/`). Sin service worker.
- **`apps/landing` / `apps/landing-vecino`** — marketing single-tenant San Pedro (legacy; en
  `micuidad.com` se sirven host-based en `/comercios` y `/vecino`).

**Convención clave del front:** **no importa `@misanpedro/shared`** — la lógica compartida chica se
**duplica** en el front (con comentario al canónico y los mismos vectores de test). Ej.
`calcAhorroCanje` está en `apps/web/src/lib/cuponValor.ts` y en `packages/shared/src/valor.ts`.

---

## 9. Infraestructura y deploy

### 9.1 Railway — proyecto `misanpedro-api`
- Servicio **`api`**: corre Hono y, en prod, **sirve también los fronts** (host-based).
- Servicio **MongoDB** (interno). **La DB de prod es INTERNA a Railway → no se alcanza desde local.**
  Seeds/migraciones corren al boot dentro de Railway.
- Dominio: `api-production-43c52.up.railway.app` + custom `*.micuidad.com` (SSL wildcard vía `_acme-challenge`).

### 9.2 Cloudflare — zona `micuidad.com`
- `*` CNAME → `8g2u10nn.up.railway.app` (**DNS-only / nube gris**) → todo subdominio va a Railway.
- `_acme-challenge` + `_railway-verify` para el SSL wildcard.
- Email: MX mx1/mx2.hostinger.com, SPF, DKIM ×3 (hostingermail-a/-b/-c), DMARC.
- El Worker viejo (Cloudflare→Hostinger) fue **eliminado**.

### 9.3 Hostinger — solo legacy + buzón
- `misanpedro.com` → `.htaccess` redirige **301** todo a `sanpedro.micuidad.com`.
- Buzón `soporte@micuidad.com` (el SMTP del API).

### 9.4 Deploy (un comando)
```bash
railway up --detach --environment production --service api
```
Sube el **working tree** (no el commit), buildea web+owner+api+landings con nixpacks, y arranca.
Healthcheck `/api/v1/health`; si falla, Railway mantiene el deploy anterior. Confirmar live = pollear
`uptime` hasta que resetee. **Gotcha del poll:** el `uptime` resetea a ~0 en el deploy nuevo; no asumir
que el baseline es alto.

### 9.5 Variables de entorno (servicio `api`, env `production`)
Core: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV`, `PORT`, `TRUST_PROXY`.
Email: `SMTP_HOST/PORT/USER/PASSWORD/SECURE`, `EMAIL_FROM`, `RESEND_API_KEY`, `SUPPORT_EMAIL`.
Pagos: `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`, `PLAN_AMOUNT_ARS`.
Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
Owner/URLs/otros: `OWNER_BOOTSTRAP_EMAIL/PASSWORD/NOMBRE`, `OWNER_APP_URL`, `APP_URL_FRONT`,
`APP_URL_API`, `SENTRY_DSN`, `CORS_ORIGINS`, `SUPER_ADMIN_TOKEN`, `SUPPORT_WHATSAPP`, `WHATSAPP_SESSIONS_DIR`.
> **Nunca** poner valores reales en docs/commits. El asistente no ingresa secretos a Railway.

---

## 10. Seguridad

- **Aislamiento multi-tenant:** verificado (§5.5). El `appId` sale del host, nunca del token.
- **AuthZ a nivel objeto (IDOR):** las mutaciones por `:id` chequean ownership (ej. un comercio no
  puede editar el cupón de otro; `coupon.merchantId === auth.merchantId → 403`). Verificado.
- **Sin fuga de PII:** el catálogo público (`serializeMerchantPublic`/`serializeCoupon`) no expone
  cuit/fiscal/email/referralCode ni campos privados (costoReferencia/objetivo).
- **Rate-limiting:** OTP, signup, validate, confirm, support, owner login.
- **OTP atómico:** el consumo es `findOneAndUpdate({consumedAt:null})` (anti-replay + anti-carrera).
- **Inyección:** todo input pasa por Zod; el `$regex` de búsqueda se escapa (anti regex-DoS).
- **Modo soporte:** código one-time alta-entropía scoped por appId; chequea `Owner.enabled`; auditoría
  de cada mutación; sesión revocable.
- **Owner:** RBAC por rol; 2FA TOTP cableado (OFF por decisión); rate-limit; auditoría append-only.

---

## 11. Calidad y testing

- **269 tests** (vitest: 130 api + 139 web): `apps/api` (integración con Mongo en memoria + JWT minteado) + `apps/web`
  (schemas, guardrail, lógica). Correr todo: `pnpm turbo run test` (OJO: `pnpm test` a secas no corre nada).
  CI en `.github/workflows/ci.yml` (install + typecheck + check:tenant + tests api/web por filtro).
- **Suites de integración clave:** `redemptions` (canje/dinero), `tenant-isolation` (multi-tenant),
  `support` (modo soporte), `merchant-auth` (login/onboarding).
- **Metodología de QA del asistente:** bug-hunt adversarial multi-agente (finders por dimensión →
  verificación escéptica que refuta por default) + verificación EMPÍRICA en prod (e2e con scripts) +
  auditorías de código (ej. 207 queries para el aislamiento). Lo verificado se documenta y se lockea con tests.
- **Guardrail `check:tenant`** (`scripts/check-no-hardcoded-tenant.mjs`): falla el build/tests si reaparece
  un nombre de ciudad hardcodeado en `web`/`owner`.

---

## 12. Convenciones y gotchas (las que ya nos mordieron)

1. **Service Worker de la PWA.** Tras un deploy, el navegador puede servir el **bundle viejo** cacheado.
   Para testear un deploy nuevo en browser: desregistrar el SW + limpiar caches (`navigator.serviceWorker
   .getRegistrations()→unregister()` + `caches.keys()→delete()`), o hard refresh. El owner NO tiene SW.
2. **Build del API = esbuild, no tsc.** `typecheck` (tsc -b) EMITE y pisa `dist/` con `@/` sin resolver.
   Si corrés el bundle local, reconstruí con `pnpm --filter @misanpedro/api build` (no typecheck después).
3. **Prod Mongo interno a Railway** → no se alcanza desde local. Cambios de datos: panel owner o `SEED_CITY_JSON`.
4. **El front NO importa `@misanpedro/shared`** → la lógica chica se duplica (con tests espejo).
5. **iCloud rompe el build.** Los archivos reales viven en `~/dev/misanpedro` (+ symlink en
   `~/Desktop/Programacion/misanpedro`); Desktop = iCloud rompe esbuild/rollup/lightningcss.
6. **El MCP de Gmail corrompe los `=` (quoted-printable)** en el body que devuelve — el email real está OK.
7. **Este repo SÍ permite push a `main`** (es propio). La regla "nunca a main" es para los repos de Deenex.

(Detalle completo en [`work-agent/02-DEPLOY-Y-GOTCHAS.md`](work-agent/02-DEPLOY-Y-GOTCHAS.md).)

---

## 13. Estado actual + roadmap

### En vivo y sólido
Plataforma multi-ciudad (San Pedro + Nariño), camino del dinero auditado, aislamiento verificado,
emails lindos, onboarding del comercio, owner con RBAC + auditoría + estadísticas, modo soporte. 269 tests.

### Pendientes (ver `work-agent/01-PENDIENTES.md`)
- **Pasos del usuario (no código):** rotar la password del buzón SMTP (higiene) · domicilio fiscal de SP ·
  verificar las claves VAPID en Railway · activar **MercadoPago AR ~2 semanas antes del 1er vencimiento de
  trial (~mediados de septiembre)** · MercadoPago Colombia cuando Nariño tenga comercios. (Nariño geoCenter ya
  cargado; el owner es passwordless por OTP desde el 25/06.)
- **Fase 2 de pagos:** "Conectar MercadoPago/Stripe" por ciudad (OAuth, tokens por tenant) — cuando cobre
  la 2da ciudad. Ver `ESTRATEGIA-PAGOS.md`.
- **Refactors diferidos:** promover schemas owner/billing a `shared`, manifest PWA por-host (server-side).
- **WhatsApp:** el envío por `whatsapp-web.js` está cableado pero no puede levantar Chromium en Railway
  (aviso "en activación" en la UI); decidir activarlo (chromium + volumen) o dejarlo así.

### Definición de "listo para cobrar una ciudad nueva"
Crearla en el owner (nombre/localidad/país/precio/geoCenter), que resuelva su subdominio (automático por
el wildcard), email andando (`SMTP_PASSWORD`), y el medio de pago del país (MP AR hoy; MP CO / Stripe = Fase 2).

---

## 14. Cómo colaborar (varios devs)

1. **Leé esto + [`README.md`](README.md) + [`work-agent/`](work-agent/)** (en ese orden de profundidad).
2. **Node 22 + pnpm.** `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` · `pnpm install` · `pnpm dev`.
3. **Trabajá contra la DB de Atlas (dev)**, no la de prod (interna). Probá un tenant con `?tenant=narino`.
4. **Antes de pushear:** `pnpm typecheck` · `pnpm turbo run test` · `pnpm check:tenant`.
5. **Convenciones:** todo lo que se muestre sale del tenant (nunca hardcodear ciudad); respetá la narrativa
   LOCKED; el front no importa `shared`; verde = ahorro, no marca.
6. **Deploy:** `railway up …` (un comando deploya todo). Verificá el `uptime` + un smoke en prod.
7. **El work-agent es la fuente de verdad viva** — actualizalo cuando shippees algo grande.

---

*Documento mantenido por el equipo. Para el estado vivo y los pendientes del día, el work-agent manda.*
