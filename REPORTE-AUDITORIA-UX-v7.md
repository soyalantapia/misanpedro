# REPORTE AUDITORÍA UX — v7 (14ª pasada · 100% OWNER PANEL)

**Fecha:** 2026-05-28
**Foco exclusivo:** el panel del OWNER (el SaaS admin que usás vos para operar)
**Modo:** análisis estático en piel del owner, sin app corriendo
**Alcance:** `apps/owner/src/**` (ShellLayout, LoginPage 2FA, Dashboard, Apps, NewApp, AppDetail, Merchants, Subscriptions, Users, Settings)
**Regla respetada:** solo detecto y reporto — **no toqué código**

---

## 1. Resumen ejecutivo

### 🔥 Fricciones del owner panel

| # | Problema | Severidad |
|---|----------|-----------|
| **OW1** | `ShellLayout.tsx:76` — el logo del topbar **mobile** muestra una **"c" minúscula** (remanente de Cuponcito). El desktop usa "M". Inconsistencia de marca | 🟡 Media |
| **OW3** | Tablas de Pagos / Comercios / Vecinos usan `overflow-hidden` → en mobile **cortan las columnas de la derecha** sin scroll horizontal | 🟡 Media |
| **OW4** | `NewAppPage` promete "Después podés ajustar logo, hero copy y horarios desde el detalle" pero `AppDetailPage` es **read-only** — no hay edición de branding | 🟡 Media |
| **OW2** | Fallbacks de inicial `'C'` en `NewAppPage:311` y `AppDetailPage:89` (deberían ser `'M'`) | 🟢 Baja |

### Sensación general

> **El owner panel está bien construido y es funcional.** Login 2FA completo (QR + secret manual + recovery), dashboard con KPIs y charts, wizard de creación de apps en 3 pasos con auto-slug y preview, tablas filtrables, DNS setup card. Es un admin interno sólido. Los hallazgos son menores: remanentes de marca ("c"/"C"), tablas que no scrollean en mobile, y una promesa de edición que el detalle de app no cumple. Nada bloquea operar, pero vale pulirlo porque es la herramienta con la que vas a manejar el negocio.

---

## 2. Diario del owner · escenarios

### Escenario 1 — Login con 2FA
- `credentials → setup2fa (QR) → totp → success`. Completo y claro. Setup con QR + "¿No podés escanear? Mostrar secret". Recovery de password presente. ✓
- Edge case menor: en `handle2FASetup` se reusa el mismo código TOTP para verificar y re-loguear; si está por expirar, el re-login puede fallar y dejás "2FA activado pero sin sesión" (el código lo maneja con un mensaje, pero el estado queda raro). Baja.

### Escenario 2 — Dashboard a la mañana
- KPIs (MRR, apps, comercios, vecinos, canjes 30d) + bar chart por ciudad + pie por status + CTA "Sumá una nueva ciudad". Limpio y útil. ✓

### Escenario 3 — Creo una ciudad nueva
- Wizard 3 pasos (ubicación → dominio → branding) con auto-slug, preview de branding, validación por paso, subdomain `.misanpedro.app`. Muy bien. ✓
- Al terminar, en el detalle de la app quiero cambiar el color → **no puedo** (OW4): el detalle es solo lectura, aunque el wizard me prometió que iba a poder editarlo.

### Escenario 4 — Reviso pagos desde el celu
- Voy a Pagos en el teléfono. La tabla tiene 6 columnas (Comercio, App, Plan, Monto, Próx cobro, Estado). El contenedor es `overflow-hidden` → **las columnas Monto/Próx cobro/Estado quedan cortadas** y no puedo scrollear para verlas (OW3). Justo la info que vengo a ver (¿quién pagó?) es la que se corta.

### Escenario 5 — Branding del panel
- En desktop el logo dice "M" (Mi San Pedro). En mobile el topbar muestra una **"c"** (OW1). Detalle, pero es mi propia herramienta y la marca tiene que ser coherente.

---

## 3. Tabla priorizada

| ID | Problema | Severidad | Esfuerzo | Quick win |
|----|----------|-----------|----------|-----------|
| **OW1** | Logo mobile "c" → "M" | 🟡 Media | 🟢 Bajo | ✅ SÍ |
| **OW3** | Tablas cortan en mobile (`overflow-hidden` → `overflow-x-auto`) | 🟡 Media | 🟢 Bajo | ✅ SÍ |
| **OW2** | Fallbacks 'C' → 'M' | 🟢 Baja | 🟢 Bajo | ✅ SÍ |
| **OW4** | AppDetail read-only vs promesa de edición | 🟡 Media | 🟡 Medio | ✅ RESUELTO (editor implementado) |

---

## 4. Hallazgos detallados

### `[OW1]` Logo mobile "c" (remanente Cuponcito)
📍 `apps/owner/src/layouts/ShellLayout.tsx:76` → `<span className="text-xs font-black">c</span>`
✅ Cambiar a `M` (el desktop, línea 51, ya usa "M").

### `[OW3]` Tablas no scrollean en mobile
📍 `SubscriptionsPage.tsx:86`, `MerchantsPage.tsx:96`, `UsersPage.tsx:114` — todas usan `<div className="overflow-hidden rounded-2xl ...">` envolviendo una `<table className="min-w-full">`.
😖 En mobile la tabla excede el ancho y `overflow-hidden` la recorta sin permitir scroll. El owner no ve las columnas derechas.
✅ Cambiar `overflow-hidden` → `overflow-x-auto` en los 3 wrappers (mantener `rounded-2xl`). Las cards de AppsPage no tienen este problema (usan grid).

### `[OW4]` AppDetail read-only vs promesa de edición — ✅ RESUELTO
📍 `NewAppPage.tsx` (StepBrand) prometía edición posterior; `AppDetailPage.tsx` era read-only.
✅ **Implementado** un editor opt-in en AppDetail (botón "Editar"): nombre, ciudad, provincia, **status** (activar/suspender/archivar), dominio propio, logo, colores primario/accent y hero eyebrow/headline. Usa el endpoint que ya existía (`PATCH /owner/apps/:id`, validado con Zod). El modo lectura queda intacto; la edición es opt-in.

### `[OW2]` Fallbacks 'C' → 'M'
📍 `NewAppPage.tsx:311` y `AppDetailPage.tsx:89` — `?? 'C'` / `?? 'C'` en el placeholder de inicial.
✅ Cambiar a `'M'` por coherencia de marca (solo se ven si la ciudad está vacía, pero es trivial).

---

## 5. Recomendaciones

### Quick wins (bajo riesgo, los puedo aplicar ya)
- **OW1** logo "c" → "M"
- **OW3** `overflow-hidden` → `overflow-x-auto` en las 3 tablas
- **OW2** fallbacks 'C' → 'M'
- **OW4 (opción b)** ajustar copy del wizard para no prometer edición inexistente

### Mejora estratégica (post-launch)
- **OW4 (opción a)** edición de branding/hero/horarios desde AppDetail
- 2FA setup: tolerar expiración del TOTP entre verify y re-login

### Lo que está bien y no hay que tocar
- ✅ LoginPage 2FA (setup QR + secret + recovery)
- ✅ Dashboard (KPIs, charts recharts, CTA)
- ✅ NewAppPage wizard (auto-slug, preview, validación por paso)
- ✅ AppsPage (cards responsive con stats)
- ✅ Filtros + skeletons + empty states en todas las tablas
- ✅ DnsSetupCard en AppDetail

**Veredicto:** El owner panel está listo para operar. OW1/OW2/OW3 son quick wins de pulido; OW4 conviene resolverlo aunque sea ajustando el copy.
