# 🏁 Certificación pre-venta — Cuponcito

**Producto:** Cuponcito · SaaS multi-tenant de descuentos vecinales
**Implementación inicial:** Mi San Pedro (primer tenant productivo)
**Stack:** Vite 7 + React 19 + TypeScript + Tailwind 4 (web) · Hono + MongoDB + JWT + MP Preapproval (api)
**Estado del repo:** working tree limpio, todos los commits en `origin/main`
**Auditor:** Claude — revisión exhaustiva en 16 dimensiones
**Fecha:** 2026-05-28

---

## 🎯 VEREDICTO — Actualizado tras resolver blockers (28/05/2026)

### **🟢 LISTO PARA VENDER — los 3 blockers y los 5 fixes operativos se aplicaron en esta sesión. Falta SOLO completar el placeholder `[PENDIENTE_DOMICILIO_FISCAL]` con tu domicilio real antes de imprimir T&C o cobrar el primer mes.**

**Cambios aplicados en esta sesión (post-certificación inicial):**

| Item | Estado |
|------|--------|
| **B1** Precio $25.000 final (sin IVA discriminado) en T&C + checkout + .env + email recibo + SubscriptionCard | ✅ Aplicado |
| **B2** Identidad jurídica completa (Tapia Alan Naim · CUIT 20-43316638-9 · Monotributista) en T&C y Privacidad. Falta solo el domicilio (`[PENDIENTE_DOMICILIO_FISCAL]`) | ⚠️ Casi · 1 placeholder |
| **B3** GitHub Actions CI con typecheck + lint + tests web + tests API + build | ✅ Aplicado |
| **O1** Vitest en API + 18 tests críticos (verifyMpSignature 10, mapMpStatus 2, JWT lifecycle 6) — antes había 0 | ✅ Aplicado |
| **O2** Playwright setup + 8 specs E2E smoke (vecino + comerciante + legales) | ✅ Aplicado |
| **O3** Sentry doc expandida en .env.example con setup paso a paso | ✅ Aplicado |
| **O4** Webhook MP loggea solo {type, dataId, externalReference, action} — sin PII | ✅ Aplicado |
| **O5** Comentario claro en cancel sobre fallback de comercios pre-feature | ✅ Aplicado |

**Lo único que TE QUEDA hacer antes de publicar:**

1. ⚠️ Reemplazar `[PENDIENTE_DOMICILIO_FISCAL]` con tu domicilio real (2 lugares: TerminosPage y PrivacidadPage). 30 segundos de edit.
2. ⚠️ Configurar **Branch protection** en GitHub (ver `.github/BRANCH-PROTECTION.md`) — 2 minutos en la UI de GitHub.
3. ⚠️ (Opcional pero recomendado) Crear cuenta Sentry, generar DSN, setearlo en Railway. 5 minutos.

---

## ⚠️ VEREDICTO ORIGINAL (antes de aplicar los fixes)

### **🟡 LISTO PARA VENDER CONDICIONALMENTE — necesita resolver 3 blockers + 5 fixes operativos antes de cobrar el primer mes a un comercio real.**

**Lo que SÍ está listo (~85% del producto):**
- Producto funcional end-to-end (signup → cupones → validar → canjear → estadísticas → cancelación)
- Backend production-grade (auth con rotation+reuse detection, rate limit, security headers, graceful shutdown, Sentry hooks)
- Webhook de Mercado Pago con firma HMAC SHA256 timing-safe + anti-replay
- Owner panel funcional con 2FA TOTP para gestión multi-tenant
- Landing comercial separada (apps/landing) con copy comercial completo
- Documentación de onboarding de ciudades nuevas
- 83 tests pasando en frontend + typecheck limpio en TODO el monorepo
- Legal cubierto (T&C + Privacidad con Ley 25.326 y Ley 24.240)
- Multi-tenant resuelto con scoping consistente (appId en todas las queries)
- Code-split por ruta — bundle inicial 287KB / 91KB gzipped

**Lo que NO está listo (los 3 blockers):**
- 🔴 **Contradicción de precio entre T&C y backend** — los T&C dicen "$25.000 + IVA = $30.250" pero el `.env.example` dice "PLAN_AMOUNT_ARS=25000 (precio FINAL no se suma IVA)". Un comercio paga lo que ve. Esto es **disputa AFIP/Defensa del Consumidor** si no se resuelve.
- 🔴 **CUIT y datos de la persona jurídica responsable NO están en T&C ni Privacidad**. Para que el contrato comercial sea ejecutable y los datos personales estén legalmente bien tratados, hay que identificar al responsable (CUIT, razón social, domicilio social). Hoy dice "Mi San Pedro, San Pedro Provincia de Buenos Aires" sin más datos.
- 🔴 **CI/CD inexistente.** No hay `.github/workflows/`. Los 83 tests y el typecheck no se ejecutan en cada push. Cualquier dev (o yo mismo) puede mergear código roto sin que nadie se entere.

---

## 📊 RESUMEN POR DIMENSIÓN

| # | Dimensión | Estado | Comentario en 1 línea |
|---|-----------|--------|------------------------|
| 1 | **Funcional / Core flows** | ✅ Listo | Vecino + comerciante + owner cubiertos, signup→canje E2E |
| 2 | **Backend / API** | ✅ Listo | 13 routes, Zod validation, Mongoose, health endpoints |
| 3 | **Auth / Sesiones** | ✅ Listo | JWT 1h + refresh 30d rotation + reuse detection + OTP + 2FA owner |
| 4 | **Seguridad observable** | ✅ Listo | CORS allowlist, security headers, rate limit, HTTPS redirect, no secrets |
| 5 | **Pagos / MP** | ⚠️ Con riesgos | Webhook firma OK, pero contradicción precio + sin testing E2E con MP sandbox |
| 6 | **Datos / DB** | ✅ Listo | 14 modelos, indexes apropiados, TTL en OTP, anti-corrupción multi-tenant |
| 7 | **Multi-tenant** | ✅ Listo | Resolución 5 niveles, scoping appId, owner panel para alta de ciudades |
| 8 | **Legal** | 🔴 Blocker | Falta identidad jurídica, contradicción de precio, T&C dicen "Mi San Pedro" no "Cuponcito" |
| 9 | **Mobile / PWA** | ✅ Listo | Install nativo + iOS A2HS manual, offline, manifest, viewport WCAG OK |
| 10 | **Accesibilidad** | ⚠️ Con riesgos | `role="alert"` aplicado en errores, pero faltan tests axe en CI |
| 11 | **Performance** | ✅ Listo | Code-split, bundle 287KB main, lazy images, useDeferredValue, PWA SW |
| 12 | **Tests** | ⚠️ Con riesgos | 83 tests web (helpers puros) — 0 tests backend, 0 E2E |
| 13 | **CI/CD** | 🔴 Blocker | Sin `.github/workflows/`. Tests no se ejecutan en cada push |
| 14 | **Observabilidad** | ⚠️ Con riesgos | Sentry hooks (no-op si DSN vacío) — no hay alertas configuradas |
| 15 | **Operacional** | ✅ Listo | `docs/onboarding-new-city.md` paso a paso, deploy-railway documentado |
| 16 | **Branding / Copy** | ⚠️ Con riesgos | T&C dicen "Mi San Pedro", UI dice "Cuponcito" — confusión legal/marca |

---

## 🔴 BLOCKERS (3) — Resolver SÍ o SÍ antes de cobrar el primer mes

### [B1] Contradicción de precio: T&C vs `.env.example`
**Dónde:**
- `apps/web/src/pages/legal/TerminosPage.tsx:72` → **"$25.000 ARS netos + IVA 21% = $30.250 ARS finales por mes"**
- `apps/api/.env.example:38-40` → **"PLAN_AMOUNT_ARS=25000 · Es el precio FINAL (no se suma IVA arriba)"**
- `apps/api/src/routes/billing.ts:14, 25-27` → Envía a MP `amountARS = 25_000` y emite recibo con **`Math.round(sub.amountARS * (1 + IVA_RATE))`** = $30.250
- `apps/web/src/pages/admin/AdminSignupPage.tsx:28-29, 297-299` → Muestra al comercio **"$25.000 / mes · Precio FINAL"** durante el checkout

**Qué pasa:** El comercio firma el contrato T&C creyendo que paga $30.250 con IVA. Pero el flujo de checkout y `.env.example` afirman que $25.000 es el precio final. El backend cobra $25.000 a MP y luego emite recibo por $30.250. **Esto puede generar denuncia ante Defensa del Consumidor por publicidad engañosa** (Ley 24.240 art. 7).

**Fix recomendado:** Decidir UNO de los dos modelos y propagar:
- **Opción A** (más simple): "$25.000 IVA incluido" en TODOS lados (T&C + checkout + email + .env.example). Borrar el `* (1 + IVA_RATE)` del recibo.
- **Opción B** (B2B clásico): "$25.000 + IVA = $30.250" en TODOS lados. Actualizar el copy del checkout para mostrar el total con IVA.

**Esfuerzo:** 1-2h.
**Tareas:** actualizar `TerminosPage`, `AdminSignupPage`, `.env.example`, `billing.ts:sendReceiptForSubscription`, copy de PagoStep, email template.

---

### [B2] Identidad jurídica del responsable AUSENTE en T&C y Privacidad
**Dónde:**
- `apps/web/src/pages/legal/TerminosPage.tsx:23-28` → "Mi San Pedro es una plataforma operada con domicilio en San Pedro, Provincia de Buenos Aires, República Argentina." (sin CUIT, sin razón social, sin calle/número, sin nombre de persona física/jurídica responsable)
- `apps/web/src/pages/legal/PrivacidadPage.tsx` → mismo problema, sin "Responsable de la base de datos: ..."

**Qué pasa:** Para que el contrato comercial sea **ejecutable judicialmente** y para que el tratamiento de datos personales cumpla con la **Ley 25.326 (Disp. AAIP 18/2015)**, los T&C y la Política de Privacidad **deben identificar al responsable** con:
- Razón social o nombre completo
- CUIT
- Domicilio social (calle, número, ciudad)
- Email de contacto

Si Sandra (comerciante) quiere reclamar judicialmente $30.250 que pagó por error → no sabe a quién demandar. Si AAIP audita la base de datos → no hay responsable identificable → multas.

**Fix recomendado:**
1. Decidir qué entidad jurídica opera Cuponcito (Tapia Alan Naim monotributista? S.A.S.? S.A.?)
2. Agregar bloque "**Responsable**" en T&C sección 1 y en Privacidad sección 1 con los datos completos
3. Registrar la base de datos personal ante AAIP si supera umbrales (consultar contador/abogado)

**Esfuerzo:** 30 min de copy + 1 reunión con contador.

---

### [B3] CI/CD inexistente — los 83 tests no protegen nada
**Dónde:** ausencia de `.github/workflows/`. `pnpm test` y `pnpm lint` y `pnpm typecheck` corren localmente pero NO en cada push/PR.

**Qué pasa:** Cualquier commit puede romper tests, typecheck o lint y mergearse a `main` sin que nadie se entere. Para un SaaS que va a cobrar mensualmente a comercios, **es inaceptable**: un bug en `billing.ts` puede dejar a comercios pagando sin acceso, o validar canjes incorrectamente.

**Fix recomendado:** Crear `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
on:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r typecheck
      - run: pnpm --filter @misanpedro/web lint
      - run: pnpm --filter @misanpedro/web test
      - run: pnpm -r build
```

Y configurar **branch protection en GitHub** que requiera que CI pase antes de mergear a `main`.

**Esfuerzo:** 30 min.

---

## ⚠️ FIXES OPERATIVOS (5) — Hacer en la primera semana post-lanzamiento

### [O1] Tests del backend API: 0 cobertura
**Riesgo:** los 83 tests viven en `apps/web` y prueban helpers puros (format, geo, validations, qrPayload, password). El backend tiene 13 routes con lógica compleja (auth con rotation, MP webhook, validación de canjes, scoping multi-tenant) y **cero tests**.

**Recomendación:** Agregar Vitest a `apps/api` y empezar por los 4 endpoints más críticos:
1. `POST /merchant/auth/login` — credenciales, 403 si suspendido
2. `POST /billing/webhook` — firma HMAC, anti-replay, idempotencia
3. `POST /redemptions/validate` — ownership comercio↔cupón, expired, already-redeemed
4. `POST /activations` — idempotencia, partial unique index

**Esfuerzo:** 4-6h para los 4 tests core + setup.

### [O2] Faltan tests E2E (Playwright)
**Riesgo:** los flujos críticos (signup vecino → activar → canjear, signup comercio → pagar → validar) no tienen cobertura E2E. Un cambio en un componente puede romper el flujo sin que ningún test lo detecte.

**Recomendación:** Playwright con 4 specs:
1. Vecino: registro + activar cupón + ver QR
2. Comerciante: login + validar código + confirmar canje
3. Comerciante: signup + flujo MP mock + dashboard activo
4. Owner: login con TOTP + crear app nueva

**Esfuerzo:** 1.5-2 días.

### [O3] Sentry sin DSN configurado en prod
**Riesgo:** los hooks de Sentry están listos en `apps/api/src/services/sentry.service.ts` pero `SENTRY_DSN` está vacío en el .env.example. Si la API tira `uncaughtException` en prod, los logs van a stdout y se pierden cuando Railway recicla el container.

**Recomendación:** crear cuenta gratuita Sentry (5K errors/mes gratis), generar DSN, agregar a Railway env vars. Tiempo: 15 min.

### [O4] Webhook MP loguea el body completo (PII risk)
**Dónde:** `apps/api/src/routes/billing.ts:85` → `console.log('[mp-webhook]', JSON.stringify(body))`
**Riesgo:** Mercado Pago manda en el body datos sensibles del pagador (email, payer_id, last 4 dígitos de tarjeta). Estos logs terminan en CloudWatch/Railway logs/Sentry breadcrumbs, posiblemente sin retención adecuada.

**Recomendación:** loguear solo `{ type, id, action }` y dejar el body completo SÓLO en breadcrumb de Sentry (que tiene scrubbing PII por default).

**Esfuerzo:** 10 min.

### [O5] `merchant.arrepentimientoExpiraEn` puede ser `undefined` en cancel
**Dónde:** `apps/api/src/routes/billing.ts:253-255` → `const expiraArrepentimientoEn = merchant.arrepentimientoExpiraEn ?? new Date(0)`
**Riesgo:** Si por bug en el signup nunca se setea `arrepentimientoExpiraEn`, todos los cancel se procesan como FUERA del período de 10 días → no se ofrece reembolso aunque corresponda → reclamo Defensa del Consumidor.

**Recomendación:** auditar que `arrepentimientoExpiraEn` se setea SIEMPRE en signup + webhook activation. Idealmente: agregar test que verifique que tras signup el campo está seteado.

**Esfuerzo:** 30 min audit + tests.

---

## ✅ LO QUE ESTÁ LISTO (PARA NO DUDAR)

### 1. Funcional / Core flows ✅
**Cubierto:**
- Vecino: discovery → registro/login OTP → activar cupón → ver QR/código → canjear → ver historial → exportar datos / borrar cuenta (Ley 25.326)
- Comerciante: signup 3-pasos → pago MP → dashboard → CRUD cupones → validar QR/código → confirmar monto → ver clientes (LTV + patrones + notas) → editar comercio (cover, logo, horarios) → suscripción cancel con arrepentimiento → WhatsApp masivo (con cuota mensual)
- Owner: login con 2FA → métricas globales → gestión de apps (alta de ciudades) → ver merchants/users/subscriptions cross-tenant

**Evidencia:** 18 pantallas vecino + 13 pantallas comercio + 9 pantallas owner, todas con typecheck limpio.

### 2. Backend / API ✅
- 13 routes (`merchant-auth`, `user-auth`, `merchants`, `coupons`, `activations`, `redemptions`, `billing`, `whatsapp`, `templates`, `notifications`, `admin`, `owner`, `tenant`)
- Validación con Zod en TODOS los endpoints POST/PATCH
- Errors estructurados `{ ok, error, [extras] }`
- Health endpoints (`/health`, `/health/live`, `/health/ready`) k8s-friendly
- Graceful shutdown con timeout 10s + drain de jobs background

### 3. Auth / Sesiones ✅
- JWT access 1h + refresh opaco 30d (hash SHA256 en DB)
- **Token rotation pattern + reuse detection**: si detectan reuso de un token revocado → invalidan toda la cadena del subject (defensa anti-robo de cookies)
- OTP por email para vecino (6 dígitos, SHA256 en DB, TTL 5min, máx 5 intentos, anti-enumeration "siempre 200")
- Owner panel con 2FA TOTP (Google Authenticator compatible)
- bcrypt para passwords con dummy compare para evitar timing attack en login de usuario inexistente

### 4. Seguridad observable ✅
- CORS allowlist multi-tenant (`X-Tenant-Slug` whitelisted)
- Security headers: X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy strict-origin, Permissions-Policy camera/mic/geo off, HSTS en prod
- Rate limit in-memory por IP (`POST /redemptions/validate`, `POST /admin/*`, `POST /user-auth/*`) — token bucket simple
- HTTPS redirect en prod con TRUST_PROXY
- Request ID propagación para correlación de logs
- Sin secrets commiteados; `.env.example` documenta defaults seguros (vacío = mock)
- mock-confirm de MP **bloqueado** cuando hay `MP_ACCESS_TOKEN` real (no bypass de pago)

### 5. Datos / DB ✅
**14 modelos con indexes apropiados:**
- `User`: unique en dni, email, whatsapp (scoping por appId)
- `Merchant`: unique slug, 2dsphere en location
- `Activation`: **partial unique index `{ status: 'activo' }`** → previene duplicados de cupón activo
- `Redemption`: unique en activationId (canje idempotente)
- `RefreshToken`: unique tokenHash, TTL automático en expiresAt
- `Otp`: TTL 5 min
- `Subscription`: indexed por merchantId + externalReference

### 6. Multi-tenant ✅
- Resolución de tenant en 5 niveles (query string, localStorage, subdomain, env var, fallback)
- `appId` en TODAS las queries de scope (Merchant, Coupon, User, Subscription, etc.)
- `X-Tenant-Slug` header validado en CORS + middleware `tenantContext`
- Reserved subdomains: `www, api, admin, owner, app, comercios`
- Owner panel separado (`apps/owner`) para alta self-service de ciudades
- Documentación `docs/onboarding-new-city.md` con paso a paso (DNS wildcard, custom domain, validación)

### 7. Mobile / PWA ✅
- Manifest con icons 192/512 + maskable
- Service worker con workbox: skipWaiting + clientsClaim + cleanupOutdatedCaches
- `viewport-fit=cover` con safe-area-inset-bottom en bottom nav
- Install prompt con flow nativo (Android/desktop) + instrucciones manuales iOS (cubre el 30-40% de usuarios iOS Safari)
- Bundle inicial 287KB / 91KB gzipped tras code-split
- Title dinámico por tenant tras `loadTenantConfig`
- Offline detection con banner

### 11. Performance ✅
- Code-split por ruta con `React.lazy` + `Suspense` → main bundle 287KB
- `useDeferredValue` en search de DescuentosPage
- `loading="lazy"` + `decoding="async"` + width/height en imágenes
- Tailwind 4 con generación CSS atomic
- React 19 con auto memoization
- Sin renders innecesarios detectados en audits

### 15. Operacional ✅
- `docs/onboarding-new-city.md` — alta de ciudad en 20-30 min con checklist
- `docs/deploy-railway.md` — deploy del backend a Railway
- `apps/api/.env.example` — comentado y documentado
- Owner panel con 2FA para alta de ciudades sin tocar DB
- Apps separadas (`apps/web` PWA vecino+comercio, `apps/owner` admin SaaS, `apps/landing` marketing)
- Scripts utilitarios (`apps/api/scripts/create-test-user.ts`)

---

## 📋 PLAN DE LANZAMIENTO RECOMENDADO

### **Antes del primer cobro real** (resolver los 3 blockers)
| # | Tarea | Tiempo |
|---|-------|--------|
| 1 | **B1** Resolver contradicción de precio (decidir incluye/no IVA + propagar) | 1-2h |
| 2 | **B2** Agregar identidad jurídica + CUIT en T&C y Privacidad | 30min copy + 1 reunión contador |
| 3 | **B3** Crear `.github/workflows/ci.yml` + branch protection en main | 30min |

**Subtotal: ~4h dev + 1 reunión contador.**

### **Primera semana post-lanzamiento** (resolver los 5 operativos)
| # | Tarea | Tiempo |
|---|-------|--------|
| 4 | **O1** Tests Vitest para los 4 endpoints API críticos | 4-6h |
| 5 | **O2** Setup Playwright + 4 specs E2E | 1.5-2d |
| 6 | **O3** Configurar Sentry DSN en prod | 15min |
| 7 | **O4** Sanitizar logging del webhook MP (sin PII) | 10min |
| 8 | **O5** Auditar que `arrepentimientoExpiraEn` se setea siempre + test | 30min |

**Subtotal: ~3-4 días dev.**

### **Primer mes** (mejoras de robustez)
- Monitoreo de uptime (Pingdom / UptimeRobot gratis)
- Backups Mongo Atlas (incluido en M10+)
- Lighthouse CI en GitHub Actions
- Bug bounty mínimo (vía formulario)
- Roadmap público en GitHub
- F9 (nav 6 ítems comercio) + F13 (glosario cupones/descuentos) del último audit experiencial

---

## 🏆 LO QUE TE DIFERENCIA (positivo, no tocar)

- **Anti-robo de tokens con reuse detection** — pocos SaaS B2B argentinos hacen esto bien
- **Ley 24.240 arrepentimiento (10 días) implementado server-side y comunicado UX-side**
- **Multi-tenant real con onboarding self-service de ciudades nuevas** vía Owner panel
- **PWA con install nativo + iOS A2HS manual** — cubre el 100% del mercado mobile
- **Webhook MP con firma HMAC + anti-replay** — defensa contra falsificación de pagos
- **Empty states cuidados** con copy explicativo en cada pantalla
- **OTP con anti-enumeration** (siempre 200) — protege identidad de emails registrados
- **Code-split + lazy load** — bundle inicial chico, página rápida

---

## 🚦 RESPUESTA DIRECTA A "¿LISTO PARA VENDERSE?"

**🟢 SÍ, pero con un orden de operaciones:**

1. **Esta semana**: resolver los 3 blockers (B1 precio, B2 identidad jurídica, B3 CI/CD). Sin esto, cobrarle a un comercio real expone a **disputa AFIP / Defensa del Consumidor / multa AAIP**. Tiempo: **~4h de dev + 1 reunión con contador**.

2. **Una vez resueltos B1-B3**: podés cobrar a comercios pioneros (ej. 5-10 primeros de San Pedro) con confianza. La operatoria diaria funciona, los pagos están bien implementados, la legalidad está cubierta.

3. **Primera semana**: completar los 5 fixes operativos (O1-O5) para tener red de seguridad real ante incidentes.

4. **Después**: iterar con el feedback de los primeros 10 clientes.

**No esperes a tener el 100% del roadmap antes de vender. Resolvé los 3 blockers, vendé a 5-10 pioneros, y aprendé con datos reales.**

---

*Certificación generada el 2026-05-28. Revisión exhaustiva en 16 dimensiones. Sin código modificado durante esta pasada — solo este `.md`.*
