# Reporte — Auditoría UX/UI + QA funcional · Mi San Pedro (app del vecino)

- **Fecha:** 2026-06-05
- **Build auditado:** rama `feat/club-niveles`, working tree local (sin commitear) — dev `pnpm dev:web` (web :5191 → API :3002, tenant `sanpedro`).
- **Método:** navegador headless (gstack `browse`), viewport mobile **390×844** + desktop **1280**, revisión de consola + red, y code-review para lo que está detrás de login OTP.
- **Alcance cubierto (live):** Home/Cupones, Locales, Detalle de cupón, Detalle de comercio, Mapa (verificado en sesión: lista + tap-to-fly + popups), Registro `/datos`, Alertas, 404, navegación, estados deslogueado/vacío. Desktop: Home.
- **No verificado (requiere login OTP):** Perfil (incl. tarjeta **El Club**), Canjeados, flujo **activación → código/QR → canje**. *(El Club + lógica están cubiertos por 17 tests unit/render; falta el chequeo visual logueado.)*

## Veredicto: ❌ NO listo para producción (mejorando)
Bloqueante principal: **el catálogo es 100% data de prueba** (no hay comercios reales). Lo funcional y el diseño están sólidos.

> **Actualización 2026-06-05 — fixes de código aplicados y verificados:** los restos de marca violeta (theme-color → `#ea580c`, página 404), los **2× 401 en páginas deslogueadas**, la **repetición visual del detalle de comercio** y el **contraste del link de Maps** **ya están resueltos** (typecheck + 100/100 tests verdes). Ver "Fixes aplicados". **Bloqueantes restantes:** F-001 (data real — ops), F-004 (auto-hospedar Satoshi), F-011 (verificación logueado).

## Resumen por severidad
| Sev | # | Hallazgos |
|---|---|---|
| 🔴 Crítico | 1 | F-001 |
| 🟠 Alto | 2 | F-002, F-003 |
| 🟡 Medio | 5 | F-004, F-005, F-006, F-007, F-008 |
| 🔵 Bajo | 3 | F-009, F-010, F-011 |

## ✅ Fixes aplicados (2026-06-05)
| ID | Estado | Qué se hizo | Archivos |
|---|---|---|---|
| F-002 | ✅ Resuelto | theme-color a `#ea580c`; se quitó el override del tenant que lo ponía violeta | `index.html`, `lib/tenant.ts` |
| F-003 | ✅ Resuelto | 404 + suspense fallback migrados a tokens de marca (sin `violet-mesh`/`primary-*`) | `pages/NotFoundPage.tsx`, `App.tsx` |
| F-005 | ✅ Resuelto | `useApiMyActivations(status, enabled)` — no dispara fetch sin sesión (se fueron los 2× 401) | `lib/apiQueries.ts`, `features/SavingsWallet.tsx`, `features/ClubCard.tsx` |
| F-006 | ✅ Resuelto | Variante `compact` de CouponCard en el detalle de comercio (sin ícono repetido ni rubro·comercio redundante) | `components/CouponCard.tsx`, `pages/MerchantDetailPage.tsx` |
| F-007 | ✅ Parcial | Link "Abrir en Google Maps" a `brand-strong` (≈5.3:1). Sweep completo de textos chicos naranja pendiente | `pages/MerchantDetailPage.tsx` |
| F-008 | ✅ Resuelto | Aviso de notificaciones bloqueadas: de rojo (error) a neutro + copy más claro | `components/AlertsBell.tsx` |
| F-001 | ⛔ Ops | Cargar comercios reales + purgar data QA — tarea del operador, no de código | (DB prod) |
| F-004 | ⏳ Pendiente | Auto-hospedar Satoshi (woff2 + `@font-face`) o sacar fontshare del precache PWA | `index.html` / `vite.config.ts` |
| F-009 | ➖ N/A | Formato `mm/dd/yyyy` era artefacto del headless en-US; en es-AR sale `dd/mm/aaaa` | — |
| F-010 | ⏳ Pendiente | Doble fetch de canjes en Perfil (logueado) — bajo impacto | `pages/PerfilPage.tsx` |
| F-011 | ⏳ Pendiente | Verificación visual logueado (Perfil/Club, Canjeados, canje E2E) | — |

Verificado en vivo tras los fixes: theme-color = `#ea580c`, consola del home sin 401, 404 blanco/naranja, comercio con lista compacta.

---

## 🔴 Críticos

### [F-001] El catálogo muestra data de prueba (QA) a usuarios reales
- **Severidad:** 🔴 Crítico · **Categoría:** Producción / Datos
- **Pantallas:** Home, Locales, Mapa, Detalle de cupón/comercio (toda la app)
- **Repro:** abrir `/` → los cupones son "Push QA test cupon nuevo", "Edge test cupon doble", "Test tope monto", "Vigente control test", "20% en cualquier compra QA". Comercios: "QA Test Comercio" (Calle Test 1234), "QA Alta Gratis" (Av. Verificacion 100), "Cafe Prueba WhatsApp" con teléfono `+5493329555999`.
- **Esperado vs Actual:** Esperado → comercios y cupones reales de San Pedro. Actual → 100% datos de QA/test visibles al público (coincide con el hueco #1 del doc de producto: "0 comercios reales cargados").
- **Evidencia:** screenshots Home/Locales/Comercio.
- **Fix:** purgar la data de prueba del tenant `sanpedro` en prod y cargar 5–10 comercios reales (tarea de ops/operador, no de código). **Es el bloqueante de lanzamiento.** Esfuerzo: M.
- **Estado:** Abierto

---

## 🟠 Altos

### [F-002] theme-color del navegador en violeta viejo (#695ede)
- **Severidad:** 🟠 Alto · **Categoría:** Visual / Marca
- **Dónde:** `apps/web/index.html:8` (`<meta name="theme-color" content="#695ede">`) **y** `apps/web/src/lib/tenant.ts:239-241` (lo pisa con `t.brand.primaryColor`, que en la DB de prod también es `#695ede`).
- **Esperado vs Actual:** Esperado → barra del navegador/PWA en naranja `#ea580c`. Actual → violeta (marca vieja). Visible en la barra del browser mobile y en el splash de la PWA.
- **Fix:** poner `#ea580c` en `index.html`; y/o dejar de pisar el theme-color con `primaryColor` (o actualizar `brand.primaryColor` del tenant en la DB a naranja, o derivarlo de `--color-brand`). Esfuerzo: S.
- **Estado:** Abierto

### [F-003] Página 404 con fondo violeta (paleta vieja)
- **Severidad:** 🟠 Alto · **Categoría:** Visual / Marca
- **Dónde:** `apps/web/src/pages/NotFoundPage.tsx:9` → `bg-violet-mesh` + `bg-primary-50` (la escala `primary-*` y `violet-mesh` quedaron en violeta; no se re-tematizaron con el single-knob). Mismo resto en `PageSuspenseFallback` (`bg-primary-50`) en `App.tsx`.
- **Esperado vs Actual:** Esperado → fondo blanco/naranja como el resto. Actual → degradé violeta→rosa (los íconos/botones sí están en naranja porque usan `accent-*`, que sí deriva de la marca).
- **Fix:** migrar `NotFoundPage` y el suspense fallback a tokens `fin-*`/`bg`/`brand` (sacar `primary-*` y `violet-mesh`). Esfuerzo: S.
- **Estado:** Abierto

---

## 🟡 Medios

### [F-004] Font Satoshi: error CORS de fontshare en consola + sin font offline
- **Severidad:** 🟡 Medio · **Categoría:** Performance / Visual
- **Dónde:** `apps/web/index.html:12-13` (preconnect `crossorigin` + stylesheet a `api.fontshare.com`). La PWA (workbox) intenta precachear el CSS cross-origin → consola: *"Access to XMLHttpRequest at 'api.fontshare.com…' blocked by CORS"* + *"Couldn't load preload assets"* + `net::ERR_FAILED`.
- **Esperado vs Actual:** Esperado → consola limpia y Satoshi disponible (incl. offline). Actual → errores en consola; la font no queda cacheada para offline y puede haber FOUT en la primera carga.
- **Fix:** auto-hospedar Satoshi (woff2 en `public/` + `@font-face`) o excluir el dominio del precache de la PWA. Esfuerzo: M.
- **Estado:** Abierto

### [F-005] Páginas deslogueadas disparan requests autenticados → 2× 401
- **Severidad:** 🟡 Medio · **Categoría:** Funcional / Performance
- **Dónde:** `SavingsWallet` (y `ClubCard`) llaman `useApiMyActivations('canjeado')` **antes** del guard `loggedIn` (los hooks no pueden ser condicionales). En `/` deslogueado se ve `GET /activations?status=canjeado` → 401, + el retry con refresh → 401.
- **Esperado vs Actual:** Esperado → sin llamadas autenticadas si no hay sesión. Actual → 2 requests fallidos (401) y ruido en consola en cada carga deslogueada.
- **Fix:** agregar `enabled`/gate al hook (no fetch sin token), o un wrapper que corte antes de pegarle al API. Esfuerzo: S.
- **Estado:** Abierto

### [F-006] Detalle de comercio: ícono repetido y label redundante en cada cupón
- **Severidad:** 🟡 Medio · **Categoría:** UX / Visual
- **Dónde:** `/comercio/:slug` — cada cupón del comercio muestra el **mismo ícono grande de categoría** (6 tazas de café idénticas apiladas) y repite el eyebrow **"CAFETERÍA · CAFE PRUEBA WHATSAPP"** en todas, cuando el encabezado ya dice el nombre del comercio.
- **Esperado vs Actual:** Esperado → lista compacta, sin redundancia (el comercio ya está en el header). Actual → monotonía visual + ruido.
- **Fix:** en la vista de comercio, usar tarjetas de cupón compactas (sin el ícono grande ni el "rubro · comercio"); destacar título + % + ahorro. Considerar ordenar por % desc. Esfuerzo: M.
- **Estado:** Abierto

### [F-007] Contraste: naranja `#ea580c` sobre blanco en texto/links chicos < AA
- **Severidad:** 🟡 Medio · **Categoría:** Accesibilidad
- **Dónde:** links y textos chicos en naranja sobre blanco (ej. "Abrir en Google Maps", eyebrows de rubro, "Ver local"). Ratio ≈ **3.6:1** → cumple AA para texto grande/CTA pero **no** para texto normal (<4.5:1). El blanco sobre naranja de los CTAs grandes (≈3.6:1) está al límite de AA-large.
- **Fix:** para texto chico/links usar `brand-strong` (`#c2410c` ≈ 5.3:1) en vez de `brand`. Esfuerzo: S.
- **Estado:** Abierto

### [F-008] Alertas: el toggle de notificaciones muestra mensaje de error si el permiso está denegado
- **Severidad:** 🟡 Medio · **Categoría:** UX
- **Dónde:** `/alertas` → bloque "Notificaciones": cuando el navegador tiene el permiso en *denied*, aparece en rojo "Activá las notificaciones en los permisos del navegador para este sitio" con el switch apagado, sin un camino claro para resolverlo desde la app.
- **Esperado vs Actual:** Esperado → estado neutro + ayuda accionable (cómo reactivar). Actual → mensaje en rojo que parece error. *(En un usuario nuevo el estado es 'default', no se ve; aparece si el permiso fue denegado.)*
- **Fix:** suavizar el copy/estilo (no rojo de error) y dar pasos claros. Esfuerzo: S.
- **Estado:** Abierto

---

## 🔵 Bajos

### [F-009] Registro `/datos`: el input de fecha muestra `mm/dd/yyyy`
- **Severidad:** 🔵 Bajo · **Categoría:** UX / Contenido
- **Dónde:** `/datos` → "Fecha de nacimiento". El `<input type="date">` usa el formato del navegador (en el headless en-US → `mm/dd/yyyy`). En un browser es-AR sería `dd/mm/aaaa`.
- **Fix:** depende del locale del SO; opcional poner placeholder/ayuda "DD/MM/AAAA" o un date picker propio. Esfuerzo: S.
- **Estado:** Abierto

### [F-010] Doble fetch de canjes en Perfil
- **Severidad:** 🔵 Bajo · **Categoría:** Performance
- **Dónde:** Perfil monta `SavingsWallet` **y** `ClubCard`, y ambos llaman `useApiMyActivations('canjeado')` por separado → 2 requests idénticos.
- **Fix:** levantar el fetch a `PerfilPage` y pasarlo por props, o cachear el hook. Esfuerzo: S. *(Trade-off: mantener `SavingsWallet` autónomo para el Home — aceptable por ahora.)*
- **Estado:** Abierto

### [F-011] Pendiente de verificación visual logueado
- **Severidad:** 🔵 Bajo · **Categoría:** Cobertura
- **Dónde:** Perfil (tarjeta **El Club**: niveles/entradas/racha), Canjeados, y el flujo **activar → código de 6 dígitos/QR → canje**. No se pudieron ver live por el login OTP headless.
- **Fix:** verificación manual logueado como vecino con canjes (ver `PROMPT-AUDITORIA-UX-QA.md`). El Club ya tiene 14 tests de lógica + 3 de render. Esfuerzo: S.
- **Estado:** Abierto

---

## ✅ Lo que está bien (no romper)
- Marca **naranja consistente** + **ahorro en verde** correctamente reservado (cupones, detalle, billetera).
- **Responsive** sólido: mobile (chips/cupones 1 col), desktop (sidebar + grilla 2 col).
- **Estados vacíos en positivo** (Alertas "Creá tu primera alerta", billetera "Empezá a ahorrar").
- **404 con CTA** ("Volver al inicio" + "¿Sos comerciante?").
- **Mapa**: lista de locales + tap-to-fly + popup (verificado en sesión).
- **Detalle de cupón** claro: % grande, "Con este cupón ahorrás ~$X" en verde, CTA "Canjear descuento".
- Navegación con **FAB "Cupones"** + bottom nav coherente.
- `lang="es-AR"` correcto; tema light forzado.

## 🚦 Bloqueantes priorizados para producción
1. **F-001** — Cargar comercios/cupones reales y purgar la data de prueba (ops). 🔴
2. **F-002** — theme-color a naranja (`index.html` + tenant). 🟠
3. **F-003** — 404 (+ suspense) a tokens de marca (sacar violeta). 🟠
4. **F-004 / F-005** — limpiar consola (font CORS + 401 deslogueado) antes de exponer al público. 🟡
5. Verificar logueado (**F-011**): Perfil/Club, Canjeados, canje E2E.
