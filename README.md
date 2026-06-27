# Mi Ciudad (`micuidad.com`)

Plataforma **multi-ciudad / multi-país** de **descuentos vecinales**, marca blanca
("Mi \<Ciudad\>"), sobre **un solo codebase**. Cada ciudad es un *tenant* que vive en
`https://<ciudad>.micuidad.com`. Nació como "Mi San Pedro" y se generalizó a "Mi Ciudad".

> **📖 ¿Primera vez acá? Leé [`PROJECT.MD`](PROJECT.MD)** — la biblia del proyecto: qué es,
> el negocio, la arquitectura completa, los flujos, la seguridad, la historia y el roadmap.
> Este README es el **onboarding técnico** (cómo correrlo, qué stack, qué hay a mano).
> Para el estado vivo del día a día → [`work-agent/`](work-agent/).

---

## 🔗 En vivo

| Qué | URL |
|---|---|
| PWA vecino + panel comercio | `https://<ciudad>.micuidad.com` (ej. `sanpedro`, `minarino`) · comercio en `/#/admin` |
| Owner (super-admin) | `https://administracion.micuidad.com` |
| API | `https://api-production-43c52.up.railway.app/api/v1` (alias `https://api.micuidad.com/api/v1`) |
| Dominio viejo | `misanpedro.com` → redirige **301** a `sanpedro.micuidad.com` |
| Ciudades vivas | **San Pedro** (AR/ARS) · **Mi Nariño** (CO/COP) |

---

## 🗺️ Mapa de la documentación (dónde está cada cosa)

Todo el contexto está centralizado en el repo. Leé en este orden según lo que necesites:

| Necesitás… | Andá a… |
|---|---|
| **Entender el proyecto entero** (negocio + arquitectura + historia) | **[`PROJECT.MD`](PROJECT.MD)** |
| **Correr / deployar / no pisar trampas** (técnico) | este `README.md` + **[`work-agent/`](work-agent/)** |
| **El estado vivo: qué falta, qué se decidió, cómo deployar** | **[`work-agent/`](work-agent/)** (4 docs numerados, ver abajo) |
| **Trabajar entre varios** (flujo, ramas, reglas) | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| **Cuando algo se rompe en prod** (incidentes/ops) | [`docs/RUNBOOK.md`](docs/RUNBOOK.md) |
| **Qué se shippeó y cuándo** | [`CHANGELOG.md`](CHANGELOG.md) |
| **Referencia de la API** (endpoints + auth) | [`docs/API.md`](docs/API.md) |
| **Modelo de datos** (diagrama ER + campos) | [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) |
| **Sumar un comercio** (proceso repetible) | [`docs/playbook-onboarding-comercio.md`](docs/playbook-onboarding-comercio.md) |
| **Glosario de términos** | [`docs/GLOSARIO.md`](docs/GLOSARIO.md) |
| Cómo cobramos por ciudad | [`ESTRATEGIA-PAGOS.md`](ESTRATEGIA-PAGOS.md) |
| Estrategia multi-ciudad | [`ESTRATEGIA-MULTICIUDAD.md`](ESTRATEGIA-MULTICIUDAD.md) |
| Runbooks de infra | [`SETUP-MICUIDAD.md`](SETUP-MICUIDAD.md) · [`SETUP-CLOUDFLARE.md`](SETUP-CLOUDFLARE.md) · [`SETUP-OWNER.md`](SETUP-OWNER.md) |
| Crear una ciudad nueva | [`docs/onboarding-new-city.md`](docs/onboarding-new-city.md) |
| Spec de referidos | [`docs/SPEC-referidos.md`](docs/SPEC-referidos.md) |
| Auditorías y QA (histórico) | los muchos `AUDITORIA-*.md`, `REPORTE-*.md`, `CHECKLIST-*.md` de la raíz |

### Qué hay en [`work-agent/`](work-agent/) — el handoff vivo
Es la carpeta que mantenemos al día. Si abrís un chat nuevo o entra otra persona, leyendo
esto se entiende el estado completo. Contiene:

| Archivo | Para qué |
|---|---|
| [`work-agent/README.md`](work-agent/README.md) | índice + coordenadas rápidas (repo, URLs, deploy) |
| [`work-agent/00-ESTADO-Y-ARQUITECTURA.md`](work-agent/00-ESTADO-Y-ARQUITECTURA.md) | **qué es y cómo está armado** (monorepo, apps, multi-tenancy, infra). Dónde estamos hoy. |
| [`work-agent/01-PENDIENTES.md`](work-agent/01-PENDIENTES.md) | **lo más importante para continuar:** qué falta, en orden (UI, pasos del usuario, backlog) |
| [`work-agent/02-DEPLOY-Y-GOTCHAS.md`](work-agent/02-DEPLOY-Y-GOTCHAS.md) | **cómo deployar**, qué secretos faltan (sin valores) y las **trampas que ya nos mordieron** |
| [`work-agent/03-DECISIONES.md`](work-agent/03-DECISIONES.md) | **decisiones tomadas y el porqué** — no las deshagas sin entenderlas |
| [`work-agent/QA-FINDINGS.md`](work-agent/QA-FINDINGS.md) | hallazgos de QA y su estado |

---

## ⚡ Quick start

Requiere **Node ≥22** y **pnpm ≥10** (este repo usa `pnpm@10.28.2` + `turbo`).

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"   # Node 22 OBLIGATORIO
cd ~/dev/misanpedro                                  # NO en ~/Desktop (iCloud rompe el build)
pnpm install
cp apps/api/.env.example apps/api/.env               # editar MONGODB_URI (Atlas dev), JWT_SECRET, etc.
pnpm dev                                             # web + api en paralelo (turbo)
```

- **Dev usa MongoDB Atlas** (reachable). La DB de prod es interna a Railway → no se toca desde local.
- `apps/web/.env.local` → `VITE_API_URL=http://localhost:3002` (o el puerto del API dev).
- **Probar un tenant en local:** agregá `?tenant=narino` a la URL (localhost no tiene subdominio).

> ⚠️ **Los archivos reales viven en `~/dev/misanpedro`**, con un symlink en
> `~/Desktop/Programacion/misanpedro`. Trabajar directamente sobre Desktop (que es iCloud)
> rompe esbuild/rollup/lightningcss. Usá siempre `~/dev/misanpedro`.

---

## 🧰 Comandos

```bash
pnpm dev            # web + api en paralelo (turbo)
pnpm dev:web        # solo la PWA vecino/comercio
pnpm dev:api        # solo la API
pnpm build          # build de todo (turbo)
pnpm typecheck      # tsc en los 6 paquetes
pnpm test           # vitest (api + web) — 128 tests
pnpm lint           # eslint (turbo)
pnpm check:tenant   # guardrail: que NO haya nombre de ciudad hardcodeado en web/owner
```

Antes de pushear/deployar, el set mínimo: **`pnpm typecheck && pnpm test && pnpm check:tenant`**.

---

## 🏗️ Stack tecnológico

| Capa | Tecnología |
|---|---|
| **Monorepo** | pnpm workspaces + turbo · Node 22 · TypeScript estricto |
| **Backend (`apps/api`)** | **Hono 4** + `@hono/node-server` · **Mongoose 8** (MongoDB) · **Zod 4** (validación) · `jsonwebtoken` (JWT) · `bcryptjs` · `otplib` (TOTP del owner) · `nodemailer` (email SMTP) · Mercado Pago `Preapproval` (suscripciones) · `web-push` (VAPID) · `whatsapp-web.js` (parcial). Build = `tsc -b --noEmit && node build.mjs` (esbuild bundle). |
| **Front comercio/vecino (`apps/web`)** | **Vite 7** · **React 19** · **Tailwind 4** · **React Router 7** (HashRouter) · `lucide-react` (íconos) · `vite-plugin-pwa` (service worker / Workbox) · Leaflet (mapa) |
| **Front owner (`apps/owner`)** | Vite + React + Tailwind · React Router 7 (BrowserRouter) · sin service worker |
| **Shared (`packages/shared`)** | Zod schemas + types + helpers puros (valor del cupón, límite de uso, legales). Consumido por TS paths (sin build). |
| **Tests** | **vitest** — `apps/api` (integración con Mongo en memoria + JWT) + `apps/web` (schemas, guardrail, lógica). 128 en total. |
| **CI** | GitHub Actions (`.github/workflows/ci.yml`): install + typecheck + check:tenant + tests en push/PR. |
| **Infra** | **Railway** (1 servicio `api` que corre el backend Y sirve los fronts + servicio MongoDB) · **Cloudflare** (DNS/SSL wildcard `*.micuidad.com`) · **Hostinger** (legacy: redirect 301 + buzón `soporte@micuidad.com`). |

---

## 📁 Estructura del monorepo

```
misanpedro/
├── apps/
│   ├── api/             Hono + Mongoose (MongoDB). En PROD también sirve los fronts (host-based).
│   │   └── src/
│   │       ├── models/      19 modelos Mongoose (App, Merchant, Coupon, User, Activation…)
│   │       ├── routes/      15 grupos: merchant/auth, auth, merchants, coupons, activations,
│   │       │                redemptions, billing, wa, templates, notifications, admin, owner,
│   │       │                tenant, referrals, push
│   │       ├── middleware/  tenant.ts (resuelve appId), auth, rate-limit, auditImpersonation
│   │       ├── services/    jwt, email, mercadopago, seed, ownerStats…
│   │       └── index.ts     monta todo + static serving host-based de los fronts
│   ├── web/             PWA vecino + panel comercio (/#/admin) · Vite + React 19 + Tailwind 4 · HashRouter
│   ├── owner/           Panel super-admin (administracion.micuidad.com) · BrowserRouter · sin SW
│   ├── landing/         Marketing comercio (single-tenant SP, legacy)
│   └── landing-vecino/  Marketing vecino (single-tenant SP, legacy)
├── packages/shared/     @misanpedro/shared — Zod schemas + types + helpers (el FRONT NO lo importa: ver abajo)
├── scripts/             brand.mjs · check-no-hardcoded-tenant.mjs (guardrail) · deploy-*.mjs · e2e-limite-uso.sh
├── brand/               isotipos/logos SVG · favicons · lab de marca (index.html)
├── infra/               cloudflare-worker-micuidad.js (legacy, ya no se usa)
├── docs/                onboarding-new-city · deploy-railway · SPEC-referidos
├── work-agent/          handoff vivo (estado, pendientes, deploy, decisiones, QA)
├── nixpacks.toml        cómo Railway buildea (1 service → web+owner+api+landings)
├── railway.json         start + healthcheck del deploy
├── turbo.json           pipeline de turbo
├── tsconfig.base.json   TS base
├── PROJECT.MD           ← la biblia del proyecto
└── README.md            ← este archivo
```

**Convención importante:** el **front NO importa `@misanpedro/shared`**. La lógica chica
compartida se **duplica** en el front (con un comentario al canónico y los mismos vectores de
test). Ej.: `calcAhorroCanje` vive en `apps/web/src/lib/cuponValor.ts` **y** en
`packages/shared/src/valor.ts` (espejadas, lockeadas con tests). Si tocás una, tocá la otra.

---

## 🛠️ Qué tenemos a mano (herramientas y recursos)

- **`work-agent/`** — el handoff vivo (ver tabla arriba). **Es la fuente de verdad del estado.**
- **`scripts/`** — utilidades ejecutables:
  - `check-no-hardcoded-tenant.mjs` — el guardrail anti "Mi San Pedro" hardcodeado (corre en build/CI).
  - `brand.mjs` — regenera la marca (favicons/avatares) a partir del color.
  - `deploy-*.mjs` — deploy de los sitios **legacy** a GH Pages / Hostinger (el flujo actual es Railway).
  - `e2e-limite-uso.sh` — e2e del límite de uso por persona.
- **`brand/`** — isotipos/lockups SVG, favicons y un `index.html` de laboratorio de marca.
- **`docs/`** — runbooks puntuales (crear ciudad, deploy Railway, spec de referidos).
- **Reportes de la raíz** — histórico de auditorías de lanzamiento, QA E2E, revisiones PM/UX,
  prompts de testing. Útiles como referencia de qué se revisó y cómo.
- **Memoria del asistente** — el contexto de producto/negocio/decisiones también está en la
  memoria persistente de Claude Code (no en el repo): narrativa, GTM, pricing, incidentes.

---

## 🔐 Variables de entorno (servicio `api`, env `production` en Railway)

> **NUNCA** poner valores reales en docs/commits. Los carga el dueño en Railway.

| Grupo | Variables |
|---|---|
| **Core** | `MONGODB_URI` · `JWT_SECRET` · `JWT_REFRESH_SECRET` · `NODE_ENV` · `PORT` · `TRUST_PROXY` |
| **Email** | `SMTP_HOST/PORT/USER/PASSWORD/SECURE` · `EMAIL_FROM` · `RESEND_API_KEY` (fallback) · `SUPPORT_EMAIL` |
| **Pagos** | `MP_ACCESS_TOKEN` · `MP_PUBLIC_KEY` · `MP_WEBHOOK_SECRET` · `PLAN_AMOUNT_ARS` |
| **Push** | `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` |
| **Owner / URLs / otros** | `OWNER_BOOTSTRAP_EMAIL/PASSWORD/NOMBRE` · `OWNER_APP_URL` · `APP_URL_FRONT` · `APP_URL_API` · `SENTRY_DSN` · `CORS_ORIGINS` · `SUPER_ADMIN_TOKEN` · `SUPPORT_WHATSAPP` · `WHATSAPP_SESSIONS_DIR` |

**El que falta hoy y bloquea el login en prod:** `SMTP_PASSWORD` (sin el buzón configurado,
`/request-otp` da 503). Detalle de cada secreto en [`work-agent/02-DEPLOY-Y-GOTCHAS.md`](work-agent/02-DEPLOY-Y-GOTCHAS.md).

---

## 🌆 Multi-tenant en una cápsula

- Cada ciudad es un documento **`App`** (tenant) con su config (nombre, color, moneda, precio, subdominio…).
- **Todo dato de negocio lleva `appId`.** El `appId` se resuelve del **host/header** (`X-Tenant-Slug`),
  **nunca del token** → una ciudad no puede tocar los datos de otra.
- El branding por ciudad pisa la CSS var `--color-brand` en runtime (marca por defecto naranja `#ea580c`;
  el verde está reservado para "ahorro").
- **Aislamiento verificado** (0 leaks en 207 queries + tests + e2e). Detalle en [`PROJECT.MD`](PROJECT.MD) §5.

---

## 🚀 Deploy (Railway)

**Un solo comando** sube el working tree, buildea web+owner+api+landings con nixpacks y lo sirve:

```bash
railway up --detach --environment production --service api
```

- El build corre, en orden: **1)** el guardrail `check-no-hardcoded-tenant.mjs` (si reaparece
  "Mi San Pedro" hardcodeado → **falla el deploy**), **2)** `turbo run build` de web/owner/api/landings,
  **3)** `node apps/api/dist/index.js`.
- Healthcheck: `/api/v1/health`. Si falla, Railway **mantiene el deploy anterior** (no rompe prod).
- **Confirmar live:** pollear `https://api.micuidad.com/api/v1/health` hasta que `uptime` resetee a ~0.
- El deploy NO depende de pushear (sube el working tree), pero conviene commitear + pushear igual.

⚠️ **Gotcha del Service Worker:** tras un deploy, el navegador puede servir el bundle viejo
cacheado. Para testear el deploy nuevo en browser: desregistrar el SW + limpiar caches (o hard
refresh, Cmd+Shift+R). El owner no tiene SW. Más trampas en
[`work-agent/02-DEPLOY-Y-GOTCHAS.md`](work-agent/02-DEPLOY-Y-GOTCHAS.md).

---

## ✅ Testing y calidad

- **128 tests** (vitest). Suites de integración clave: `redemptions` (canje/dinero),
  `tenant-isolation` (multi-tenant), `support` (modo soporte), `merchant-auth` (login/onboarding).
- **CI** corre en cada push/PR (typecheck + check:tenant + tests).
- El **guardrail `check:tenant`** garantiza que ningún nombre de ciudad quede hardcodeado en `web`/`owner`.

---

## 🤝 Cómo contribuir (varios devs)

1. Leé [`PROJECT.MD`](PROJECT.MD) + este README + [`work-agent/`](work-agent/).
2. Node 22 + pnpm. Trabajá contra Atlas (dev), no la DB de prod. Probá tenants con `?tenant=…`.
3. **Convenciones:** todo lo visible sale del tenant (nunca hardcodear ciudad) · el front no importa
   `shared` · verde = ahorro, no marca · respetá la narrativa LOCKED (ver `PROJECT.MD` §2.2).
4. Antes de pushear: `pnpm typecheck && pnpm test && pnpm check:tenant`.
5. Deploy: `railway up …` (un comando deploya todo) + verificá el `uptime` y un smoke en prod.
6. **Actualizá el `work-agent/` cuando shippees algo grande** — es la fuente de verdad viva.

> Este repo (`soyalantapia/misanpedro`) **sí** permite push directo a `main`. (La regla "nunca a
> main" aplica a los repos de Deenex, no a este.)
