# REPORTE AUDITORÍA UX — v9 (NAVEGACIÓN REAL · 100% COMERCIO)

**Fecha:** 2026-05-28
**Método:** ⭐ **Navegación REAL en el browser** (repo levantado: web :5180 + API :3009 + Atlas), con un comercio de prueba logueado ("Cafe Prueba WhatsApp", estado `pending_payment`)
**Diferencia clave vs v5:** esta pasada recorrió el panel **corriendo de verdad**, no por lectura de código. Eso detectó bugs de runtime que el análisis estático no ve.
**Regla respetada:** detectar y reportar — **no toqué código** (salvo el crash de la home, ya arreglado y commiteado aparte por ser bloqueante).

---

## 1. Resumen ejecutivo

### 🔥 Las fricciones que más sangran (encontradas EN VIVO)

| # | Problema | Severidad |
|---|----------|-----------|
| **E0** | (ya arreglado) **La home del vecino crasheaba** contra el API real — bug de hooks que solo se ve corriendo la app. Fix commiteado `4e14246` | 🔴 era Crítica |
| **E1** | **El login del comercio NO devuelve `estado`** → el panel no sabe que está `pending_payment`. Un comercio que se re-loguea NO ve el aviso de pago pendiente, el dashboard le dice "Creá tu primer cupón" y el editor le promete "los vecinos lo van a ver al instante" — todo falso hasta que pague | 🟠 Alta |
| **E2** | **"Mi Comercio" no tiene botón de PAGAR** estando `pending_payment`. Solo ofrece "Cancelar suscripción". Un comercio que abandonó el pago en el signup no tiene cómo retomar → no se activa → no cobrás | 🟠 Alta |
| **E3** | Copy "Acá vas a ver a tus clientes **Mi San Pedro**" (falta preposición "de") | 🟢 Baja |

### Sensación general

> **Corriendo de verdad, el panel del comercio se siente sólido y rápido** — el editor de cupón con preview en vivo es excelente, la validación tiene buen manejo de error, los locked states comunican bien, y el fix de soporte (email fallback) ya funciona. **Pero levantar el repo destapó 3 cosas que el análisis estático no veía:** un crash en la home (ya arreglado), y dos bugs alrededor del estado `pending_payment` que hacen que un comercio que no terminó de pagar quede en una zona confusa — el panel actúa como si estuviera activo, y no le da forma de pagar. Para un producto cuyo negocio ES el cobro mensual, eso sangra directo en la conversión.

---

## 2. Diario del comerciante (recorrido en vivo)

*Soy "Cafe Prueba WhatsApp". Me registré pero todavía no pagué (pending_payment). Me logueo de nuevo al otro día.*

1. **Inicio:** Veo mi dashboard: "Canjes hoy 0 / semana 0 / mes 0", un onboarding "Empezá a recibir tus primeros canjes", y un botón grande **"Creá tu primer cupón"**. *Todo bien… pero nada me dice que mi comercio NO es visible porque no pagué.* No hay banner de pago pendiente. (E1)
2. **Validar:** Limpio. Pruebo un código inventado → "No encontramos este código · Probar otro código". Buen mensaje. Abajo veo "Soporte por email" (✓ funciona el fallback).
3. **Descuentos:** "No tenés cupones cargados · Crear primer cupón". OK.
4. **Crear un descuento:** Hermoso — preview en vivo del cupón, chips de %, contadores. Pero el subtítulo dice *"Completá los datos y **los vecinos lo van a ver al instante**"*. **Mentira para mí:** estoy pending_payment, mi cupón NO se publica hasta que pague. (E1)
5. **Clientes:** Locked con candado: "Acá vas a ver a tus clientes **Mi San Pedro**" → suena raro, falta "de". (E3) El resto del locked state está bien.
6. **WhatsApp:** "Conectá WhatsApp Business" con un QR real. ✓ (anda contra el backend)
7. **Mi Comercio:** Acá SÍ aparece "Plan y suscripción · Estándar $25.000 final/mes · Estado: **Esperando primer pago**". *¡Por fin algo me dice que no pagué!* Busco el botón para pagar… **y no está.** Solo "Cancelar suscripción". *¿Cómo pago entonces?* Callejón sin salida. (E2)

> El nudo: el único lugar que sabe que estoy pending es "Mi Comercio" (usa `/me/profile`), pero justo ahí no me deja pagar. El resto del panel (que usa el login) ni se entera de que estoy pending.

---

## 3. Tabla priorizada — Impacto × Esfuerzo

| ID | Problema | Severidad | Esfuerzo | Quick win |
|----|----------|-----------|----------|-----------|
| **E0** | Crash home (hooks) | 🔴 Crítica | 🟢 Bajo | ✅ YA HECHO (`4e14246`) |
| **E1** | Login no devuelve `estado` | 🟠 Alta | 🟢 Bajo (1 campo en el response) | ✅ SÍ |
| **E2** | Sin botón de pagar en pending | 🟠 Alta | 🟡 Medio | ⚠️ Importante |
| **E3** | Copy "clientes Mi San Pedro" | 🟢 Baja | 🟢 Bajo | ✅ SÍ |

---

## 4. Hallazgos detallados

### `[E1]` `[Datos/Estado]` — El login del comercio no devuelve `estado`
📍 **Backend:** `apps/api/src/routes/merchant-auth.ts` (endpoint `/login`, objeto `merchant` del response). **Frontend afectado:** `MerchantShell` (banner), `AdminDashboardPage` (acción rápida), `AdminCuponEditPage` (copy N9).
👀 **Qué vi (en vivo):** Con el comercio en `pending_payment`, `localStorage.misanpedro.merchant.v1 → apiMerchant.estado` es **`undefined`**. El login devuelve solo `{id, slug, nombre, categoria}` — **sin `estado`** (el signup SÍ lo devuelve; el login no). Confirmado por curl al `/login`.
😖 **Por qué molesta:** Toda la lógica condicional de pending_payment del panel depende de `apiMerchant.estado`. Como llega `undefined`:
- No aparece el `PendingPaymentBanner` sticky → el comercio no sabe que no es visible.
- El dashboard muestra "Creá tu primer cupón" en vez de "Activá tu pago".
- El editor de cupón dice "los vecinos lo van a ver al instante" (engañoso).
Un comercio que se registra y vuelve al día siguiente (login, no signup) opera **a ciegas**: crea cupones que no se publican y no entiende por qué.
🔥 **Severidad:** Alta · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Agregar `estado: merchant.estado` (y `arrepentimientoExpiraEn` si aplica) al objeto `merchant` del response de `/login` — igual que ya lo hace `/signup`. Idealmente también en `/refresh` para que sobreviva al refresh de token.

### `[E2]` `[Fricción/Conversión]` — "Mi Comercio" no ofrece pagar estando pending
📍 `apps/web/src/pages/admin/AdminComercioPage.tsx` — `SubscriptionCard` (líneas 874-913).
👀 **Qué vi (en vivo):** Estado "Esperando primer pago", y como única acción **"Cancelar suscripción"**. No hay botón "Pagar" / "Completar pago" / "Ir a MercadoPago" (`hayPagar: false` en el DOM).
😖 **Por qué molesta:** El código del `SubscriptionCard` para `pending_payment` solo renderiza el flujo de cancelar. Un comercio que abandonó el paso de pago del signup (o cuyo pago falló) vuelve al panel y **no tiene cómo pagar** → no se activa → no aparece para vecinos → vos no cobrás. Es un agujero directo de revenue.
🔥 **Severidad:** Alta · 🔧 **Esfuerzo:** Medio
✅ **Recomendación:** En `SubscriptionCard`, cuando `estado === 'pending_payment'`, mostrar un CTA primario **"Pagar suscripción"** que llame a `POST /billing/preapproval` y redirija al `initPoint` de MercadoPago (la misma lógica del paso "pago" del signup). Dejar "Cancelar" como acción secundaria.

### `[E3]` `[Microcopy]` — "clientes Mi San Pedro" sin preposición
📍 `apps/web/src/pages/admin/AdminClientesPage.tsx` (locked state).
👀 **Qué vi:** "Acá vas a ver a tus clientes Mi San Pedro" — el nombre del tenant se interpola sin "de".
✅ **Recomendación:** "Acá vas a ver a tus clientes **de** {tenant}" o simplemente "tus clientes de la app". 🟢 Baja.

---

## 5. Recomendaciones

### Quick wins (antes de vender)
- **E1** — agregar `estado` al login response (1 campo, alto impacto: arregla banner + dashboard + editor de una).
- **E3** — preposición en el copy de Clientes.

### Importante (esta semana)
- **E2** — botón "Pagar suscripción" en Mi Comercio para comercios pending. Sin esto, todo comercio que no pague en el signup queda sin forma de activarse.

### Lo que está EXCELENTE y NO hay que tocar (verificado en vivo)
- ✅ Editor de cupón (preview en vivo, contadores, chips de %)
- ✅ Validación con manejo de error claro (F3) + "probar otro código"
- ✅ Soporte por email (fallback V1/C3 funcionando)
- ✅ Precio "$25.000 final" en el SubscriptionCard (B1)
- ✅ Locked state de Clientes (candado + CTA)
- ✅ WhatsApp ConnectionScreen con QR real del backend
- ✅ Reembolso 10 días (Ley 24.240) bien comunicado en el SubscriptionCard

---

**Veredicto:**
El panel del comercio está bien construido, pero **levantar el repo de verdad valió oro**: encontró un crash en la home (ya arreglado) y dos bugs de `pending_payment` (E1, E2) que dejan a un comercio sin pagar en una zona confusa y sin salida. E1 es un quick win de 1 campo; E2 es el más importante para no perder conversiones. Ninguno se veía en el análisis estático.
