# 00 · Estado actual y arquitectura

## 1. Qué es

**Mi Ciudad** (`micuidad.com`) es una plataforma **marca-blanca, multi-ciudad y
multi-país** de descuentos vecinales. Un mismo codebase sirve a muchas ciudades; cada
ciudad es un **tenant** (documento `App`) con su nombre, color, moneda, idioma, precio y
subdominio. Tres superficies por ciudad + un panel global:

| Superficie | Quién la usa | URL |
|---|---|---|
| **PWA del vecino** | vecinos (ver/canjear descuentos) | `https://<ciudad>.micuidad.com/` |
| **Panel del comercio** | comercios adheridos | `https://<ciudad>.micuidad.com/#/admin` |
| **Owner (super-admin)** | vos (crear/editar ciudades, métricas) | `https://administracion.micuidad.com` |
| **API** | backend de todo | `https://api-production-43c52.up.railway.app/api/v1` |

Origen: empezó como "Mi San Pedro" (una sola ciudad) y se generalizó. Ciudades vivas hoy:
**San Pedro** (AR/ARS) y **Mi Nariño** (Colombia/COP).

## 2. Dónde estamos HOY (todo en vivo salvo lo del doc 01)

- ✅ Plataforma multi-ciudad funcionando: cualquier `<ciudad>.micuidad.com` resuelve y sirve la PWA con SSL válido. San Pedro + Nariño en prod.
- ✅ **Front + API + Mongo, todo en Railway** (se migró desde Hostinger; ver §4). `micuidad.com` ya **no** usa Hostinger.
- ✅ `misanpedro.com` (dominio viejo) **redirige 301** a `sanpedro.micuidad.com` (San Pedro quedó centralizado en la plataforma).
- ✅ Aislamiento por ciudad verificado (cada query filtra por `appId`).
- ✅ Multi-país: moneda/locale/teléfono/legales por país; Nariño cobra en COP, formatos es-CO.
- ✅ Email transaccional por **SMTP** (nodemailer) con `soporte@micuidad.com` — **FUNCIONANDO en prod** (verificado 02/07: el OTP responde 200; DNS MX/SPF/DKIM/DMARC OK). Pendiente solo rotar la password del buzón (higiene, ver doc 01 §B).
- ✅ Login del comercio rediseñado (claro/premium, sin mockup). Registro del comercio en layout split (form + banner con mockup).
- ✅ Owner captura por ciudad: nombre, **localidad**, país→(moneda/locale/**prefijo telefónico** auto), **precio mensual**, color, **geoCenter (lat/lng)**, datos legales.
- ✅ Guardrail anti-"Mi San Pedro" hardcodeado (falla el build/tests si reaparece).
- ✅ **Owner expandido (Fases 1-4):** auth OTP passwordless, **multi-admin con RBAC** (super/admin/finanzas/soporte/viewer) + sección Equipo, **auditoría completa** (`OwnerAuditLog` + `GET /owner/audit`), **estadísticas en vivo** + snapshot diario de MRR.
- ✅ **Emails OTP rediseñados:** template único lindo/branded (logo + código copiable + **login de un toque** magic-link) para los 3 logins. DNS de email todo correcto, llega al inbox.
- ✅ **Onboarding del comercio:** en el login, email sin comercio → redirige al **alta** con el flujo precargado (draft localStorage scopeado por email).
- ✅ **Camino del dinero (canje) auditado:** claim atómico anti-oversell + índice único anti doble-canje + compensación; preview del cajero == backend (fix `precio_fijo`). **13 tests de integración.**
- ✅ **Aislamiento multi-tenant verificado** de 3 formas: empírico en prod + 5 tests de integración + auditoría de código (207 queries → **0 leaks**).
- ✅ **Modo soporte (impersonación owner→comercio):** cualquier owner entra al panel de cualquier comercio como el propietario, con auditoría de cada mutación + banner siempre visible. Verificado e2e en prod. (Ver doc 03 §18 + `PROJECT.MD` §7.4.)
- ✅ **Barrido pre-launch** (bug-hunt 7 dimensiones): 0 blockers, 5 hardening menores. **Veredicto: listo para lanzar.**
- ✅ Arrancando con los **primeros 3 comercios reales** de San Pedro (onboarding manual).
- ✅ **Bug-hunt PM/UX 29/06 + aterrizaje 02/07 EN PROD:** ~20 bugs de producto fixeados (rama
  `fix/bug-hunt-26` mergeada ff a main) — lo gordo: **snapshot del cupón en el canje** (cupón
  borrado/pausado no rompe historial/LTV), fechas de vigencia en día LOCAL (no UTC), cupo 0,
  alertas (dedup/contador/race), polling del cupón activo. Detalle en doc 01 (tanda de arriba).
- 🟡 Quedan **pasos manuales del usuario** (rotar password del buzón, limpiar comercios de prueba
  del catálogo, domicilio fiscal SP, VAPID, MP con trigger) → **doc 01 §B**.

## 3. Arquitectura del código (monorepo)

`pnpm@10.28.2` workspaces + `turbo`. Node ≥22. TypeScript estricto.

```
misanpedro/
├── apps/
│   ├── api/             Hono + @hono/node-server + Mongoose (MongoDB). En prod
│   │                    TAMBIÉN sirve los fronts estáticos (host-based, ver §4).
│   ├── web/             PWA del vecino + panel del comercio (/#/admin). Vite + React 19 +
│   │                    Tailwind 4. HashRouter. vite-plugin-pwa (service worker).
│   ├── owner/           Panel super-admin. Vite + React. BrowserRouter (base /).
│   ├── landing/         Marketing del comercio (single-tenant San Pedro, legacy).
│   └── landing-vecino/  Marketing del vecino (single-tenant San Pedro, legacy).
└── packages/
    └── shared/          Types + Zod schemas + helpers (valor, usageLimit).
```

> Las **landing\*** son single-tenant (San Pedro) y **no** se sirven en `micuidad.com`
> hoy (misanpedro.com redirige). No las toca el guardrail multi-tenant.

### Multi-tenancy (el corazón)
- **`App` = tenant/ciudad** (`apps/api/src/models/App.ts`). Campos clave: `slug`, `nombre`
  ("Mi Nariño"), `ciudad`/localidad ("Nariño"), `provincia`, `pais`, `moneda` (ISO-4217),
  `locale` (BCP-47), `phonePrefix` ("+57"), `subdomain`, `customDomain`,
  `brand{primaryColor,accentColor,logoUrl,hero*}`, `precioMensual`, `status`, `plan`,
  `geoCenter{lat,lng}`, `legal{razonSocial,taxId,taxIdLabel,condicionFiscal,domicilio,jurisdiccion}`,
  `operator`, `settings`.
- **Todo dato de negocio lleva `appId`** (Coupon, Merchant, MerchantUser, User, Activation,
  Redemption, Referral, CustomerNote, PushSubscription, Subscription, Otp, WaSend). NO llevan
  appId: Owner, RefreshToken, PasswordReset (son globales).
- **Resolución del tenant:**
  - Backend: header `X-Tenant-Slug` → `middleware/tenant.ts` (`getAppId`, `findTenantByKey` matchea slug **o** subdomain; `toAsciiLabel` punycode para ñ → `minariño`=`xn--minario-9za`).
  - Frontend (`apps/web/src/lib/tenant.ts` `detectInitialSlug`): **1)** `?tenant=` → **2) subdominio (AUTORITATIVO en `*.micuidad.com`/`*.misanpedro.app`)** → **3)** localStorage → **4)** `VITE_TENANT_SLUG` → **5)** fallback `sanpedro`. *El subdominio gana sobre localStorage* (si no, una visita vieja mostraba otra ciudad).
- **Branding por ciudad:** `applyBrandingToDom` pisa la CSS var `--color-brand` con
  `brand.primaryColor` en runtime (single-knob; toda la escala se deriva por color-mix).
  Marca por defecto = **naranja `#ea580c`/`#c2410c`**.
- **Nombre vs localidad:** `nombre` = "Mi Nariño" (logo/marca). `ciudad`/localidad = "Nariño"
  (lo que ven los vecinos: "comercios de…", "Ahorrado en…"). Helpers `appName()`/`cityName()`
  (fallback genérico **"Mi Ciudad"** / "tu ciudad", nunca una ciudad real). En el alta del
  owner, la localidad se autocompleta con lo que va después de "Mi" en el nombre.

## 4. Infraestructura (prod)

### Railway — proyecto `misanpedro-api` (workspace Deenex)
- Servicio **`api`**: corre Hono y, en prod, **sirve también los fronts**:
  `index.ts` hace static serving host-based con `@hono/node-server/serve-static` →
  `administracion.*` sirve `apps/owner/dist`, cualquier otro host sirve `apps/web/dist`;
  `/api/*` tiene prioridad; SPA fallback a `index.html`. En dev NO se activa (lo sirve Vite).
- Servicio **MongoDB** (interno). **La DB de prod es INTERNA a Railway** → no se alcanza desde
  local. Seeds/migraciones corren **dentro** de Railway (al boot, `db/connection.ts`:
  `bootstrapOwner`, `seedCityFromEnv`, y `ensureSanpedroApp` en `seed.service.ts`).
- Dominio del servicio: `api-production-43c52.up.railway.app` + **dominio custom
  `*.micuidad.com`** (agregado con `railway domain`; SSL wildcard vía `_acme-challenge`).

### Cloudflare — zona `micuidad.com` (NS brynne/norm.ns.cloudflare.com)
- **`*` CNAME → `8g2u10nn.up.railway.app` (DNS-only / nube gris)** → todo subdominio va a Railway.
- `_acme-challenge` CNAME + `_railway-verify` TXT → para el SSL wildcard de Railway.
- Email: `MX` mx1/mx2.hostinger.com, `TXT` SPF, `CNAME` DKIM ×3 (hostingermail-a/b/c), `TXT` `_dmarc`.
- El **Worker `micuidad-wildcard` fue ELIMINADO** (era el hack viejo Cloudflare→Hostinger; ya no se usa).

### Hostinger (cuenta u598759732) — SOLO legacy + buzón
- `misanpedro.com`: sirve un `.htaccess` que **redirige 301** todo a `sanpedro.micuidad.com`
  (y `/owner` → `administracion.micuidad.com`). SSH key `~/.ssh/misanpedro_hostinger`, puerto 65002,
  docroot `~/domains/misanpedro.com/public_html`.
- **Buzón `soporte@micuidad.com`** (correo): SMTP `smtp.hostinger.com:465`. Usado por el email del API.

### Bases de datos
- **Prod:** Mongo interno de Railway (no alcanzable desde local).
- **Dev:** Atlas (cluster reachable; tiene `sanpedro`, `narino`, `ramallo`). El API dev apunta ahí.

## 5. Stack
- **API:** Hono 4 · @hono/node-server · Mongoose 8 (MongoDB) · Zod 4 · jsonwebtoken · bcryptjs ·
  otplib (TOTP owner) · nodemailer (email) · Mercado Pago Preapproval · web-push (VAPID) ·
  whatsapp-web.js (planeado). Build = `tsc -b --noEmit && node build.mjs` (esbuild bundle).
- **web/owner:** Vite 7 · React 19 · Tailwind 4 · React Router 7 · lucide-react · vite-plugin-pwa.
- **Tests:** vitest, **268 en total** (130 `apps/api` integración con Mongo en memoria + JWT, y 138 `apps/web` schemas/guardrail/lógica). Correr todo: `pnpm turbo run test` (OJO: `pnpm test` a secas no corre nada). Suites clave: `redemptions` (canje), `tenant-isolation`, `support` (modo soporte), `merchant-auth`. `pnpm typecheck` = 6 paquetes.
