# Informe de Estado — Mi Ciudad (misanpedro)
**Fecha:** 2026-06-23 · **Rama:** `main` (HEAD `4fde71f`) · **Autor:** dev principal (análisis multi-agente: 6 mapeadores read-only + verificación adversarial de hallazgos críticos)

> Método: batería de verificación real (typecheck/tests/guardrail) + 6 auditorías paralelas por subsistema + verificación adversarial (intentar refutar) de cada hallazgo crítico. Cada afirmación está anclada a `archivo:línea` o a un comando ejecutado.

---

## A. Dónde estamos hoy

**Salud técnica: verde.** Output real:

| Check | Resultado |
|---|---|
| Node / pnpm | v22.22.2 / 10.28.2 |
| `pnpm typecheck` | **6/6 paquetes OK** |
| `pnpm check:tenant` | **OK** (sin ciudad hardcodeada) |
| API tests (vitest) | **83/83** (8 files) |
| Web tests (vitest) | **104/104** (9 files) |
| Git | `main` limpia (solo untracked: `REPORTE-*.md`, `PROMPT-DEV-PRINCIPAL.md`) |

**Arquitectura.** Monorepo pnpm+turbo, TS estricto. API Hono+Mongoose (en prod también sirve los fronts estáticos host-based). Multi-tenancy por `App`=ciudad; todo dato de negocio lleva `appId`; el tenant se resuelve server-side por subdominio/header (no spoofeable). 6 paquetes:

- **`apps/api`** — backend + static serving. Auth sólida (JWT access 1h + refresh hasheado con rotación y detección de reuso; OTP vecino/comercio; bcrypt owner). MercadoPago Preapproval + webhook HMAC fail-closed. Seeds idempotentes.
- **`apps/web`** — PWA vecino + panel comercio (`/#/admin`). Maduro y cableado al API real (tokens separados, auto-refresh deduplicado, branding runtime por `color-mix`, activación/canje/microsite completos).
- **`apps/owner`** — super-admin (alta/edición de ciudades, dashboard recharts, listados cross-tenant). **Sin ningún test.**
- **`packages/shared`** — SSOT zod (21 schemas) para vecino+comercio. **No** cubre owner/billing/app-config.
- **`apps/landing`, `apps/landing-vecino`** — marketing single-tenant SP legacy (no se sirven en micuidad.com).

**Reconciliación con la auditoría de lanzamiento (2026-06-20, veredicto NO-GO 8 bloqueantes/14 mayores):** progreso real — **5 de 8 bloqueantes resueltos** en código (B2 alias deploy, B3 guard email 503, B4 currency del tenant en MP, B5/B6 legales tenant-aware vía `lib/legal.ts`, B7 EMAIL_FROM neutro); B8 mitigado por gate `SEED_DEMO_DATA`. **Pero casi todos los "mayores" siguen vigentes** (detalle en B).

---

## B. Qué nos falta (por prioridad)

### 🔴 Bloqueantes operativos / de lanzamiento
| # | Qué | Dónde | Esfuerzo |
|---|---|---|---|
| B1 | **Login del comercio caído en prod si falta config de email.** Sin `SMTP_HOST` **ni** `RESEND_API_KEY`, `/merchant/auth/request-otp` devuelve 503 y **ningún comercio entra** (login es OTP-only; el `passwordHash` que guarda el signup es **código muerto**, nunca se compara). *Ojo: el handoff dice "falta `SMTP_PASSWORD`" pero el gate real es `SMTP_HOST` — si seteás la password sin el host, igual cae a 503.* (verificado) | `email.service.ts:117-123,46-57` · `merchant-auth.ts:246-258` | Config (paso tuyo) |

### 🟠 Mayores
| # | Qué | Dónde | Esf. |
|---|---|---|---|
| M-push | **Web Push 100% muerto** (verificado): la ruta `/api/v1/push/*` **nunca se monta** en `index.ts` (front recibe 404) y `initWebPush()` **nunca se llama** en bootstrap (`configured=false` → `sendCouponPush` siempre early-return). Feature estrella de re-engagement, ~2 líneas para revivirla. | `index.ts:115-128,181-198` · `push.service.ts:5,35` · `routes/push.ts` | S |
| M-url | **URLs externas globales, no por-tenant.** `back_url` de MercadoPago y los CTAs de los welcome emails usan `env.APP_URL_FRONT` global → un comercio/vecino de la 2da ciudad post-pago/bienvenida cae a la PWA de San Pedro. El `tenant.subdomain` ya está en contexto, no se usa. | `billing.ts:171` · `email.service.ts:173,180,351` · `mp.service.ts:39` | S/M |
| M-stock | **`stockMaximo` del cupón nunca se valida** (afecta a TODAS las ciudades, incl. AR): se activa/canjea sin límite y `estado:'agotado'` jamás se asigna → un comercio con "50 cupones" puede ser canjeado ilimitado. Impacto económico directo. | `activations.ts` (POST) · `redemptions.ts:204` | M |
| M-legal | **Wizard de alta de ciudad sin campos legales.** El backend `createApp` ya acepta `razonSocial/taxId/condicionFiscal/domicilio/jurisdiccion`, pero el wizard no los expone → **toda ciudad nueva nace con Términos/Privacidad vacíos** hasta que alguien edite a mano. Riesgo de compliance. | `owner/NewAppPage.tsx` · `owner/lib/api.ts:213-227` (backend listo: `owner.ts:444`) | S |
| M-ci | **No existe CI** (verificado): `.github/workflows/` vacío, sin husky/hooks. Hay tests buenos pero nada los corre en push/PR → se puede mergear código roto a `main`; solo lo atrapa el build de Railway (y los tests de comportamiento, nunca). | `.github/workflows/` (vacío) · `turbo.json` (sin task `test`) | S |
| M-owner-ops | **Owner es solo-lectura** sobre comercios/suscripciones (no se puede suspender/reactivar comercio ni pausar/cancelar suscripción; no hay endpoints). Para gestionar morosos hay que salir del panel. | `owner/MerchantsPage.tsx` · `owner.ts:622-700` | L |
| M-owner-pag | **Listados sin paginación** (limit 100/200) mientras el subtítulo muestra el `total` real → el owner cree que vio todo. | `owner/{Merchants,Users,Subscriptions}Page.tsx` | M |
| M-mrr | **MRR del dashboard solo suma ARS** (el backend ya calcula `byCurrency`, el front lo ignora) → KPI de ingresos engañoso en multi-país. | `owner.ts:327-341` · `owner/DashboardPage.tsx:97` | M |
| M-tiers | **Tiers de `SavingsWallet` hardcodeados en ARS** (2000/8000/20000/50000) → en COP se sube de nivel con ~USD 12. | `web/features/SavingsWallet.tsx:8-13,102` | S |
| M-mail-canje | **Email de canje hardcodea `$` y `es-AR`** (el recibo de *pago* ya se arregló, este no). | `email.service.ts:303-330` · `redemptions.ts:220` | S |
| M-owner-tests | **`apps/owner` sin ningún test** — la superficie más sensible (crea ciudades, mueve config de plataforma) es la menos cubierta. | `apps/owner` | M |
| M-ssot | **SSOT incompleto:** schemas de owner/billing/app-config están inline en los routers, no en `packages/shared` → el front del owner no comparte contrato con el backend (puede divergir en silencio). | `owner.ts:40,409,518` · `billing.ts:133` | M |

### 🟡 UI pedida (pendientes del handoff) + menores
- **A.1 Login comercio — PARCIAL:** la tarjeta tiene `ring/shadow/rounded` pero falta el header con chip de ícono + divisor `border-t` que se pidió. `AdminLoginPage.tsx:141-147`. (S)
- **A.2 InstallPrompt — NO empezado:** sigue siendo toast flotante (no el modal explicativo pedido) **y se monta global** → aparece también en login/registro del **comercio** (mensaje cruzado B2B). `InstallPrompt.tsx:128-201` · `App.tsx:245`. (S/M)
- **A.3 Alta en 3 pasos — NO empezado:** el `Stepper` sigue en 2 ítems (`datos`|`listo`); sí se simplificó quitando lo fiscal (otro cambio). `AdminSignupPage.tsx:47,124`. (M)
- **Manifest PWA no tenant-aware:** `name`/`theme_color` fijos ("Mi Ciudad" naranja) → una 2da ciudad se instala con branding genérico. `web/vite.config.ts:18-40`. (M)
- **geoCenter default = San Pedro** en modelo + 5 fallbacks FE/BE; `provincia/pais` default AR → ciudad sin geoCenter cae a Argentina. Mitigado (owner ya lo setea) pero nada lo obliga. `App.ts:119-122`. (M)
- **Audit log inexistente:** `Owner.recentActions` declarado pero **nunca se escribe** → cero trazabilidad cross-tenant. (M)
- Copy legal AR inline fuera de `/legal` (Ley 25.326/24.240, Monotributo) no condicionado por país; fechas `es-AR` fijas dispersas; "factura C" inline en email de recibo; `.env.example` stale; `categoria 'inmobiliaria'` en zod pero no en el type; `tsconfig.base.json` muerto (nadie lo extiende). (S–M)

---

## C. Qué sería ideal tener (visión técnica)

1. **Aislamiento multi-tenant estructural, no por convención.** Hoy el `appId` se agrega a mano en ~191 queries; un solo olvido futuro = fuga entre ciudades. Centralizar con un plugin de Mongoose o el helper `withTenant` (ya existe, `tenant.ts:158`, pero no se usa) + **tests de integración multi-tenant negativos** (crear en A, verificar 404/403 desde B).
2. **CI real** (`ci.yml`): install + typecheck + test (API+web) + `check:tenant` en cada push/PR; idealmente smoke E2E parametrizado por tenant (hoy el E2E hardcodea San Pedro y contradice el guardrail).
3. **Construcción de URL por-tenant unificada** en un helper único (cierra M-url de raíz y evita reincidencia).
4. **Fase 2 de pagos por-ciudad** (`App.payment` con tokens encriptados, abstracción `PaymentProvider`, webhook ruteado por ciudad) — NO antes de que cobre la 2da ciudad (alineado a `ESTRATEGIA-PAGOS.md`), pero es el techo de escala actual: hoy cobrar otra ciudad/país exige otra cuenta MP y desarrollo.
5. **Hardening del owner:** 2FA ON + rate-limit en `/owner/auth/login` (hoy sin throttle) + TOTP single-use + audit log.
6. **Observabilidad:** Sentry hoy solo `captureException` manual (gated por `SENTRY_DSN`); logging plano. Subir a instrumentación real + logger estructurado (pino) con redacción de PII. Verificar `SENTRY_DSN` en Railway (sin él, prod está ciega a excepciones salvo stdout).
7. **Backups de la Mongo de prod** (interna a Railway) — no vi política de backup; un SaaS con datos de comercios la necesita.
8. **Manifest PWA + SSOT tenant-aware** para que multi-ciudad sea completa de punta a punta.

> *Distinción honesta:* lo que pediste explícitamente (A.1/A.2/A.3, campos del owner) está en B. Lo de arriba es criterio de ingeniero para escalar a N ciudades; varios son baratos y de alto impacto (1, 2, 3, 5).

---

## D. Riesgos y seguridad

- 🔴 **Owner 2FA OFF + login sin rate-limit** (verificado, `high`). El super-admin de **todas** las ciudades entra solo con email+password (`OWNER_2FA_REQUIRED=false`, decisión tuya), y `/owner/auth/login` no tiene throttle (el rate-limit solo está en forgot-password) → fuerza bruta sin freno sobre el único factor. Comprometerlo = control de todo el SaaS. El front ya tiene el 2FA cableado; activarlo es flip de env + (idealmente) rate-limit en login.
- 🟠 **Escritura/borrado cross-tenant de push** (`medium`): `/push/subscribe` y `/unsubscribe` matchean por `endpoint` (controlado por el cliente) **sin** `appId` → un cliente de A puede reasignar/borrar la suscripción de B. Mitigante: el endpoint es un token largo no enumerable. Es el único agujero real de aislamiento que se encontró (el resto de las ~191 queries filtra bien). Fix: incluir `appId` + índice compuesto `{appId, endpoint}`.
- 🟡 **`POST /billing/mock-confirm`** activa un comercio sin pago si no hay `MP_ACCESS_TOKEN`. Inocuo hoy (el alta ya nace activa), pero al activar cobro real hay que asegurar el token o queda bypass.
- 🟡 **`ensureSanpedroApp` hardcodea datos fiscales reales de SP** (CUIT/AFIP/jurisdicción) en el seed; si se setea `SEED_DEMO_DATA=true` en otra ciudad, recrea el tenant `sanpedro` con esos datos.
- 🟡 **Deploy acoplado:** un fallo de build de cualquiera de los 3 fronts tira el deploy del API entero (mismo servicio Railway). Mitigado porque Railway mantiene el deploy anterior si el build falla.
- ⚪ **`JWT_REFRESH_SECRET`** es env obligatoria pero **no se usa** (el refresh es `randomBytes`, no JWT) → fricción de deploy sin valor.

---

## E. Roadmap propuesto

**Esta semana — desbloquear y cerrar lo barato/alto-impacto**
1. **(tuyo)** Cargar `SMTP_HOST`+`SMTP_PASSWORD` (o `RESEND_API_KEY`) en Railway → destraba el login del comercio en prod. *Verifico con `/merchant/auth/request-otp`.*
2. Cablear Web Push (2 líneas: `app.route` + `initWebPush()` en bootstrap) + smoke de `GET /push/vapid-public`. **S**
3. URLs por-tenant (helper único; `back_url` + CTAs de email). **S/M**
4. Validar `stockMaximo` (409 en activación al tope; `estado:'agotado'` atómico en canje). **M**
5. CI mínimo (`ci.yml`: typecheck + test + `check:tenant` en push/PR). **S**
6. Scopear push por `appId` + cerrar A.1/A.2 (modal + restringir a superficie vecino). **S/M**

**Este mes — base para 2da ciudad cobrando + hardening**
- Paso "Legales" en el wizard del owner (backend listo). Tiers de Wallet por moneda. Email de canje tenant-aware. Manifest PWA tenant-aware. Quitar defaults San Pedro / geoCenter requerido.
- Owner: 2FA ON + rate-limit en login + paginación + acciones (suspender comercio) + MRR multi-moneda + primeros tests.
- A.3 alta en 3 pasos. Promover schemas owner/billing a `packages/shared`.

**Próximo — escala**
- Aislamiento multi-tenant estructural (plugin Mongoose + tests negativos). Observabilidad real + backups. Audit log del owner. **Fase 2 de pagos** cuando la 2da ciudad esté por cobrar.

---

## F. Preguntas abiertas (decisiones/pasos tuyos)

1. **Email en prod:** ¿`SMTP_*` o `RESEND_API_KEY`? (la password se pegó en chats previos → conviene **rotarla**). Sin esto el comercio no entra.
2. **Owner 2FA:** ¿lo activamos ya (`OWNER_2FA_REQUIRED=true`) + rate-limit en login, o lo mantenés OFF por ahora? Es el riesgo de seguridad #1.
3. **Prioridad de negocio:** ¿el foco inmediato es **lanzar la 2da ciudad cobrando** (→ M-url, tiers, MP Colombia, email canje) o **endurecer/operar San Pedro** (→ stockMaximo, owner ops, 2FA)?
4. **Datos de prod no verificables desde el repo** (los confirmás vos): geoCenter/localidad reales de Nariño, domicilio fiscal de SP, cuenta MercadoPago Colombia, rotación de password del owner.
5. **Web Push:** ¿es prioridad de producto? Si sí, lo revivo ya (es trivial); si no, lo dejo documentado como apagado a propósito.

---

## ⭐ Top 5 — qué hago primero (espero tu OK)

1. **Cablear Web Push** — feature entera muerta por 2 líneas; revivir + smoke test. **S**
2. **URLs por-tenant** (`back_url` + CTAs email) — desbloquea la 2da ciudad. **S/M**
3. **Validar `stockMaximo`** — bug económico que afecta a San Pedro **hoy**. **M**
4. **CI mínimo** — barrera contra regresiones; los tests ya existen, falta el gatillo. **S**
5. **Paso "Legales" en el wizard del owner** — compliance; el backend ya lo acepta. **S**

> Decime cuál(es) arranco y con qué prioridad (E/F arriba), y ejecuto. No toco nada hasta tu OK.
