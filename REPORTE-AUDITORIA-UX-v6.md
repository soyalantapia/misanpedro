# REPORTE AUDITORÍA UX — v6 (13ª pasada · 100% VECINO)

**Fecha:** 2026-05-28
**Foco exclusivo:** la app del VECINO (el usuario final que descubre y canjea descuentos)
**Modo:** análisis estático en piel del vecino, sin app corriendo
**Alcance:** `AppShell` + `DescuentosPage` + `CuponDetailPage` + `CuponActivoPage` + `MisCuponesPage` + `CanjeadosPage` + `PerfilPage`
**Regla respetada:** solo detecto y reporto — **no toqué código**

---

## 1. Resumen ejecutivo

### 🔥 Las 5 fricciones que más sangran (del lado del vecino)

| # | Problema | Severidad |
|---|----------|-----------|
| **V1** | `PerfilPage.tsx:23` — el número de soporte sigue siendo el placeholder `5493329000000` **sin fallback a email**. El fix C3 (audit v5) solo cubrió el panel del comercio; el vecino quedó con el link de soporte potencialmente muerto | 🟠 Alta |
| **V2** | `RegistroPage` sin scroll al primer error (M3, pendiente desde v4) — el vecino que se equivoca en un campo del medio en mobile no ve el error y cree que el botón no anda. El patrón YA existe en `AdminCuponEditPage` | 🟡 Media |
| **V3** | "Monto del ticket" ambiguo (bruto vs neto) en `AdminConfirmarCanjePage` → afecta la precisión de "Pagaste / Ahorraste" que el vecino ve en `CanjeadosPage` | 🟡 Media |
| **V4** | `CuponDetailPage:240` — el botón dice **"Canjear descuento"** en el paso de activación, pero ahí el vecino solo *activa* (genera el código). El canje real lo hace el comercio. Genera expectativa de "ya está" | 🟢 Baja |
| **V5** | `CuponActivoPage` — el polling de confirmación se corta a ~6 min sin avisar; si el comercio valida después, el vecino no ve la confirmación automática | 🟢 Baja |

### Sensación general del recorrido

> **La app del vecino es excelente y se siente cuidada de punta a punta.** Descubrimiento con búsqueda fluida + geo + categorías, activación clara, la pantalla del cupón activo (el momento de la verdad frente al comercio) está muy bien resuelta con QR grande + código + countdown + polling automático + "no tenés que hacer nada más", historial con dinero ahorrado acumulado, y un manejo de privacidad (habeas data) ejemplar. Encontré **muy poco** — y casi todo es pulido fino. El único hallazgo con filo real es V1, que es literalmente el fix C3 que se me quedó a mitad de camino: lo apliqué al comercio pero no al vecino.

---

## 2. Diario del vecino · 6 escenarios

### Escenario 1 — Primera vez que abre la app
*"Escaneé un QR de un poster en la plaza."*

- Caigo en la home. Si todavía no hay comercios → empty state honesto ("estamos sumando los primeros comercios"), sin controles inútiles. ✓
- Si hay comercios → veo "X comercios adheridos · Y cupones activos", búsqueda, toggle descuento/comercio, botón de distancias, chips de categoría. Limpio y claro. ✓
- Busco "panadería" → filtra al toque (sin lag, gracias al deferred value). ✓

### Escenario 2 — Activa su primer cupón
*"Encontré 20% off en una pizzería, lo quiero."*

- Detalle del cupón: foto, %, descripción, cómo usarlo, info del comercio, mapa, compartir. Botón grande abajo: **"Canjear descuento"**.
- Toco. Como no tengo cuenta → me manda a registro con `next` (vuelvo al cupón después). Abajo dice "Te vamos a pedir tus datos una sola vez". Honesto. ✓
- **Fricción de expectativa (V4):** el botón decía "Canjear" pero todavía no canjeé nada — me generó un código que tengo que mostrar en el local. "Canjear" me hizo pensar que ya estaba. El modelo real es activar → mostrar → el comercio valida.

### Escenario 3 — Se registra
*"Lleno mis datos para usar el descuento."*

- 5 campos (nombre, DNI, email, WhatsApp, fecha nac). Pesado pero entendible (lo pide la ley). ✓
- **Fricción (V2):** si me equivoco en el formato del WhatsApp y toco "Crear cuenta", el error aparece al lado del campo… pero **la pantalla no hace scroll hasta ahí**. En mi celu, si el error está en un campo que quedó arriba fuera de vista, toco el botón y "no pasa nada". (El form de crear cupón del comercio SÍ hace scroll al primer error — acá falta ese mismo patrón.)

### Escenario 4 — Muestra el cupón en el local (momento de la verdad)
*"Estoy en el mostrador con el celular."*

- Pantalla del cupón activo: **QR grande (320px)** + código de 6 dígitos grande + botón "copiar". Mensaje: "Mostrale este código al encargado. Cuando lo valide, esta pantalla se actualiza automáticamente. No tenés que hacer nada más." **Excelente — me da tranquilidad.** ✓
- Hay countdown si el cupón tiene vencimiento, o "sin tiempo límite" si no. ✓
- El comercio valida → la pantalla detecta el canje (polling) → me lleva a Canjeados con toast "¡Cupón canjeado!". Mágico. ✓
- **Fricción menor (V5):** si el comercio tarda más de ~6 min en validar (cola larga), el polling se corta silenciosamente. Si validan al minuto 7, no veo la confirmación automática — tendría que refrescar. No hay aviso de que "dejamos de chequear".

### Escenario 5 — Revisa su ahorro
*"Quiero ver cuánto ahorré este mes."*

- Canjeados: card grande "Dinero ahorrado $X" + "este mes $Y" + lista con desglose Ticket / Pagaste / Ahorraste por cada canje. **Muy lindo y motivador.** ✓
- **Fricción de datos (V3):** los números "Pagaste / Ahorraste" dependen de que el comercio haya cargado el monto BRUTO (precio de lista) en la confirmación. Pero el label del comercio dice "Monto del ticket" — que un comerciante naturalmente interpreta como *lo que cobró* (con descuento ya aplicado). Si carga el neto, mi "ahorro" se calcula mal. El dato del que me enorgullezco puede estar desinflado.

### Escenario 6 — Gestiona su privacidad / pide ayuda
*"Quiero bajar mis datos o pedir soporte."*

- Perfil: datos personales, **exportar mis datos (JSON)**, **eliminar mi cuenta** (con confirmación inline clara + explicación de anonimización), links legales. **Cumplimiento Ley 25.326 ejemplar.** ✓
- Toco "Soporte por WhatsApp" → **(V1)** me abre WhatsApp hacia `549 3329 000000`, un número placeholder. Si el operador no seteó `VITE_SUPPORT_WHATSAPP`, mi pedido de ayuda cae al vacío. Y acá, a diferencia del comercio, **no hay fallback a email** (el fix C3 no llegó a esta pantalla).

---

## 3. Tabla priorizada — Matriz Impacto × Esfuerzo

| ID | Problema | Severidad | Esfuerzo | Quick win |
|----|----------|-----------|----------|-----------|
| **V1** | Perfil vecino: soporte placeholder sin fallback | 🟠 Alta | 🟢 Bajo | ✅ SÍ |
| **V2** | RegistroPage sin scroll-to-error (M3) | 🟡 Media | 🟢 Bajo (patrón ya existe) | ✅ SÍ |
| **V3** | "Monto del ticket" ambiguo bruto/neto | 🟡 Media | 🟢 Bajo (copy) | ✅ SÍ |
| **V4** | Botón "Canjear descuento" prematuro | 🟢 Baja | 🟢 Bajo (copy) | ⚠️ Decisión |
| **V5** | Polling se corta sin avisar | 🟢 Baja | 🟡 Medio | ❌ Después |
| **V6** | Copy toast reactivación inconsistente (solo demo) | 🟢 Baja | 🟢 Bajo | ⚠️ Cosmético |
| **V7** | Bottom nav vecino sin min-h-[44px] explícito | 🟢 Baja | 🟢 Bajo | ⚠️ Cosmético |

---

## 4. Hallazgos detallados

### `[V1]` `[Comunicación/Config]` — Soporte del vecino con número placeholder sin fallback

📍 **Ubicación:** `apps/web/src/pages/PerfilPage.tsx:23` y `:201-210`
👀 **Qué vi:**
```ts
const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string) ?? '5493329000000'
```
El botón "Soporte por WhatsApp" del perfil usa este número. Es el mismo bug que C3 (audit v5), pero el fix de v5 solo tocó `MerchantShell` (comercio). El vecino quedó sin cubrir y, además, **sin el fallback a email** que sí tiene el comercio.

😖 **Por qué molesta:** El vecino que necesita ayuda con su cuenta cae en un número inexistente si el env no está seteado. Para la app gratuita del vecino, soporte roto el día 1 = mala primera impresión y posible reseña negativa.

🔥 **Severidad:** Alta · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Replicar el patrón de C3 en PerfilPage: normalizar a dígitos, detectar placeholder, y si no hay WhatsApp válido caer a `mailto:${SUPPORT_EMAIL}` con copy "Soporte por email". (Se podría extraer un helper compartido `getSupportLink()` para no repetir la lógica entre MerchantShell y PerfilPage.)

---

### `[V2]` `[Formularios]` — RegistroPage sin scroll al primer error (M3 pendiente)

📍 **Ubicación:** `apps/web/src/pages/RegistroPage.tsx:49-53`
👀 **Qué vi:** Al fallar la validación se setean los `errors` pero el viewport no se mueve al primer campo inválido.
😖 **Por qué molesta:** En mobile, si el error está en un campo fuera de vista, el vecino toca "Crear cuenta", no ve nada cambiar, y cree que está roto → abandona el registro (justo el paso de conversión más caro).
🔥 **Severidad:** Media · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Reusar el patrón que ya funciona en `AdminCuponEditPage:162-165`:
```ts
const firstKey = Object.keys(errs)[0]
document.querySelector(`[data-field="${firstKey}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
```
(requiere agregar `data-field` a cada `Field`, igual que en CuponEdit).

---

### `[V3]` `[Microcopy/Datos]` — "Monto del ticket" ambiguo (bruto vs neto)

📍 **Ubicación:** `apps/web/src/pages/admin/AdminConfirmarCanjePage.tsx:159-189` (impacta `CanjeadosPage:165-224`)
👀 **Qué vi:** El comercio ingresa "Monto del ticket" y el sistema calcula `ahorro = monto × % / 100` y muestra al vecino `pagaste = ticket − ahorro`. Esto asume que "monto del ticket" = precio BRUTO (antes del descuento). Pero "el ticket" que emite un comercio es lo que efectivamente cobró (neto, con descuento ya aplicado).
😖 **Por qué molesta:** Si el comercio carga el neto (lo más natural), el ahorro del vecino se calcula mal → la métrica estrella de Canjeados ("Dinero ahorrado") queda desinflada/inconsistente.
🔥 **Severidad:** Media · 🔧 **Esfuerzo:** Bajo (copy)
✅ **Recomendación:** Aclarar el label, ej: "Monto **sin descuento** (precio de lista)" + microcopy "Lo usamos para calcular cuánto ahorró el cliente". Alternativamente, pedir el monto cobrado y derivar el bruto. Lo importante es eliminar la ambigüedad.

---

### `[V4]` `[Glosario]` — "Canjear descuento" en el paso de activación

📍 **Ubicación:** `apps/web/src/pages/CuponDetailPage.tsx:240`
👀 **Qué vi:** El CTA dice "Canjear descuento", pero al tocarlo solo se *activa* el cupón (se genera el código). El canje real lo hace el comercio al validar.
😖 **Por qué molesta:** "Canjear" sugiere transacción completada. El vecino puede pensar "ya está" cuando en realidad todavía tiene que mostrar el código en el local.
🔥 **Severidad:** Baja · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** "Activar descuento" / "Obtener mi código" / "Usar este descuento". Mantener "Ver mi cupón activo" para el caso `existing` (ya está bien). Decisión de producto — "Canjear" es marketing-friendly pero técnicamente prematuro.

---

### `[V5]` `[Feedback del sistema]` — Polling de confirmación se corta sin avisar

📍 **Ubicación:** `apps/web/src/pages/CuponActivoPage.tsx:78-87` (`MAX_TICKS = 72`, ~6 min)
👀 **Qué vi:** Tras 72 ticks el polling se detiene en silencio. Si el comercio valida después, la pantalla no se actualiza sola.
😖 **Por qué molesta:** En un local con cola, 6 min se pasan fácil. El vecino se queda mirando una pantalla "viva" que ya no escucha.
🔥 **Severidad:** Baja · 🔧 **Esfuerzo:** Medio
✅ **Recomendación:** Al alcanzar MAX_TICKS, mostrar un aviso discreto "¿Ya te lo validaron? Tocá para actualizar" con un botón que re-arranque el polling o haga un fetch puntual.

---

### `[V6]` `[Microcopy]` — Toast de reactivación inconsistente (solo demo)

📍 **Ubicación:** `apps/web/src/pages/MisCuponesPage.tsx:126` vs `:142`
👀 **Qué vi:** La rama API dice "Tenés el código listo para usar"; la rama demo local dice "Tenés 30 minutos para usarlo". El "30 minutos" sobrevive solo en el path demo.
🔥 **Severidad:** Baja · 🔧 **Esfuerzo:** Bajo · Cosmético (en producción real siempre se usa la rama API).

---

### `[V7]` `[Accesibilidad]` — Bottom nav del vecino sin min-h explícito

📍 **Ubicación:** `apps/web/src/layouts/AppShell.tsx:106-131`
👀 **Qué vi:** El bottom nav del comercio (`MerchantShell:229`) tiene `min-h-[44px]` explícito (WCAG 2.5.5 tap target); el del vecino no lo declara (depende del padding).
🔥 **Severidad:** Baja · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Agregar `min-h-[44px] justify-center` a los NavLink del bottom nav del vecino, por paridad con el del comercio.

---

## 5. Recomendaciones

### Quick wins (antes de lanzar al vecino)
- **V1** — completar el fix C3 en PerfilPage (idealmente extrayendo un helper `getSupportLink()` compartido).
- **V2** — scroll-to-error en RegistroPage (reusa patrón de CuponEdit).
- **V3** — desambiguar el label "Monto del ticket".

### Mejora estratégica (post-launch)
- **V5** — re-enganche del polling tras timeout.
- **V4 / V6 / V7** — pulido de copy y accesibilidad.

### Lo que está EXCELENTE y NO hay que tocar
- ✅ `DescuentosPage` — búsqueda fluida (deferred), geo opcional, view toggle, empty states diferenciados, skeleton
- ✅ `CuponActivoPage` — QR grande, código + copiar, countdown, polling auto, copy "no tenés que hacer nada más" (hooks correctamente ordenados, con comentario que lo cuida)
- ✅ `CuponDetailPage` — activación con `next` a registro, share, mapa, estados de carga
- ✅ `MisCuponesPage` / `CanjeadosPage` — reactivación, status lines, card de ahorro acumulado, desglose por canje
- ✅ `PerfilPage` — habeas data (export JSON + eliminar cuenta con confirmación) ejemplar para Ley 25.326
- ✅ `AppShell` — sidebar + bottom nav, footer legal, OfflineBanner, RedemptionWatcher
- ✅ `LoginPage` (vecino) — OTP con countdown, reenviar, "usar otro email", sin `required` nativo

---

**Veredicto:**
La app del vecino es sólida y está lista. Los 3 quick wins (V1, V2, V3) valen la pena antes de lanzar — sobre todo **V1**, que es completar el fix de soporte que dejé a medias en el comercio. El resto es backlog tranquilo.
