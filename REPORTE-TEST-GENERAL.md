# Reporte — Test GENERAL de la plataforma (Mi San Pedro)

- **Fecha:** 2026-06-06 · **Rama:** `feat/limite-uso-por-persona` · dev (web :5191 / api :3002, tenant `sanpedro`; owner :5182 / landings :5181·:5185 levantados aparte).
- **Método:** automáticos (typecheck + vitest api/web + E2E) + smoke de las 5 apps + seguridad cross-rol/tenant + production-readiness. Auth con OTP de dev. Consolida también los reportes previos (`REPORTE-TEST-LIMITE-USO.md`, `REPORTE-QA-E2E-COMPLETO.md`, `REPORTE-AUDITORIA-UX-QA.md`).

## Veredicto: ✅ Plataforma sólida y segura en lo testeado — bloqueante de lanzamiento = DATA REAL
El núcleo funciona de punta a punta y es **seguro** (aislamiento por rol y por tenant). Vecino y comercio están maduros; las 5 apps renderizan on-brand. **El único bloqueante de producción sigue siendo F-001 (catálogo con data de prueba)** — es **ops**, no código. El **panel owner** quedó verificado solo visualmente (sin credenciales).

## Resumen por área
| Área | Estado |
|---|---|
| Automáticos (typecheck 6/6 · api 77 · web 100) | ✅ |
| Playwright e2e (smoke vecino + comercio) | ✅ 8/8 (specs actualizados) |
| E2E del cupón (crear→activar→validar→canjear) | ✅ 10/10 |
| Límite de uso por persona (unit+integración+E2E+races) | ✅ (ver `REPORTE-TEST-LIMITE-USO.md`) |
| Vecino (web) | ✅ (auditado; ver reportes previos) |
| Comercio `/admin` (web) | ✅ (auditado; dashboard/cupones/validar/ficha/selector) |
| Owner `/owner` | 🟡 login renderiza; **funcional NO verificado** (sin credenciales) |
| Landings (comercios + vecino) | ✅ renderizan, on-brand |
| Seguridad (cross-rol / multi-tenant) | ✅ |
| Production-readiness | ❌ **F-001** (data de prueba) |

---

## 0) Automáticos
- `pnpm typecheck` → **6/6** ✅
- `vitest` api → **77/77** ✅ (incl. 17 unit + 8 integración DB del límite por persona)
- `vitest` web → **100/100** ✅
- `scripts/e2e-limite-uso.sh` → **10/10** ✅ (loop del cupón + límite, en vivo)
- Playwright e2e (`smoke-admin`, `smoke-vecino`): **8/8** ✅ — corrido contra el server activo (:5191). ⚠️ Venían **desactualizados** (esperaban nav vieja, login con contraseña, pricing $25.000, rutas `/login`/`/registro`) → **7/8 fallaban**; se **actualizaron a la UI actual** (nav Mapa/Locales/Cupones/Alertas/Perfil, login OTP, $50.000, `/datos`) y ahora pasan 8/8.

## 1) Loop estrella E2E — ✅
`scripts/e2e-limite-uso.sh` (10/10) ejercita crear cupón → activar (código 6 díg/QR) → validar → confirmar canje (monto obligatorio + cap) → y el límite por persona en ambos puntos. Consistencia de números vecino↔comercio verificada en sesiones previas (dashboard $9.000/2 clientes ↔ Canjeados/El Club del vecino).

## 2) Vecino (web) — ✅
Home/Cupones, Locales, Mapa (lista + tap-to-fly), detalle cupón/comercio, activación/código, Alertas, **Perfil + El Club** (nivel/entradas/racha), Registro, Canjeados, Plan, nav FAB, 404 — auditados y verdes (detalle en reportes previos + regresión de fixes abajo).

## 3) Comercio `/admin` (web) — ✅
Dashboard (métricas reales), crear cupón (wizard + tipos + **selector de límite por persona** + precarga), validar (QR/código), confirmar canje (monto), clientes, estadísticas, ficha/micro-sitio — verificados. On-brand (naranja+light, sin violeta).

## 4) Owner `/owner` — 🟡 parcial
- Login renderiza: **"Entrar al Owner Panel · Acceso restringido al equipo del SaaS"**, **email + password** (distinto del OTP de vecino/comercio), on-brand. App sirve (`:5182`, title "Admin · Mi San Pedro").
- **No verificado funcionalmente:** dashboard, gestión de ciudades/comercios/usuarios/suscripciones — **falta credencial de operador**. Recomendado: pasada funcional con login válido + chequear que ve todos los tenants y que los datos cuadran.

## 5) Landings — ✅
- **Comercios** (`:5181`): "Tus clientes vuelven solos. Sin imprimir un volante más." + mockup + CTAs. On-brand.
- **Vecino** (`:5185`): "Tu plata rinde más." + "lo que ya comprás, más barato. Gratis y sin registrarte." + mockup billetera. On-brand, narrativa LOCKED.
- Pendiente fino: medir responsive 768/1280 + verificar que cada CTA lleve al destino correcto (alta comercio / app vecino).

## 6) Seguridad — ✅
| Caso | Resultado |
|---|---|
| Vecino → ruta de comercio (`/coupons/mine/list`) | **403** ✅ |
| Vecino → confirmar canje (comercio) | **403** ✅ |
| Comercio → ruta de vecino (`/activations/me`) | **401** ✅ |
| Sin token → ruta de comercio | **401** ✅ |
| Tenant inexistente (`/tenant/noexiste/config`) | **404** ✅ (no filtra) |
- Rate-limits activos: signup comercio 3/h, OTP-request 5/h, OTP-verify 10/min, validate 60/min.

## 7) Regresión de fixes previos (no volvieron) — ✅
- theme-color naranja `#ea580c` (no violeta) · 404 sin violeta · **0 errores 401** en home deslogueado · detalle de comercio compacto · **doble-confirm → 409 limpio** (no 500).

## Hallazgos / bloqueantes
- 🔴 **F-001 — catálogo con data de prueba** ("QA Test", "Push QA test", + las pruebas que generé en dev). **Bloqueante de lanzamiento.** Cargar comercios reales + purgar la data QA en prod (ops). Único bloqueante crítico.
- 🟡 **Owner funcional No verificado** (sin credenciales) — hacer pasada con login de operador.
- 🟡 **Stock global = feature muerta** (`stockMaximo` no settable por API ni enforced) — feature aparte, fuera de scope.
- 🟠→✅ **e2e Playwright desactualizado** (red de seguridad rota): 7/8 fallaban porque los specs reflejaban la UI vieja (nav, login con contraseña, $25.000, rutas `/login`/`/registro`). **Arreglado** — specs actualizados a la UI actual → **8/8**.
- 🔵 **a11y / performance** no medidos exhaustivamente (axe / Lighthouse).

## No verificado (y por qué)
- Owner funcional (sin credencial de operador). · a11y formal (axe) + métricas de performance (Lighthouse). · Landings en 768/1280 y destino exacto de cada CTA.

## Conclusión
Para **vecino + comercio + el loop del cupón + el límite por persona + seguridad**, la plataforma está **lista** salvo por **cargar data real (F-001)**. Antes de confiar en el **owner** en prod, hace falta una pasada funcional con credenciales. Sugerido además: correr Playwright + axe + Lighthouse en un entorno limpio.
