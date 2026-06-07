# Reporte — Test PRECISO del Límite de Uso por Persona

- **Fecha:** 2026-06-06 · **Rama:** `feat/limite-uso-por-persona` · dev (web :5191 / api :3002, tenant `sanpedro`).
- **Método:** automáticos (typecheck + unit + E2E) + casos backend exactos por API (camino real) + smoke de UI (comercio + vecino). Auth con OTP de dev / token de comercio válido.

## Veredicto: ✅ La feature está hermética y la UI la refleja — listo (para esta feature)
El tope **bloquea en activar Y en confirmar**, es **por persona** y **por cupón**, respeta las **5 ventanas**, y el `nextDisponible` es **exacto**. La UI del comercio (selector + precarga) y del vecino ("Ya lo usaste" / "Disponible en N días") funcionan. No rompió nada. *(1 nota pre-existente: el "stock global" hoy no bloquea — ver B9.)*

## Resumen
| Bloque | Resultado |
|---|---|
| Automáticos (typecheck 6/6 · unit 11/11 · E2E 10/10) | ✅ |
| Backend exacto (B1–B12) | ✅ (B9/B10 con nota) |
| UI comercio (selector + precarga) | ✅ |
| UI vecino (devida / temporal) | ✅ |
| Regresión + edge | ✅ |
| **Ampliación máximo** (integración DB + races + bordes) | ✅ |

## Ampliación — Testeo MÁXIMO (2026-06-06)
- **Integración con Mongo real (in-memory, `mongodb-memory-server`) — 8/8** sobre el guard `checkUsoLimite` end-to-end (query + decisión): devida; **semana/mes que VUELVEN a liberar** (canjes backdateados); aislamiento por persona y por cupón; usoMax 2 (cuenta solo dentro de la ventana); ilimitado; y **backward-compat con cupón SIN los campos** (insert crudo → `{1,devida}` bloquea). Cubre lo que el unit puro no podía (la ventana que vuelve + el cupón viejo) **con DB real**.
- **Unit ampliado (17)**: bordes — canje EXACTO a 7 días (cuenta), 7d+1ms (fuera), `usoMax 0`→1, ilimitado ignora max, `nextDisponible` usa el más viejo, sin-canjes nunca bloquea.
- **Concurrencia / races (live):** 2 activaciones simultáneas → **misma activación** (dedup, no 2 activas); 2 confirmaciones simultáneas → **integridad OK: exactamente 1 canje** (índice único `{activationId}`); el límite sigue (3º → 409).
  - 🐛→✅ **Hallazgo + fix:** la doble-confirmación (o doble-tap del cajero) devolvía un **HTTP 500 crudo (`E11000`)**. `confirm` ahora **captura el 11000 → "ya canjeado" (409) limpio**. El dato nunca estuvo en riesgo (el índice único garantiza 1 canje); ahora la respuesta es prolija. *(Pre-existente; surgió en el testeo máximo.)*
- **UI:** badge **"Ya lo usaste"** verificado también en la **card del home** (además del detalle).
- **Suite api total: 77/77** (17 unit + 8 integración + 52 existentes) · typecheck 6/6.

---

## Automáticos
- `pnpm typecheck` → **6/6** (FULL TURBO). ✅
- `vitest run src/services/usageLimit.test.ts` → **11/11** (5 ventanas + usoMax>1 + nextDisponible + defaults). ✅
- `bash scripts/e2e-limite-uso.sh` → **10 OK · 0 fallos** (corrida previa; el re-run de hoy pegó el rate-limit de OTP-request, que es del harness, no de la feature). ✅

## Backend — casos exactos (vía API, camino de producción)
| # | Caso | Resultado |
|---|---|---|
| B1 | devida max1 — 1er canje | ✅ OK |
| B2 | devida — 2da **activación** | ✅ **409** `motivo:limite_por_persona`, `nextDisponible:null` |
| B3/B8 | bloqueo en **/confirm** (bajar tope con código activo) | ✅ **409** en confirm |
| B4 | ilimitado — 3 canjes | ✅ nunca bloquea |
| B5 | usoMax 2 — permite 2, frena 3 | ✅ |
| B6 | semana — `nextDisponible` exacto | ✅ **= redeemedAt + 604800000ms (7d)** |
| B7 | quincena — `nextDisponible` | ✅ **= redeemedAt + 1296000000ms (15d)** |
| B7' | mes (30d) | ✅ cubierto por unit test |
| B9 | stock global aparte | ⚠️ **Nota:** hoy el stock **no bloquea** (solo incrementa `stockUsado`, redemptions.ts:185) — gap **pre-existente**, fuera del scope. Mi cambio **no lo toca**. |
| B10 | backward-compat (cupón sin campos) | ✅ vía unit (`evaluarUsoLimite({}, [canje]) → bloqueado`) + `checkUsoLimite` usa `?? 'devida'`. *(No se puede crear un cupón field-less por API: el modelo aplica defaults; requeriría insert crudo en Mongo.)* |
| B11 | aislamiento **por persona** | ✅ vecino A (canjeó) → 409; vecino B → **201** |
| B12 | aislamiento **por cupón** | ✅ bloqueado en X, permitido en Y |
| — | vuelve disponible pasada la ventana | ✅ cubierto por unit (semana hace 8d → permitido). *(No backdateable por API.)* |

## UI — comercio
- **C1/C5** selector *"¿Cada cuánto puede usarlo cada persona?"* con las 5 opciones + hint → ✅ (screenshot).
- **C2** cada opción guarda el par correcto + `GET /coupons/:id` serializa `usoVentana`/`usoMaxPorPersona` → ✅ (E2E + extra).
- **C3** **precarga al editar**: cupón "una sola vez" abre con esa opción preseleccionada → ✅ (screenshot).
- **C4** sin tocar el selector → `{1,'devida'}` por default → ✅.

## UI — vecino
- **V1 (devida, bloqueado):** botón **"Ya lo usaste"** deshabilitado, **sin** fecha de vuelta → ✅ (screenshot).
- **V2 (semana, bloqueado):** **"Ya lo usaste"** + **"Disponible en 7 días"** → ✅ (screenshot, coincide con `nextDisponible`).
- **V3 (sin límite):** backend permite repetir (B4) → botón normal "Canjear".
- **V6:** el estado del front **coincide** con el backend (bloquea cuando el back bloquea) → ✅.

## Regresión / edge
- `pnpm typecheck` verde + suite api **63/63**. ✅
- Crear/editar cupones (wizard Asesor), flujo activar→confirmar (no bloqueado), stats/Canjeados/El Club → siguen funcionando (se ejercitan en cada corrida). ✅
- Código inválido (`000000`) → `no encontrado` (no se confunde con el 409 del límite). ✅
- `usoMaxPorPersona`/`usoVentana` fuera de rango → rechazados por Zod (min 1 / max 99 / enum). ✅

## Notas
- **B9 (stock):** el "stock global" hoy es **feature muerta**: `stockMaximo` **no está en el schema del cupón** → no se puede setear por API, y nunca se enforce (solo incrementa `stockUsado`). Se intentó agregar enforcement y se **revirtió** (código inservible sin forma de setear el tope + fuera de scope). Es una **feature aparte** (schema + UI + enforcement), no parte del límite por persona.
- El smoke creó datos de prueba en la **DB de dev** (descartables). **Signup comercio 3/hora** y **OTP-request 5/hora** → para re-correr, usar el token de comercio vigente o esperar la ventana.
