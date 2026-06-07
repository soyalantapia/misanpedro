# Reporte — Test del ALTA DE COMERCIO mínima (sin fiscal)

- **Fecha:** 2026-06-07 · **Rama:** `feat/alta-comercio-minima` (`815c5b9`) · dev (web :5191 / api :3002, tenant `sanpedro`).
- **Método:** automáticos + backend del alta (curl, camino real) + validaciones a nivel schema + regresión (login OTP + cupones + alcance del diff) + visual del alta. Auth comercio OTP (dev `_debugCode`).

## Veredicto: ✅ LISTO — sin bloqueantes
El alta quedó **corta y sin fricción**: **no pide nada fiscal**, se completa y **crea un comercio `activo` y visible** para el vecino, y empuja (sin obligar) a completar el perfil. No rompió el login OTP ni el flujo de cupones. Todos los criterios de aceptación pasan.

## Resumen por área
| Área | Resultado |
|---|---|
| Automáticos (typecheck 6/6 · web 100 · api 52) | ✅ |
| Alta UI — sin fiscal, Stepper Datos→Listo | ✅ |
| Backend signup sin fiscal → activo + visible + cupón | ✅ |
| Validaciones (schema) | ✅ 8/8 |
| Empujón al perfil (Listo + dashboard) | ✅ (código + typecheck) |
| Regresión (login OTP · cupones · vecino/owner) | ✅ |
| Email duplicado 409 / rate-limit | ⚠️ por código (live tapado por rate-limit) |

---

## 0) Automáticos
- `pnpm typecheck` → **6/6** ✅
- `vitest` web → **100/100** · api → **52/52** ✅

## 1) Alta UI (`/admin/registro`) — sin fiscal, corta
- **Cero fiscal:** chequeo textual de la página → `CUIT: no · Razón social: no · Domicilio fiscal: no · Condición fiscal: no · factura C: no · paso "Fiscal": no`. ✅
- **Stepper "1 Datos · 2 Listo"** (se eliminaron Fiscal y Pago). ✅
- **Copy honesto:** sin "factura C", sin paso "Pago". *(El único match de "Pago" es "MercadoPago" en el copy "sin MercadoPago" — correcto.)*
- **Datos:** comercio (nombre/categoría/dirección/**mapa**/teléfono) + cuenta (nombre/email, OTP) + nota "fotos y horarios después" + **plan "3 meses gratis · todo incluido"** + **T&C inline** (gating: botón deshabilitado sin tildar) + botón **"Crear mi comercio gratis"**. ✅ (capturas mobile)
- **Listo (empujón, no muro):** CTAs **"Completá tu perfil (foto + horarios)"** → `/admin/comercio`, **"Creá tu primer descuento"** → `/admin/cupones/nuevo`, y **"Después lo hago — ir al panel"** → `/admin`. *(Verificado por código + typecheck; el submit en vivo para capturar la pantalla quedó tapado por el rate-limit del alta — ver Notas.)*

## 2) Backend del alta (curl, camino real)
- **Alta SIN fiscal** → `ok:true`, **`estado:'activo'`**, slug generado, **token de sesión devuelto**. ✅
- **Visible para el vecino:** el comercio aparece en `GET /merchants` (`estado:activo`); con su token se creó un cupón que **aparece en `GET /coupons`** (catálogo). ✅
- **Validaciones (schema `merchantSignupSchema`)** — 8/8 ✅:
  - válido sin fiscal → pasa · con fiscal de más (opcional) → pasa
  - falta nombre / categoría / dirección / teléfono / admin.email → rechaza
  - `acceptedTc:false` → rechaza
- **Rate-limit 3/hora:** confirmado (las altas extra → `429`). ✅
- **Email duplicado → 409:** no se pudo ejercitar en vivo (rate-limit agotado durante el test). Verificado por código: `merchant-auth.ts` → `emailTaken → 409 'email ya registrado'`. ⚠️

## 4) Regresión — no se rompió nada
- **Login OTP del comercio INTACTO:** `request-otp` → `ok` + `_debugCode`; `verify-otp` → `ok` + token + comercio. ✅
- **Cupones:** crear cupón con el token del alta funciona y se publica en el catálogo. ✅
- **Alcance del cambio:** el diff toca **solo** `apps/api/src/routes/merchant-auth.ts` (+4, comentario) y `apps/web/src/pages/admin/{AdminSignupPage,AdminDashboardPage}.tsx`. **No se tocó la app del vecino ni el owner.** ✅
- **Dashboard:** onboarding prioriza "Completá tu perfil" (cambio de 1 línea; verificado por código + typecheck).

## Hallazgos
- **Sin bloqueantes ni bugs.** El feature funciona como se diseñó.
- 🔵 **Fricción de QA (no es bug de producto):** el rate-limit de alta (3/hora por IP) hace lento probar varias altas seguidas; tapó el 409 duplicado y el submit en vivo del paso Listo. Es anti-abuso correcto.

## No verificado en vivo (y por qué) — todo cubierto por código/typecheck
- **409 email duplicado** y **screenshot del paso Listo**: rate-limit del alta agotado. (Lógica en `merchant-auth.ts`; CTAs en `AdminSignupPage` ListoStep.)
- **Screenshot del nudge del dashboard**: requiere sesión de comercio inyectada; cambio trivial verificado por código.

## Criterios de aceptación
- [x] El alta NO pide CUIT / razón social / condición fiscal / domicilio fiscal.
- [x] Alta corta (Datos → Listo), sin copy stale ("Pago", "factura C mensual").
- [x] Se completa SIN fiscal → comercio **activo y visible** para el vecino.
- [x] Al terminar, empuja (sin obligar) a completar perfil + crear primer descuento.
- [x] Backend/schema **no rechazan** un alta sin fiscal.
- [x] **Login OTP del comercio y flujo de cupones intactos.**
- [x] `pnpm typecheck` verde.

**Conclusión:** ✅ Listo para mergear/deployar. (Datos de prueba creados en la DB dev — descartables.)
