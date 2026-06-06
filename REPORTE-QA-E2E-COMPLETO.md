# Reporte — QA E2E completo (vecino + comercio) · Mi San Pedro

- **Fecha:** 2026-06-06
- **Build:** `main` + dev (`pnpm dev:web` :5191 / api :3002, tenant `sanpedro`).
- **Método:** loop E2E real **vía API** (signup comercio, crear cupón, registrar vecino, activar, validar, confirmar canje + casos de error) y **auditoría visual** de las pantallas logueadas inyectando la sesión real en el navegador (tokens + store de localStorage). El **OTP de dev** (`_debugCode` en la respuesta) permitió loguear ambos roles.
- **Alcance cubierto:** ciclo de vida completo del cupón; panel del comercio (dashboard, crear cupón, validar, mi comercio); vecino logueado (Perfil + El Club, Canjeados); validaciones de backend.
- **No verificado:** paso fiscal del signup en la UI (lo probé por API sin CUIT y pasó), `/admin/whatsapp` y `/admin/referidos` en profundidad, escaneo de QR con cámara real.

## Veredicto: ⚠️ El sistema FUNCIONA E2E y se ve bien — falta data real para lanzar
El **loop completo del cupón anda de punta a punta** y los números **cuadran en ambos lados**. El diseño es coherente (naranja+light) también en el panel del comercio. El bloqueante de lanzamiento sigue siendo **data real (F-001)**. Hay **un hallazgo de negocio a decidir** (tope de canje por persona, F-E01).

## Resumen por severidad
| Sev | # | Hallazgos |
|---|---|---|
| 🔴 Crítico | 1 | F-001 (data real — arrastre) |
| 🟠 Alto | 1 | F-E01 |
| 🟡 Medio | 2 | F-E02, F-E03 |

---

## ✅ El loop E2E del cupón — VERIFICADO (anda)
Probado de punta a punta vía API:
1. **Signup comercio** → nace `estado: activo` (3 meses gratis, matchea el pivot). ✅
2. **Crear cupón** (25%, precioRef $2000) → ok. ✅ *(el backend valida: `descripcion` ≥20 chars, etc.)*
3. **Registrar vecino** → ok. ✅ *(valida DNI 7-8 dígitos)*
4. **Activar** (vecino) → **código de 6 dígitos** + `qrPayload` `msp:act:<codigo>:<couponId>`. ✅
5. **Validar** (comercio, por código) → ok, devuelve cliente + `isFirstVisit`. ✅
6. **Confirmar canje** (monto $5000) → ok, **ahorroEstimado $1250 = 5000×25%** (cálculo correcto). ✅
7. **Consistencia ambos lados:** vecino → Canjeados ($1000/4000×25%, ticket/pagaste/ahorraste correctos) + billetera + **El Club (Bronce, 1 entrada, racha 1 mes)**; comercio → dashboard **2 canjes, $9.000 ingresos, $2.250 ahorro a clientes, 2 clientes**. **Los números coinciden.** ✅

### Validaciones de backend — sólidas ✅
| Caso | Resultado |
|---|---|
| Confirmar **sin monto** | ❌ rechazado (`invalid input`) — el monto es obligatorio **server-side**, no solo en el front |
| Confirmar **monto $99.000.000** | ❌ rechazado — **cap server-side** (≈$10M) |
| **Doble canje** de la misma activación | ❌ `ya canjeado` |
| Código **inválido** (`000000`) | ❌ `no encontrado` |
| Signup repetido rápido | ❌ `demasiados intentos` — **rate-limit** ✅ |

### Visual de pantallas logueadas — on-brand ✅
- **Comercio:** dashboard (stats correctas), **crear cupón = wizard guiado** ("Armemos un cupón fuerte" → objetivo → …), validar (QR + código 6 díg), **Mi comercio** (micro-sitio con preview + plan). Todo **naranja+light, sin violeta** — el panel respeta el design system del vecino.
- **Vecino:** **Perfil + El Club** (🥉 Socio Bronce, "1 cupón usado en junio", "Te faltan 3 canjes para Plata", "1 entrada al sorteo de junio", ahorro total verde, racha 1 mes — *esto cierra el F-011 del reporte anterior*); **Canjeados** (ticket/pagaste/ahorraste correctos).

---

## 🔴 Crítico

### [F-001] El catálogo es data de prueba (arrastre del reporte de auditoría)
- **Severidad:** 🔴 · **Rol:** Vecino · **Categoría:** Producción/Datos
- En prod el catálogo muestra cupones/comercios "QA Test". Hay que **cargar comercios reales + purgar la data de prueba** (ops del operador). **Bloqueante de lanzamiento.** *(Nota: en DEV esta auditoría creó comercios/cupones/canjes de prueba — son descartables, no afectan prod.)*
- **Estado:** Abierto

## 🟠 Alto

### [F-E01] Un vecino puede canjear el MISMO cupón ilimitadas veces (sin tope por persona)
- **Severidad:** 🟠 · **Rol:** E2E · **Categoría:** Funcional / Negocio / Abuso
- **Repro:** con el mismo vecino, re-activar un cupón ya canjeado genera una **nueva activación**, y **confirmar el 2do canje devuelve `ok:true`** (verificado: 2do canje, ahorro $750). No hay límite "una sola vez por persona" ni por período.
- **Esperado vs Actual:** varios cupones dicen *"Una sola vez por persona"* / son "descuento de bienvenida" (objetivo `traer_nuevos`). Actual → el backend permite re-canjear sin tope → **riesgo de abuso financiero al comercio** (otorga el descuento cada vez).
- **Fix sugerido:** límite de canje por (vecino × cupón), configurable por cupón (una vez / una vez por día / sin límite). Enforzar en `/redemptions/confirm`. Esfuerzo: M.
- **Estado:** Abierto

## 🟡 Medio

### [F-E02] La ficha del comercio muestra "suscripción paga / reembolso" en un comercio que está en 3 meses gratis
- **Severidad:** 🟡 · **Rol:** Comercio · **Categoría:** Copy / Producción
- **Dónde:** `/admin/comercio` → "Plan y suscripción": "Plan Estándar · $50.000 final/mes", "Estado Activa", "Reembolso disponible hasta DD/MM", "Si cancelás ahora te devolvemos el 100% del **primer pago**", botón "Cancelar suscripción".
- **Problema:** con el pivot (3 meses gratis **sin tarjeta**, MP bypasseado) el comercio **no hizo ningún pago** → no hay "primer pago" que reembolsar ni suscripción que cancelar. Debería mostrar **"Prueba gratis hasta DD/MM"** y CTA acorde. (Coincide con el cabo suelto conocido de copy de facturación stale.)
- **Fix:** estado de "prueba gratis" en el panel; reservar el copy de reembolso/suscripción para cuando exista cobro real. Esfuerzo: M.
- **Estado:** Abierto

### [F-E03] Paso fiscal del signup — no verificado en UI
- **Severidad:** 🟡 · **Rol:** Comercio · **Categoría:** Funcional / Cobertura
- Por **API** el signup acepta el alta **sin CUIT** (✅ es opcional en el backend). El cabo suelto conocido es que el **formulario** del signup pediría CUIT pese a decir "Opcional" → **verificar en la UI** `/admin/registro` el paso fiscal y el copy de facturación.
- **Estado:** No verificado (UI)

---

## ✅ Lo que está bien (no romper)
- Loop del cupón **completo y consistente** en ambos lados; cálculos correctos (ahorro = monto×%).
- Backend **robusto**: monto obligatorio + cap, anti-doble-canje, código inválido, rate-limit en signup.
- **Panel del comercio** prolijo y **on-brand** (naranja+light): dashboard con métricas reales, crear-cupón como wizard guiado, validar claro (QR/código), Mi comercio = micro-sitio con preview.
- **El Club** funcionando con datos reales (nivel/entradas/racha) — verificado live.
- **OTP de dev** (`_debugCode`) operativo para ambos roles → testeo E2E reproducible.
- Fixes del reporte de auditoría anterior (theme-color, 404, 401 deslogueado, comercio compacto, alertas) ya aplicados en `main`.

## 🚦 Bloqueantes / prioridad para producción
1. **F-001** — cargar comercios reales + purgar data de prueba (ops). 🔴
2. **F-E01** — decidir e implementar tope de canje por persona/cupón (anti-abuso). 🟠
3. **F-E02** — alinear el panel del comercio con "3 meses gratis" (sacar suscripción/reembolso hasta que haya cobro). 🟡
4. **F-E03** — revisar el paso fiscal del signup en la UI. 🟡
