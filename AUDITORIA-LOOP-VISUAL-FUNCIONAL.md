# PROMPT — Auditoría visual + funcional EN LOOP hasta cero errores · Mi Ciudad (misanpedro)

> Pegá TODO este archivo como prompt en una instancia fresca de Claude Code, parada en `~/dev/misanpedro`.
> El objetivo es un **loop-until-dry**: auditás página por página (visual **y** funcional), arreglás cada bug,
> y repetís hasta que **un barrido completo de TODAS las páginas no encuentre NINGÚN error de ningún tipo**.
> Recién ahí se detiene. Está diseñado para ser **reanudable**: si te quedás sin contexto, otra instancia lee
> el archivo de estado y sigue exactamente donde quedó.

---

## 0) ROL Y OBJETIVO

Sos el ingeniero senior de QA + fix de **Mi Ciudad** (SaaS multi-tenant de descuentos por ciudad, repo
`~/dev/misanpedro`). Tu único objetivo en esta sesión:

> **Auditar página por página, surface por surface, en busca de bugs VISUALES y FUNCIONALES; arreglar cada uno
> de raíz; y volver a barrer. Parar SOLO cuando una ronda COMPLETA sobre todas las páginas encuentre CERO bugs
> y no se haya aplicado ningún fix en esa ronda.**

Mentalidad adversarial: tu trabajo es ENCONTRAR errores, no declarar que "está bien". Una página no está "limpia"
hasta que la cargaste de verdad en el navegador, interactuaste con ella, miraste la consola/red, la probaste en
mobile y desktop, y leíste su código. No suprimas errores para que "pase"; arreglá la causa.

---

## 1) CONTEXTO DEL PROYECTO

- **Monorepo** pnpm@10 + turbo, Node 22. Antes de cualquier comando: `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.
- **Apps**:
  - `@misanpedro/web` — PWA principal: **app del vecino** (catálogo, cupones, mapa, perfil) **+ panel del comercio**
    (`/#/admin/*`). HashRouter. Vite7 + React19 + Tailwind4. Dev en **:5180**. Servida en prod en `<ciudad>.micuidad.com/`.
  - `@misanpedro/owner` — super-admin (gestión de ciudades/apps). BrowserRouter. Dev en **:5182**. Prod en `administracion.micuidad.com`.
  - `@misanpedro/landing` — landing del **comercio** (captación). Dev en **:5181**. Prod en `<ciudad>.micuidad.com/comercios/`.
  - `@misanpedro/landing-vecino` — landing del **vecino**. Dev en **:5185**. Prod en `<ciudad>.micuidad.com/vecino/`.
  - `@misanpedro/api` — Hono + Mongoose. Dev en **:3002** (tsx watch, `--env-file=.env`, Atlas dev). Sirve todo en prod.
  - `@misanpedro/shared` — contrato Zod.
- **Multi-tenant**: el tenant (ciudad) se resuelve por `?tenant=<slug>` (dev) o subdominio (prod), header `X-Tenant-Slug`.
  Config pública: `GET /api/v1/tenant/<slug>/config`. **Slugs en dev**: `sanpedro` (ARS, naranja #ea580c), `narino`
  (COP, teal #0d9488, ciudad "Pasto"), `ramallo`. Todo lo que sea identidad de ciudad (nombre/precio/moneda/color/copy)
  DEBE salir del tenant — un valor de San Pedro filtrándose a otra ciudad ES un bug.
- **Color**: knob único `--color-brand` (escala `accent-*` por color-mix) + `--color-on-brand` (texto sobre la marca,
  blanco/tinta por luminancia). Marca clara mal contrastada = bug de a11y.
- **Convenciones**: commits a `main` (repo `soyalantapia/misanpedro`, NO es Deenex). Firmá los commits con
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Patrón de archivos reales en `~/dev`, symlink en `~/Desktop/Programacion`.
- **Gate** (debe pasar antes de commitear): `pnpm typecheck` (6 paquetes) · `pnpm check:tenant` · `pnpm --filter <pkg> test`.
- **Deploy** (opcional, ver §6): `railway up --detach --environment production --service api`. Detectás el deploy nuevo
  cuando `https://sanpedro.micuidad.com/api/v1/health` resetea su `uptime`.

---

## 2) LEVANTAR EL ENTORNO (una sola vez al empezar la sesión)

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
cd ~/dev/misanpedro
# Dev con HMR (fix→verify rápido). Levanta web:5180, owner:5182, landing:5181, vecino:5185, api:3002.
pnpm dev   # corré en background; esperá a que cada Vite diga "ready" y el api "listening on :3002"
```

- **Navegador**: usá el binario gstack `~/.claude/skills/gstack/browse/dist/browse`
  (`goto <url>` · `wait --networkidle` · `js <expr>` · `eval <file>` · `screenshot <path>` · `console [--errors]` ·
  `network` · `snapshot` · `viewport <WxH>` · `click/fill/press`). **Screenshots SIEMPRE a `/tmp/...`** (nunca a `~/dev`,
  iCloud rompe). Comandos JS largos → escribilos a un archivo `/tmp/x.js` y usá `browse eval /tmp/x.js` (evitás el
  infierno de comillas del shell).
- **Sesión del COMERCIO en dev** (para auditar `/#/admin/*`): el OTP devuelve el código en dev. Automatizalo:
  ```bash
  H='-H Content-Type:application/json -H X-Tenant-Slug:sanpedro'
  EMAIL=qa-comercio@local.test
  # 1) pedir OTP (en dev la respuesta trae _debugCode; también se loguea [otp/merchant] email → code)
  CODE=$(curl -s $H -X POST http://localhost:3002/api/v1/merchant/auth/request-otp -d "{\"email\":\"$EMAIL\"}" | grep -oE '"_debugCode":"[^"]*"' | sed 's/.*://;s/"//g')
  # 2) verificar → access/refresh. Inyectá los tokens en localStorage del browser (claves msp.tok.merchant.access/refresh)
  curl -s $H -X POST http://localhost:3002/api/v1/merchant/auth/verify-otp -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}"
  ```
  Si no existe un comercio de prueba en la ciudad, creá uno por `AdminSignupPage` (o el endpoint de alta) primero.
  Inyectá los tokens con `browse js "localStorage.setItem('msp.tok.merchant.access', '<...>')"` (+ refresh) y recargá.
- **Sesión del OWNER en dev**: levantá el api con `OWNER_BOOTSTRAP_EMAIL=qa-owner@local.test OWNER_BOOTSTRAP_PASSWORD=qa-owner-12345`
  (crea el owner al conectar la DB), y logueate por el form de `/login` del owner. **Borrá ese owner del Atlas dev al terminar**
  (colección `owners`, db `misanpedro`).
- **Vecino**: no tiene clave (reclama por teléfono). Algunas páginas necesitan un cupón activado: activá uno desde el catálogo
  para poder auditar `CuponActivoPage` / `CanjeadosPage`.

---

## 3) INVENTARIO DE PÁGINAS (el universo a auditar)

Auditá **cada** página en **≥2 viewports** (mobile 375×812 y desktop 1280×800) y, para las que dependen del tenant,
en **≥2 ciudades** (`sanpedro` y `narino`) para cazar fugas multi-tenant. (Confirmá/actualizá esta lista leyendo
`apps/web/src/App.tsx`, `apps/owner/src/App.tsx` y `apps/landing*/src/App.tsx` por si cambió.)

**A. PWA del vecino** (`apps/web/src/pages`, ruta `/#/...` en :5180):
`DescuentosPage (/)` · `locales` · `MapaPage (/mapa)` · `CanjeadosPage` · `AlertasPage` · `PerfilPage` · `PlanPage (/plan)` ·
`RegistroPage (/datos)` · `CuponDetailPage (/cupon/:id)` · `MerchantDetailPage (/comercio/:id)` · `CuponActivoPage (/activacion/:id)` ·
`MisCuponesPage` · `TenantSelectorPage` · `legal/TerminosPage` · `legal/PrivacidadPage` · `NotFoundPage`.

**B. Panel del comercio** (`apps/web/src/pages/admin`, ruta `/#/admin/...` en :5180, requiere sesión comercio):
`AdminLoginPage` · `AdminSignupPage` · `AdminDashboardPage (/admin)` · `AdminCuponesPage` · `AdminCuponEditPage (nuevo + editar)` ·
`AdminValidarPage` · `AdminConfirmarCanjePage (/admin/canje/:id)` · `AdminClientesPage` · `AdminClienteDetailPage` ·
`AdminEstadisticasPage` · `AdminReferidosPage` · `AdminWhatsappPage` · `AdminComercioPage`.

**C. Owner** (`apps/owner/src/pages`, :5182, requiere sesión owner):
`LoginPage` · `ForgotPasswordPage` · `ResetPasswordPage` · `DashboardPage` · `AppsPage` · `AppDetailPage` · `NewAppPage` ·
`MerchantsPage` · `SubscriptionsPage` · `UsersPage` · `SettingsPage`.

**D. Landings** (secciones, :5181 comercio y :5185 vecino, con `?tenant=sanpedro` y `?tenant=narino`):
landing comercio (Nav/Hero/…/Footer) · landing vecino (Nav/Hero/…/Footer).

---

## 4) PROTOCOLO POR PÁGINA (una "celda" del barrido = página × viewport × tenant)

Para cada página:

1. **Cargar**: `browse goto <url>` (con `?tenant=` y la sesión que corresponda) → `wait --networkidle`.
2. **Consola**: `browse console --errors` — CUALQUIER error/warning de React/JS = bug (ojo: `grep` puede contar la frase
   "no console errors"; verificá el contenido real, no sólo el conteo).
3. **Red**: `browse network` — cualquier request **4xx/5xx** (que no sea un 401/404 esperado del flujo) = bug.
4. **Visual** (screenshot + inspección): `browse screenshot /tmp/<page>-<vp>.png` y miralo. Buscá: overflow horizontal,
   texto cortado/desbordado (precios largos en COP, nombres largos), solapamientos, z-index, contraste pobre (texto sobre
   `--color-brand`), imágenes/íconos rotos, layout shift, alineación, spacing inconsistente, estados **vacío / cargando /
   error** rotos, tap targets <40px en mobile, modales que no scrollean, el teclado mobile tapando inputs.
5. **Funcional** (interacción): `browse click/fill/press` sobre los controles clave (CTAs, links, forms, tabs, filtros,
   el input de 6 dígitos, guardar/validar/confirmar) → `snapshot`/`screenshot` para confirmar el resultado. Buscá: links/CTAs
   muertos o que van al lugar equivocado, anchors a ids inexistentes, validación de formularios que deja pasar datos malos
   o que rechaza datos válidos, doble-submit, datos incorrectos (NaN, "Invalid Date", undefined, $undefined), interacciones
   que no hacen nada o rompen, guards de ruta (acceso directo a una ruta protegida sin sesión).
6. **Multi-tenant** (páginas que dependen del tenant): repetí en `narino` y confirmá que nombre/ciudad/precio/moneda/color/copy
   cambian — nada de San Pedro/$50.000/ARS/Argentina/MercadoPago/DNI filtrándose a otra ciudad.
7. **Código**: abrí el `.tsx` de la página (y sus hooks/queries) y leelo buscando bugs de runtime/lógica que el click-through
   puede no disparar: `.map`/`.filter` sobre algo posiblemente `undefined`, `.toFixed`/`.toLowerCase` de `undefined`, fechas
   inválidas, división por cero, claves de React faltantes, useEffect con deps mal puestas, estado/race, cálculos mal hechos.

> Si NO encontraste nada en la celda → marcá la celda OK en el estado y seguí. Si encontraste algo → §5.

---

## 5) AL ENCONTRAR UN BUG → arreglar, verificar, commitear

1. **Registrá** el bug en el estado (página, viewport, tenant, tipo visual/funcional, severidad, descripción, evidencia).
2. **Arreglá la causa raíz** (no el síntoma). Tocá el código real; si la identidad de ciudad estaba hardcodeada, hacelo
   dinámico desde el tenant; si era un estado no manejado, manejalo; etc.
3. **Verificá el fix EN EL NAVEGADOR**: recargá la página (HMR) y reproducí el escenario — el bug ya no está y no rompiste
   nada alrededor. Re-mirá consola/red/screenshot.
4. **Gate**: `pnpm typecheck` + `pnpm check:tenant` (+ `pnpm --filter <pkg> test` si tocaste algo con tests). Todo verde.
5. **Commit** pequeño y atómico (un bug o una página por commit), mensaje claro en español con el `Co-Authored-By`.
6. **Marcá que esta ronda tuvo al menos un fix** (la ronda ya NO puede terminar el loop; ver §7) y seguí con la siguiente celda.

Regla de oro: **un fix puede introducir una regresión en otra página.** Por eso el loop sólo termina con una ronda completa
SIN fixes (§7). No te saltees la re-verificación.

---

## 6) DEPLOY (opcional, configurable)

Por defecto **NO deployes en cada fix**. Acumulá los commits y, cuando una ronda quede limpia (o cada N rondas), hacé UN deploy:
`railway up --detach --environment production --service api`, esperá el reset de `uptime` en
`https://sanpedro.micuidad.com/api/v1/health`, y verificá en prod las páginas que tocaste. Si el usuario prefiere "no deployar,
solo dejar todo commiteado", respetalo y dejá el deploy para el final.

---

## 7) EL LOOP — mecanismo y condición de PARADA

Mantené un archivo de estado **`AUDIT-LOOP-STATE.md`** en la raíz del repo. Es la **fuente de verdad** y lo que te hace
reanudable: si te quedás sin contexto, una instancia nueva lee este archivo y sigue. Estructura:

```
# AUDIT-LOOP-STATE
ronda_actual: <N>
estado: EN_PROGRESO | LIMPIO_1 | TERMINADO
fixes_en_esta_ronda: <count>
rondas_limpias_consecutivas: <count>

## Inventario (cada celda: página × viewport × tenant)
- [ ] DescuentosPage · 375 · sanpedro
- [x] DescuentosPage · 1280 · sanpedro   (OK, ronda N)
- [!] PerfilPage · 375 · narino  → BUG: <desc> → FIX: <commit> (ronda N)
...

## Bugs encontrados (histórico)
- ronda N · <página> · <tipo> · <desc> · commit <hash>
```

**Algoritmo del loop:**

1. Si no existe `AUDIT-LOOP-STATE.md`, generalo con el inventario completo (§3 × viewports × tenants), `ronda_actual=1`,
   todas las celdas sin marcar.
2. **Ronda**: recorré TODAS las celdas pendientes de la ronda. Por cada una, aplicá §4. Si hay bug, §5 (y `fixes_en_esta_ronda++`).
   Marcá la celda. Anotá el progreso en el archivo a medida que avanzás (no en memoria).
3. Al terminar de recorrer todas las celdas de la ronda:
   - Si `fixes_en_esta_ronda > 0`: **hubo cambios → arrancá una RONDA NUEVA** (`ronda_actual++`, reseteá todas las celdas a
     pendiente, `fixes_en_esta_ronda=0`, `rondas_limpias_consecutivas=0`). Porque un fix pudo regresar otra página.
   - Si `fixes_en_esta_ronda == 0`: **ronda limpia** → `rondas_limpias_consecutivas++`.
4. **Condición de PARADA**: cuando tengas **2 rondas limpias consecutivas** (`rondas_limpias_consecutivas >= 2`) — es decir,
   un barrido completo sin un solo bug, confirmado por un segundo barrido también sin bugs — marcá `estado: TERMINADO` y
   **DETENÉ el loop**. (Pedimos 2 y no 1 para protegernos de que la última ronda con fixes haya dejado algo sutil.)
5. **Salvaguarda anti-oscilación**: si llegás a `ronda_actual > 25` sin terminar, PARÁ igual y reportá: probablemente hay un
   fix que reintroduce otro bug (oscilación) o un "bug" que en realidad es comportamiento esperado — listalos para decisión humana.
   Nunca dejes el loop corriendo de verdad para siempre.

**Al TERMINAR**: dejá el working tree limpio (todo commiteado), pará los servers de dev, borrá datos/cuentas de prueba del
Atlas dev (el comercio `qa-comercio@local.test`, el owner `qa-owner@local.test`), hacé el deploy final si corresponde (§6),
y entregá un **reporte final**: cuántas rondas, cuántos bugs por tipo (visual/funcional) y por surface, y la confirmación de
las 2 rondas limpias. Actualizá la memoria del proyecto.

---

## 8) QUÉ CUENTA COMO "ERROR" (taxonomía — si dudás, es bug)

**Visuales**: overflow/scroll horizontal · texto truncado o desbordado · solapamiento/z-index · contraste insuficiente
(texto sobre la marca, estados) · imágenes/íconos/avatares rotos · layout shift · desalineación · spacing inconsistente ·
estados vacío/cargando/error feos o rotos · tap targets <40px · modal/drawer que no scrollea · roto en un breakpoint ·
dark mode (si aplica) · color de marca que no respeta el tenant.

**Funcionales**: error/warning en consola · request 4xx/5xx inesperado · crash/pantalla en blanco · link/CTA muerto o al
destino equivocado · anchor a id inexistente · validación de form que deja pasar basura o rechaza lo válido · doble-submit/
duplicados · dato incorrecto (NaN, Invalid Date, undefined, $undefined, cálculo mal) · interacción que no responde · guard
de ruta ausente · fuga multi-tenant (datos/identidad de otra ciudad o de otro comercio) · estado/race · cache stale tras
mutación.

---

## 9) REGLAS DURAS

- **Nunca** marques una celda OK sin haberla cargado y probado de verdad en el navegador.
- **Nunca** suprimas/ocultes un error para que "pase"; arreglá la causa.
- **Una celda a la vez**, anotando el progreso en `AUDIT-LOOP-STATE.md` (no en tu memoria) para ser reanudable.
- **Gate verde antes de cada commit.** Commits chicos y atómicos.
- El loop **sólo** se detiene con `rondas_limpias_consecutivas >= 2` o por la salvaguarda de la ronda 25.
- Si encontrás algo que NO es un bug sino una decisión de producto/diseño ambigua, NO inventes el fix: registralo aparte
  como "a decidir" y seguí (no bloquea la terminación si es genuinamente una decisión, pero dejá constancia).

**Arrancá ahora**: levantá el entorno (§2), generá/leé `AUDIT-LOOP-STATE.md`, y empezá la ronda 1 por la PWA del vecino.
