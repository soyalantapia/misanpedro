# Prompt — Test PRECISO del Límite de Uso por Persona (Mi San Pedro)

> Pegá esto como prompt en una sesión de Claude Code parada en `~/dev/misanpedro`
> (rama `feat/limite-uso-por-persona`). Probá la feature de forma exhaustiva y exacta,
> y documentá cada caso con esperado vs actual. No arregles nada salvo que se pida.

---

## Qué se construyó (contexto exacto)
Tope de cuántas veces puede usar **cada persona** un cupón, dentro de una **ventana**.

**Modelo (`Coupon`):**
- `usoMaxPorPersona: number` (default **1**)
- `usoVentana: 'devida' | 'semana' | 'quincena' | 'mes' | 'ilimitado'` (default **`devida`**)
- Ventana→días: **semana=7, quincena=15, mes=30**, `devida`=todo el historial, `ilimitado`=sin tope.
- **Cupones viejos sin estos campos → se tratan como `{1, 'devida'}`** (default → arregla el abuso retroactivo).

**Enforcement (guard real):** `checkUsoLimite(appId, couponId, userId, coupon)` cuenta los `Redemption` de ese `(appId,couponId,userId)` con `redeemedAt >= inicioVentana` y **bloquea** si `usoVentana!=='ilimitado' && usos >= usoMaxPorPersona`. Se aplica en **DOS puntos**:
- `POST /api/v1/activations` (antes de crear la activación)
- `POST /api/v1/redemptions/confirm` (re-chequeo, por carreras / códigos viejos)

Respuesta de bloqueo (exacta): **HTTP 409** con body
```json
{ "ok": false, "error": "…", "motivo": "limite_por_persona", "nextDisponible": "<ISO o null>" }
```
- `nextDisponible` = (canje **más viejo dentro de la ventana**).redeemedAt **+ díasVentana**; `null` si la ventana es `devida` o `ilimitado`.
- El **stock global** (`stockMaximo`/`stockUsado`) es OTRO tope y debe seguir funcionando aparte.

**Serialización pública:** `GET /api/v1/coupons/:id` y el listado exponen `usoMaxPorPersona` y `usoVentana` (con defaults `1`/`devida` para cupones viejos).

**UI comercio:** `AdminCuponEditPage`, paso *"¿Cuándo aplica?"* → selector *"¿Cada cuánto puede usarlo cada persona?"* con: **Una sola vez** (`devida`) · **Una vez por semana** (`semana`) · **Una vez cada 15 días** (`quincena`) · **Una vez por mes** (`mes`) · **Sin límite** (`ilimitado`). Al editar, precarga la opción guardada.

**UI vecino:** en `CouponCard` (badge **"Ya lo usaste"**) y `CuponDetailPage` (botón **"Ya lo usaste"** deshabilitado). Si la ventana es temporal y está bloqueado → *"Disponible el [fecha]"* / *"en N días"*; si es `devida` → no vuelve (sin fecha). Calculado client-side desde los canjeados (`useApiMyActivations('canjeado')`) — el backend es el guard real.

## Setup
- `pnpm dev` (web :5191 base `/misanpedro/`, api :3002). Tenant **`sanpedro`**. Headers de API: `X-Tenant-Slug: sanpedro` + `Authorization: Bearer <token>`.
- **Auth (dev devuelve el código OTP en la respuesta):**
  - Vecino: `POST /auth/request-otp {email}` → `_debugCode`; `POST /auth/verify-otp {email, code}` → tokens. (Registro nuevo: `POST /auth/register` con `dni` 7-8 díg, `whatsapp` y `email` ÚNICOS.)
  - Comercio: `POST /merchant/auth/request-otp {email}` → `_debugCode`; `POST /merchant/auth/verify-otp`. **Ojo: signup comercio es 3/hora** → para repetir, hacé **OTP-login** a un comercio existente (ver `scripts/e2e-limite-uso.sh`, default `com-qa1780756196@test.local`).
- En **dev** podés crear cupones/canjes/usuarios de prueba (DB descartable). Nunca contra prod.

---

## 1) Tests automáticos (corré y que pasen)
```bash
pnpm typecheck                                              # 6/6 verde
pnpm --filter @misanpedro/api exec vitest run src/services/usageLimit.test.ts   # 11/11 (lógica pura)
bash scripts/e2e-limite-uso.sh                             # E2E real → 10 OK · 0 fallos
```
Verificá que el E2E imprima ✅ en: serializa `usoVentana`, 1er canje OK, **2da activación 409 `limite_por_persona`**, "sin límite" repite (201 + canje), `usoMax 2` permite la 2da, y **CONFIRMAR bloqueado** tras bajar el tope.

## 2) Backend — enforcement preciso (vía API, camino de producción)
Para cada caso: logueá comercio (OTP) + vecino (registro/OTP), creá el cupón con los campos, activá y confirmá, y chequeá **HTTP code + body exacto**.

| # | Cupón | Acción | Esperado |
|---|---|---|---|
| B1 | `{usoMaxPorPersona:1, usoVentana:'devida'}` | 1er canje | OK |
| B2 | idem B1 | 2da **activación** | **409**, `motivo='limite_por_persona'`, `nextDisponible=null` |
| B3 | idem B1 | 2da activación luego de borrar… no: confirmar un código viejo | **409** en `/confirm` también |
| B4 | `{usoVentana:'ilimitado'}` | 3 canjes seguidos | los 3 OK (nunca bloquea) |
| B5 | `{usoMaxPorPersona:2, usoVentana:'devida'}` | 2 canjes | ambos OK; **3er** activación → 409 |
| B6 | `{usoMaxPorPersona:1, usoVentana:'semana'}` | canje, luego 2do intento mismo día | 409; `nextDisponible` = `redeemedAt(1er) + 7 días` (exacto, comparar ISO) |
| B7 | `quincena` / `mes` | igual que B6 | `nextDisponible` = `redeemedAt + 15` / `+ 30` días |
| B8 | bloqueo en **/confirm** | crear `usoMax:2`, canjear 1, activar 2da (código B), **PATCH** el cupón a `usoMax:1`, confirmar B | **409** en `/confirm` (lo hace el E2E paso 3) |
| B9 | **stock global** aparte | cupón `stockMaximo:1` + `usoVentana:'ilimitado'` | el 2do canje lo frena el **stock**, no el límite por persona (verificar que el stock sigue vivo) |
| B10 | **backward-compat** | cupón viejo SIN los campos (insertar en Mongo sin `usoVentana`) | 1er canje OK, 2do **bloqueado** (default `{1,'devida'}`) |
| B11 | aislamiento por persona | vecino A canjea hasta el tope; **vecino B** activa el MISMO cupón | B **NO** está bloqueado (el tope es por persona) |
| B12 | aislamiento por cupón | bloqueado en cupón X; activar cupón Y del mismo comercio | Y permitido |

**Ventana temporal "vuelve a estar disponible":** no se puede backdatear `redeemedAt` por el flujo normal. Probalo por (a) los **unit tests** (fechas simuladas, ya cubren 7/15/30 días) y/o (b) insertando en Mongo un `Redemption` con `redeemedAt` viejo y reintentando la activación (debe **permitir** pasados los días de la ventana).

## 3) Comercio — UI del selector
- **C1:** `/admin/cupones/nuevo` → paso *"¿Cuándo aplica?"* muestra el selector con las **5 opciones**.
- **C2:** elegí cada opción y publicá; luego `GET /coupons/:id` → confirmá el par exacto: Una sola vez→`{1,devida}` · por semana→`{1,semana}` · cada 15 días→`{1,quincena}` · por mes→`{1,mes}` · Sin límite→`{_,ilimitado}`.
- **C3:** **precarga al editar** — abrí `/admin/cupones/:id/editar` de un cupón con cada ventana y verificá que la opción correcta quede preseleccionada (naranja).
- **C4:** crear un cupón **sin tocar** el selector → guarda `{1,'devida'}` (default).
- **C5:** el hint *"Evita que la misma persona lo use de más…"* está visible.

## 4) Vecino — UI "usado"
(Logueate como vecino con un canje hecho; podés generar el estado con un script tipo `scripts/e2e-limite-uso.sh` y luego abrir la app con ese token.)
- **V1 (devida, bloqueado):** detalle del cupón → botón **"Ya lo usaste"** deshabilitado, **sin** fecha de vuelta. En la card → badge **"Ya lo usaste"**.
- **V2 (temporal, bloqueado):** detalle → "Ya lo usaste" + **"Disponible el [fecha]"** / "en N días" (coincide con `nextDisponible`).
- **V3 (sin límite):** siempre botón **"Canjear descuento"** habilitado, repite sin bloqueo.
- **V4 (no usado):** botón normal "Canjear descuento".
- **V5 (`usoMax>1`):** con N>1 y algún uso, no bloquea hasta llegar al tope (opcional: "Te quedan N usos").
- **V6:** que el estado del front **coincida** con el backend (si el back bloquea, el front muestra "usado"; si el back deja, el front deja).

## 5) Regresión (no romper)
- Crear/editar/pausar/borrar cupones sigue funcionando (el wizard "Asesor" completo).
- Flujo activar → validar → confirmar (no bloqueado) intacto; stats del comercio + Canjeados + El Club del vecino siguen sumando.
- Stock global sigue operando aparte (B9).
- `pnpm typecheck` verde; suite de api (`vitest run`) verde.

## 6) Edge / robustez
- Código inválido / de otro comercio / cupón vencido → siguen con sus errores propios (no confundir con el 409 del límite).
- Doble-tap de activación (índice único de activación activa) sigue devolviendo la misma activación, sin contar como uso extra.
- `usoMaxPorPersona` fuera de rango (0, 100, negativo) → el schema lo rechaza (Zod min 1 / max 99).
- `usoVentana` inválida → rechazada por el enum.

## Salida — reporte
Tabla con cada caso (B1…B12, C1…C5, V1…V6, regresión, edge): **esperado vs actual + ✅/❌ + evidencia** (HTTP code/body, screenshot). Al final: **veredicto** (¿el límite es hermético en activar y confirmar? ¿la UI lo refleja? ¿no rompió nada?) y lista de bugs por severidad. No inventar: lo que no puedas reproducir, marcalo "No verificado" y por qué.
