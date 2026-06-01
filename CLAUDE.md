# Mi San Pedro

Programa de descuentos vecinales **multi-tenant** (white-label por ciudad): PWA para el vecino + panel para el comercio + panel owner del operador. Live: https://soyalantapia.github.io/misanpedro/

## Monorepo (pnpm + turbo)

- `apps/web` — PWA: app del **vecino** + panel **comercio/admin** en una sola app. Vite 7 · React 19 · TS strict · Tailwind 4 · React Router 7 (HashRouter) · html5-qrcode · vite-plugin-pwa. Dev :5180 (base `/misanpedro/`). Deploy: GitHub Pages.
- `apps/api` — Backend Hono · Mongoose/MongoDB Atlas · JWT+bcrypt · otplib (OTP) · whatsapp-web.js · Mercado Pago · Sentry · Zod. Dev :3001 por defecto (configurable con `PORT` en `apps/api/.env`). Deploy: Railway.
- `apps/owner` — Super-admin del operador sobre TODOS los tenants (ciudades, comercios, usuarios, suscripciones). Vite · React · recharts. Dev :5182.
- `apps/landing` — Landing de conversión para captar comercios. Dev :5181. Deploy gh-pages propio.
- `packages/shared` (`@misanpedro/shared`) — Contrato canónico FE/BE: types + Zod schemas. **Single source of truth**: un cambio acá impacta frontend y backend.

## Modelo de dominio (clave)

- **Multi-tenant:** `App` = ciudad (`sanpedro`, `ramallo`…). Todo lleva `appId`. El front manda el header **`X-Tenant-Slug`** en cada request; el backend resuelve el tenant (middleware `tenant.ts`).
- **Merchant** geolocalizado (`location` 2dsphere `[lng,lat]`), `estado` ∈ `pending_payment|activo|suspendido|cancelado`, datos fiscales, `freeTrialUntil`.
- **Vecino** activa un cupón → `Activation` (código de 6 dígitos + `qrPayload`). El comercio valida el código/QR y confirma el canje con `montoTicket` (obligatorio, tope $10M).

## Auth (dos sujetos separados)

- **Vecino** (`user`): login por **OTP email**. **Comercio** (`merchant`): **email + password**.
- Cada sujeto guarda su propio par access+refresh en `localStorage` (`msp.tok.{user,merchant}.*`). Refresh con rotación + detección de reuso. Cliente HTTP: `apps/web/src/lib/api.ts`.

## Desarrollo

- **El código real vive en `~/dev/misanpedro`** (hay un symlink en `~/Desktop/Programacion`). No trabajar desde Desktop: es iCloud y rompe esbuild/rollup/lightningcss. Node ≥22, pnpm ≥10.
- `pnpm dev` (web+api en paralelo) · `pnpm dev:web` · `pnpm dev:api` · `pnpm build` · `pnpm typecheck`.
- El front en dev apunta al API vía `apps/web/.env.local` (`VITE_API_URL`). El API toma su puerto de `apps/api/.env` (`PORT`). El **allowlist de CORS** del API (en `index.ts` + `CORS_ORIGINS`) debe incluir el origin del front, o las llamadas fallan con `ERR_FAILED` (el preflight cachea 24h).
- Tests: vitest (api + web) + Playwright e2e smoke (`apps/web/e2e`).

## Iniciativa actual (2026-05)

**Pivot de modelo de negocio:** el alta del comercio pasó de "pagar primero (Mercado Pago)" a **3 meses gratis sin tarjeta** — el comercio nace `estado:'activo'` y es visible al instante. La infra de Mercado Pago queda en su lugar pero **bypasseada en el alta**. Cabos sueltos a alinear: el paso fiscal del signup todavía exige CUIT pese a decir "Opcional"; copy "factura C de la suscripción mensual" stale; `CHECKLIST-PRE-LAUNCH-E2E.md` y `apps/landing` (Pricing) desactualizados.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
