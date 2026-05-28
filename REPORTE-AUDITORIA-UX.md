# 🕵️ Auditoría UX — "En la piel del usuario" · v2

**Plataforma:** Cuponcito · PWA de descuentos vecinales · panel comercio multi-tenant
**URL DEV:** http://localhost:5180/misanpedro/ (Vite + React 19 + Tailwind 4)
**Auditor:** Claude — persona simulada de "Sandra, comerciante recurrente"
**Fecha:** 2026-05-28 · 2ª vuelta tras aplicar 11 quick wins de la v1
**Método:** Navegación real con preview interactivo (mobile 375×812) + 6 escenarios

> **Nota previa**: este es el segundo pase de "auditoría en piel del usuario". El primer reporte (`REPORTE-AUDITORIA-UX-v1.md`) detectó 18 fricciones (F1-F18), de las cuales **11 fueron aplicadas** entre la v1 y esta v2. Esta segunda vuelta **encuentra menos hallazgos críticos** (es buena señal del progreso), pero descubre **9 fricciones nuevas** que el primer pase no captó porque están en pantallas o estados que no recorrí antes.

---

## 1. Resumen ejecutivo

**Sensación general en 3 líneas:**
Cuponcito **se siente más maduro que en la v1**. Los fixes de copy (CC05 "Volver", F14 "Tocá para pagar", F3 errores específicos en validación, F17 "WhatsApp" en nav) están vivos y mejoran sensiblemente la experiencia. Pero al recorrer pantallas más periféricas (WhatsApp connection, Mis Clientes locked, editor de cupones desde pending_payment) **aparecen pequeñas grietas**: duplicación visual del aviso de pago, copy que sigue prometiendo cosas que el estado del comercio bloquea, falta de loading state en QR generation.

### Las 5 fricciones que más sangran (ahora)

| # | Fricción | Dónde duele |
|---|---|---|
| 🔴 1 | **El editor de cupones está fuera del MerchantShell** → en pending_payment NO se ve el banner sticky | Crear/editar cupón sin saber que está bloqueado |
| 🟠 2 | **QR de WhatsApp canvas vacío sin loading state** | Sandra ve un rectángulo violeta vacío y se pregunta si está roto |
| 🟠 3 | **Dashboard duplica el aviso pending_payment** (sticky + card amarillo) | Saturación visual, "ya entendí" |
| 🟠 4 | **Código fallido no se autolimpia** tras error en Validar | Reintentar en el mostrador requiere borrar 6 dígitos manualmente |
| 🟡 5 | **Copy en editor de cupón sigue diciendo "los vecinos lo van a ver al instante"** cuando pending_payment lo bloquea | Promesa contradictoria con el banner amarillo |

### 3 quick wins (hacer esta semana)

1. **Mover `AdminCuponEditPage` dentro del MerchantShell** o agregarle banner pending_payment propio.
2. **Spinner / placeholder "Generando QR…"** mientras el canvas de WhatsApp está vacío.
3. **Autolimpiar el input de código** tras error en Validar (`setCode('')` cuando `!result.ok`).

---

## 2. Diario del usuario (narrativa)

### 🏪 Sandra, dueña de "La Esquina", abre Cuponcito un lunes 10:30

> *Login, llego al dashboard. Lindo. Veo arriba un **banner color durazno apretado** que dice "Suscripción pendiente · tu comercio no es visible. Tocá para pagar". OK, entendí. Sigo bajando.*

> *Más abajo, **otro card amarillo más grande** que dice exactamente lo mismo: "Suscripción pendiente de pago — Mientras no completes el pago, tu comercio NO es visible para los vecinos. Tocá para pagar."*

> *¿Por qué me lo dicen dos veces, una arriba de la otra? Ya entendí la primera. Me siento gritada.*

**[N1 — Duplicación visual]**

> *Más abajo, los KPIs: 0 / 0 / 0. Esperable porque no estoy activa. Y después la "Acción rápida" violeta gigante "Activá tu pago para empezar" → tres veces el mismo mensaje en la misma pantalla.*

> *Voy a Validar. Pruebo tipear un código fake "123456" — error claro: **"No encontramos este código · Revisá los dígitos con el cliente. Si sigue fallando, que abra el QR."*** ✓ Muy bien escrito.*

> *Pero ahora me quedo con "123456" tipeado en el input. Si llega otro cliente tengo que borrar uno por uno los dígitos antes de tipear el nuevo código. Tonto.*

**[N3 — Sin autolimpieza en error]**

> *Voy a Cupones → "Crear nuevo descuento". Llego al editor.*

> *El banner amarillo de "tu comercio no es visible" **desapareció**. Acá no está. Es como si fuera otra app.*

**[N2 — Editor outside MerchantShell]**

> *Y arriba dice "Para QA Browser Comercio. Completá los datos y **los vecinos lo van a ver al instante**." Pero NO van a verlo porque estoy en pending_payment. ¿Me están mintiendo?*

**[N9 — Copy contradictorio en editor]**

> *Vuelvo. Voy a "Mis clientes". Locked state con un candado lindo. "Acá vas a ver a tus clientes Cuponcito". Botón "Ir a validar un cupón" como CTA. OK.*

> *Pero el chip "MIS CLIENTES" está DEBAJO del candado, no arriba como en las otras pantallas. Se siente diferente, como si fuera otro componente.*

**[N8 — Convención visual rota en locked state]**

> *Voy a WhatsApp. Header dice "Conectá WhatsApp Business". Bien. Y veo un rectángulo violeta gigante **completamente vacío** en la zona donde debería estar el QR.*

> *¿Está cargando? ¿Se rompió? No hay spinner, no hay texto. Solo un rectángulo vacío.*

**[N4 — QR sin loading state]**

> *Abajo del rectángulo, las instrucciones 1-2-3-4 de cómo escanear. Buenas. Pero el QR sigue vacío.*

> *Bajo y veo que hay un botón "Ya escaneé, conectar" que ya está **a medias tapado por el bottom nav floating**.*

**[N6 — Bottom nav floating tapa CTA primario]**

> *Y el chip de la página dice "PROMOCIONES" pero el nav de abajo dice "WhatsApp". ¿Cuál es la palabra real?*

**[N5 — "Promociones" vs "WhatsApp" inconsistencia]**

> *Voy a /comercio para cambiar mis horarios del sábado. Me redirige a Inicio. ¿Por qué?*

> *(Probablemente porque la sesión simulada no tiene merchant cargado, pero como usuario real no entiendo el bounce.)*

---

## 3. Tabla priorizada — Matriz Impacto × Esfuerzo

| ID | Problema | Severidad | Esfuerzo | ¿Quick win? |
|----|----------|-----------|----------|-------------|
| **N2** | Editor cupón OUT del MerchantShell → sin banner pending_payment | 🔴 Crítica | Bajo | ✅ |
| **N4** | QR canvas vacío sin loading state | 🟠 Alta | Bajo | ✅ |
| **N1** | Dashboard duplica aviso pending_payment | 🟠 Alta | Bajo | ✅ |
| **N3** | Código no se autolimpia tras error en Validar | 🟠 Alta | Bajo | ✅ |
| **N9** | Editor cupón: copy "los vecinos lo van a ver al instante" engañoso si pending | 🟡 Media | Bajo | ✅ |
| **N5** | Chip "PROMOCIONES" contradice nav "WhatsApp" | 🟡 Media | Bajo | ✅ |
| **N6** | Bottom nav floating tapa CTA "Ya escaneé, conectar" en WhatsApp | 🟡 Media | Bajo | ✅ |
| **N7** | Iconos circulares header (bell + logout) sin label visible | 🟡 Media | Medio | — |
| **N8** | Mis Clientes locked: chip debajo del candado rompe convención | 🔵 Baja | Bajo | — |
| **F9** *(arrastrado v1)* | Bottom nav merchant 6 ítems apretado en mobile chico | 🟡 Media | Medio | — |
| **F13** *(arrastrado v1)* | "Cupones" / "Descuentos" / "Promociones" — 3 sinónimos | 🟡 Media | Bajo | ✅ |

---

## 4. Hallazgos detallados

### [#N1] [Comunicación] — Dashboard duplica el aviso pending_payment dos veces consecutivas
📍 **Ubicación:** `AdminDashboardPage` + `MerchantShell` (PendingPaymentBanner sticky-top).
👀 **Qué vi:** Al llegar al Inicio veo arriba el banner sticky color durazno **"Suscripción pendiente · tu comercio no es visible. Tocá para pagar"** y, scrolleando 1 pantalla, otro card amarillo **más grande** con el mismo mensaje ampliado. Y, justo abajo, la "Acción rápida" violeta gigante "Activá tu pago para empezar" → **3 avisos de lo mismo en una sola pantalla**.
😖 **Por qué molesta:** Sandra siente que la app le está gritando. Después de ver el primero, los siguientes generan "ya entendí, dejá de pegarme con esto". Sensación de no-respetar-la-atención. Pesa más en pantallas pequeñas donde los 3 avisos ocupan ~60% del viewport.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Ya que el `PendingPaymentBanner` del MerchantShell es persistente y cumple su rol, **eliminar el card amarillo en el body del AdminDashboardPage** (líneas 109-126 del file) — pasa a ser redundante. Y el "Acción rápida" violeta queda como CTA-único para el call-to-action de pagar, ya con `<CreditCard>` icon en lugar de `<Tag>`.

### [#N2] [Flujo + Comunicación] — Editor de cupones queda OUT del MerchantShell → sin banner pending_payment
📍 **Ubicación:** `App.tsx:77-78` → las rutas `/admin/cupones/nuevo` y `/admin/cupones/:id/editar` están **fuera** del `<Route path="admin" element={<MerchantShell />}>`.
👀 **Qué vi:** En pending_payment, voy a /admin/cupones → veo el banner. Click "Crear nuevo" → entro al editor → el banner DESAPARECE. La pantalla no me recuerda que mi comercio sigue invisible para los vecinos. Si trabajo 5 minutos creando un cupón hermoso, lo guardo, vuelvo a /admin/cupones → sigue invisible.
😖 **Por qué molesta:** Es exactamente el problema que el F7 fix quiso resolver (banner persistente). Pero la ruta del editor estaba afuera del shell y nadie lo notó. Regresión parcial silenciosa. Trabajo desperdiciado.
🔥 **Severidad:** Crítica
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Dos opciones:
- **Opción A** (más correcta): mover `<Route path="admin/cupones/nuevo">` y `<Route path="admin/cupones/:id/editar">` dentro del `<Route path="admin" element={<MerchantShell />}>`. Hereda el banner sticky automáticamente.
- **Opción B** (más rápida): importar el componente `PendingPaymentBanner` y renderizarlo manualmente al tope del `AdminCuponEditPage`.

### [#N3] [Funcional + UX] — Código tipeado no se autolimpia tras error
📍 **Ubicación:** `AdminValidarPage.tsx` función `CodeMode`.
👀 **Qué vi:** Tipeo "123456" → "No encontramos este código". El input sigue mostrando "1 2 3 4 5 6". Si llega otro cliente tengo que borrar los 6 dígitos manualmente antes de tipear el suyo.
😖 **Por qué molesta:** En el mostrador, con el cliente esperando, cada segundo cuenta. Borrar 6 dígitos uno por uno (no hay clear button) es fricción acumulada cada vez que un cliente tipea mal. Sandra apura, se equivoca, y la app no la ayuda.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Agregar un botón "Probar otro código" en el `ResultPanel` cuando `!result.ok` que ejecute `setCode('')` y focus del input. Bonus: autolimpiar después de 5s mostrando el error.

### [#N4] [Feedback + Performance percibida] — QR canvas vacío sin loading state en WhatsApp
📍 **Ubicación:** `AdminWhatsappPage.tsx` función `ConnectionScreen`, lines 159-163.
👀 **Qué vi:** Llego a /admin/whatsapp. Veo un **rectángulo violeta grande completamente vacío**. Después abajo las instrucciones 1-2-3-4 de cómo escanear. ¿Qué pasa? ¿Está cargando? ¿Se rompió mi internet? ¿Debo refrescar?
😖 **Por qué molesta:** El usuario queda en limbo. La generación del QR depende del backend (`/wa/start` + stream SSE con evento `qr`); si el backend no está disponible o tarda, el canvas queda vacío indefinidamente. Sin feedback, Sandra cree que está roto.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Mostrar un estado intermedio mientras `wa.qr` está vacío:
```tsx
{!wa.qr ? (
  <div className="grid h-60 w-60 place-items-center text-xs text-neutral-400">
    <div className="flex flex-col items-center gap-2">
      <RefreshCw size={20} className="animate-spin text-accent-500" />
      <span>Generando QR…</span>
    </div>
  </div>
) : (
  <canvas ref={canvasRef} ... />
)}
```
Y si tras 10s el QR sigue sin llegar, mostrar fallback: *"El servicio de WhatsApp Business no responde. Intentá refrescar o avisanos."*

### [#N5] [Comunicación] — Chip "PROMOCIONES" en /admin/whatsapp contradice el nav "WhatsApp"
📍 **Ubicación:** `AdminWhatsappPage.tsx` chip arriba del título.
👀 **Qué vi:** El bottom nav dice "WhatsApp" (fix F17 aplicado). Pero la página tiene un chip "PROMOCIONES" arriba a la izquierda. Dos palabras para la misma sección. La marca elegida (post-F17) es "WhatsApp" → el chip debería decir lo mismo.
😖 **Por qué molesta:** Confunde a un usuario que viene por primera vez. ¿Es la sección de WhatsApp o de Promociones? Inconsistencia interna.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cambiar el chip de "PROMOCIONES" a "WHATSAPP" (o a "CAMPAÑAS" si querés diferenciar). Lo importante: que coincida con el label del nav.

### [#N6] [UI + Mobile] — Bottom nav floating tapa el CTA "Ya escaneé, conectar"
📍 **Ubicación:** `AdminWhatsappPage.tsx` `ConnectionScreen` botón fixed-bottom + `MerchantShell` bottom nav.
👀 **Qué vi:** El `ConnectionScreen` tiene un botón "Ya escaneé, conectar" con `position: fixed; bottom: 0`. PERO también está el bottom nav del MerchantShell con `bottom-3` (12px). Ambos compiten por el mismo espacio en mobile. En el screenshot no se ve el botón porque queda tapado.
😖 **Por qué molesta:** El CTA primario de la página es invisible. Sandra puede no saber qué tocar después de escanear.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Subir el botón "Ya escaneé" más arriba (`bottom-24` por ejemplo, dejando espacio para el nav). O incrementar el `padding-bottom` del `<main>` del MerchantShell para que el scroll alcance a mostrar todo el CTA.

### [#N7] [A11y + UI] — Iconos circulares en header sin label visible
📍 **Ubicación:** `MerchantShell.tsx` mobile header — botones bell + logout sin texto.
👀 **Qué vi:** Arriba a la derecha hay 2 botones circulares grises: una campana (notificaciones) y un icono de salida. Sin texto. Sandra puede no saber qué hacen sin haberlos probado.
😖 **Por qué molesta:** El logout en particular es DESTRUCTIVO en sesión (te saca). Si Sandra se confunde y toca pensando que es "perfil" o "configuración", se sale sin querer.
🔥 **Severidad:** Media (alta para nuevos, baja para recurrentes que ya lo aprendieron)
🔧 **Esfuerzo:** Medio
✅ **Recomendación:** Dos opciones:
- Agregar tooltip sobre hover/long-press
- O, en mobile, separar el botón "salir" en un menú "más" (kebab vertical) para reducir riesgo de mistap

### [#N8] [UI] — Mis Clientes locked: chip "MIS CLIENTES" debajo del candado rompe convención
📍 **Ubicación:** `AdminClientesPage.tsx` componente `LockedState`.
👀 **Qué vi:** En las demás pantallas del admin la jerarquía es: chip arriba → título grande → descripción. En el LockedState es: icono candado grande → chip MIS CLIENTES → título → descripción → CTA. Roto.
😖 **Por qué molesta:** Cosmético, pero se nota como "esta pantalla es distinta al resto". Quita sensación de cuidado.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Reordenar para que el chip "MIS CLIENTES" esté arriba del candado (siguiendo la convención del resto del panel).

### [#N9] [Microcopy] — Editor cupón: "los vecinos lo van a ver al instante" cuando pending_payment lo bloquea
📍 **Ubicación:** `AdminCuponEditPage.tsx` subtítulo del header.
👀 **Qué vi:** "Para QA Browser Comercio. Completá los datos y **los vecinos lo van a ver al instante**." Pero si el comercio está pending_payment, NO lo van a ver. Y el banner sticky que avisaba esto desapareció en esta ruta (ver N2).
😖 **Por qué molesta:** Promesa engañosa. Sandra cree que está produciendo valor cuando en realidad nada se está publicando.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Condicionar el copy al estado del merchant:
- Si `activo`: "los vecinos lo van a ver al instante"
- Si `pending_payment`: "se va a publicar cuando completes el pago"
- Si `suspendido` / `cancelado`: bloquear el editor con redirect

### [#F9] *(arrastrado v1)* [UI + A11y] — 6 ítems en bottom nav admin apretados
📍 **Ubicación:** `MerchantShell.tsx` mobile bottom nav.
👀 **Qué vi:** Inicio / Validar / Cupones / Clientes / WhatsApp / Comercio. 6 ítems en 375px = ~62px cada uno. Iconos chicos, labels chicos. Tap targets borderline.
😖 **Por qué molesta:** Mistaps frecuentes en uso real (Sandra apura entre clientes y termina en sección equivocada).
🔥 **Severidad:** Media (alta en uso intensivo)
🔧 **Esfuerzo:** Medio (cambio de IA)
✅ **Recomendación:** Reducir a 5 ítems agrupando "Comercio" + "WhatsApp" en un menú "Más" (icono ⋯). Inicio + Validar + Cupones + Clientes + Más.

### [#F13] *(arrastrado v1)* [Comunicación] — "Cupones" / "Descuentos" / "Promociones": 3 sinónimos sin convención
📍 **Ubicación:** Toda la app.
👀 **Qué vi:** En `AdminCuponesPage` chip="MIS CUPONES" + h1="Descuentos del comercio". En `AdminWhatsappPage` chip="PROMOCIONES" + nav="WhatsApp". En vecino DescuentosPage chip="DESCUENTOS VIGENTES". En MisCuponesPage chip="PENDIENTES DE CANJEAR".
😖 **Por qué molesta:** Confusión léxica. ¿Son lo mismo? ¿Hay diferencia? La app no decidió.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo (decidir convención + reemplazar strings)
✅ **Recomendación:** Convención propuesta:
- **"Descuento"** = la promo desde el lado del comercio (lo que crea + edita)
- **"Cupón"** = la promo desde el lado del vecino (lo que activa + usa)
- **"Campaña"** = comunicación masiva (WhatsApp), NO "promoción" (palabra reservada al descuento real)

---

## 5. Recomendaciones

### Quick wins — hacer esta semana (impacto inmediato, ≤2h c/u)

| Fix | Impacto |
|-----|---------|
| **N2** — Mover editor cupón dentro del MerchantShell | Cierra regresión silenciosa del banner pending_payment |
| **N4** — Spinner "Generando QR…" en WhatsApp connection | Saca del limbo a Sandra en su primer setup |
| **N1** — Eliminar card amarillo del Dashboard (el sticky banner ya cumple) | Reduce ruido visual |
| **N3** — Botón "Probar otro código" + autoclear en Validar | Fricción menos en mostrador |
| **N9** — Copy condicional en editor según `merchant.estado` | Honestidad operativa |
| **N5** — Chip "PROMOCIONES" → "WHATSAPP" en `AdminWhatsappPage` | Consistencia léxica |
| **N6** — `bottom-24` en botón "Ya escaneé" del WhatsApp | CTA visible |

**Estimado total: ~3-4h dev.**

### Mejoras estratégicas — próximos sprints

- **F13** — Adoptar y propagar el glosario "Descuento / Cupón / Campaña" en toda la app. Documento de convención + sweep de strings + tests con assertions sobre términos.
- **F9** — Rediseñar el bottom nav del admin de 6 → 5 ítems con menú "Más".
- **N7** — Sistema de tooltips/labels visibles en iconos del header (especialmente logout) o relocalizar acciones destructivas a un menú secundario.

### Lo que está mejor que en v1 (no tocar)

- Banner sticky pending_payment del MerchantShell (F7 aplicado)
- CTA "Activá tu pago para empezar" como acción rápida (F2)
- Errores específicos por reason en Validar (F3): "No encontramos este código · Revisá los dígitos con el cliente"
- Copy "Tocá para pagar" en lugar de "Tocá para ver el estado" (F14)
- Nav "WhatsApp" en lugar de "Promos" (F17)
- "Volver" en lugar de "Cancelar" en login/registro (F5)
- Validación in-app sin popup nativo del browser (F10)
- Bundle code-split funcionando (BU01)

---

## Apéndice — Método y limitaciones

- **Recorrido en vivo:** mobile 375×812 con preview Vite + React.
- **Sesión simulada:** comercio "QA Browser Comercio" en `pending_payment` (estado realista para audit de onboarding).
- **Sin backend:** no pude probar flujos que requieren API real (signup→MP, WhatsApp connect→SSE, validación con cupón existente). Esos casos quedan auditados solo por código.
- **6 escenarios completados** de 8 planeados (no pude llegar a editar horarios ni a Owner panel — la sesión simulada redirige a /admin cuando entra a /admin/comercio por falta de apiMerchant fully loaded).
- **Lo no auditado este pase:** Owner panel (`apps/owner`), landing comercial (`apps/landing`), flujo de cancelación con arrepentimiento.

---

*Reporte v2 generado el 2026-05-28. Cero archivos de código modificados durante este pase — solo este `.md`. El reporte v1 se preservó en `REPORTE-AUDITORIA-UX-v1.md` para histórico.*
