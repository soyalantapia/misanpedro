# REPORTE AUDITORÍA UX — v5 (12ª pasada · 100% COMERCIO)

**Fecha:** 2026-05-28
**Foco exclusivo:** el panel del COMERCIO (el cliente que paga $25.000/mes)
**Modo:** análisis estático en piel del comerciante, sin app corriendo
**Alcance:** `apps/web/src/pages/admin/*` + `MerchantShell.tsx` + `merchantStore.ts`
**Regla respetada:** solo detecto y reporto — **no toqué código**

---

## 1. Resumen ejecutivo

### 🔥 Las 5 fricciones que más sangran (del lado del comercio)

| # | Problema | Severidad |
|---|----------|-----------|
| **C1** | `MerchantShell.tsx:89` — `useState` DESPUÉS de dos `return` condicionales: violación de Rules of Hooks. **Latente hoy** (login setea todo atómico) pero es una bomba de tiempo: cualquier refactor que cargue `apiMerchant` async = pantalla blanca | 🟠 Alta |
| **C2** | `AdminValidarPage` modo cámara: tras un QR inválido/ya canjeado **no hay botón "escanear de nuevo"** — el comerciante queda en callejón sin salida con la cámara frenada | 🟠 Alta |
| **C3** | `SUPPORT_WHATSAPP` default es `5493329000000` (número placeholder fake) — si no se setea el env en prod, el link "Soporte por WhatsApp" lleva a un número muerto | 🟠 Alta |
| **C4** | Upload de cover/logo va como base64 en el body del PATCH (TODO BD01) — un comerciante subiendo foto del local desde el celu en 3G puede comer timeout | 🟡 Media |
| **C5** | `AdminValidarPage` arranca en modo "Código manual" en vez de "Escanear QR" — para el comercio el QR es más rápido y con menos errores de tipeo | 🟢 Baja |

### Sensación general del recorrido

> **El panel del comercio está genuinamente bien hecho.** Es la parte más madura del producto: KPIs claros, onboarding contextual, validación con copy operativo por tipo de error, plantillas de cupones por rubro, preview en vivo, banner sticky de pago pendiente en todas las pantallas, confirmación antes de logout. Un comerciante de San Pedro se va a sentir acompañado. Las fricciones que quedan son **una bomba de tiempo técnica** (C1), **un callejón sin salida en cámara** (C2) y **un número de soporte placeholder** (C3) — ninguna rompe el flujo feliz hoy, pero las tres conviene atacarlas antes de cobrarle a alguien.

---

## 2. Diario del comerciante · 6 escenarios

### Escenario 1 — Sandra entra al panel a la mañana
*"Abro el panel desde el celu antes de abrir el local."*

- Login con email + contraseña. Entro. Veo mi nombre de comercio arriba, KPIs "Canjes hoy / semana / mes". ✓
- Si todavía no tengo canjes, hay un onboarding numerado claro: creá descuento → validá QR → mirá impacto. Bien pensado. ✓
- La "Acción rápida" violeta cambia según mi estado: si debo el pago me manda a pagar, si no tengo cupones me manda a crear, si todo ok me manda a validar. **Esto está muy bien.** ✓
- Fricción latente que NO veo como usuaria pero está: si por algún motivo el panel renderiza sin mis datos cargados (sesión vieja en storage, refactor futuro), la pantalla puede romper por el tema de los hooks (C1). Hoy no pasa porque al loguear se carga todo junto.

### Escenario 2 — Valida un cupón con la cámara (acción estrella, varias/día)
*"Llega un cliente al mostrador con el celu."*

- Voy a "Validar". **Arranca en "Código manual"**, no en cámara (C5). Tengo que tocar "Escanear QR" primero. Un toque de más cada vez.
- Activo cámara, pido permiso, escaneo. Si el cupón es válido → panel verde "Cupón válido · 20% off" + botón "Confirmar canje". Perfecto, controlo el ritmo. ✓
- **PERO si el cliente me muestra un QR ya canjeado o de otro comercio:** veo el panel rojo con el error (buen copy, me explica qué pasó)… **y no tengo botón para escanear de nuevo.** La cámara ya se frenó. Me quedo trabada mirando el error. Para reintentar tengo que cambiar a "Código manual" y volver a "Escanear QR". (C2) → En el mostrador, con el cliente esperando, esto me hace quedar mal.
- En modo "Código manual" en cambio SÍ hay "Probar otro código" que limpia el input. La inconsistencia se nota.

### Escenario 3 — Confirma el canje
*"El cupón es válido, ahora registro la venta."*

- Pantalla limpia: avatar del cliente, descuento, código, hora de activación. Me pide el **monto del ticket (obligatorio)**. Bien, entiendo que es para mis stats. ✓
- Veo el "Ahorro estimado" calcularse en vivo mientras tipeo. Lindo detalle. ✓
- Único riesgo: si tipeo $50.000 en vez de $5.000 (un cero de más), se confirma igual (hay cap a $10M pero no aviso de orden de magnitud). Me infla el "ingreso generado" y no lo puedo deshacer ("esta acción no se puede deshacer"). (C6) Menor, pero contamina el dato del que después me enorgullezco.

### Escenario 4 — Crea un descuento nuevo
*"Quiero lanzar 20% off para el finde."*

- "Nuevo descuento": hay **plantillas por mi rubro** (las puedo abrir y elegir). Excelente para arrancar. ✓
- **Preview en vivo** de cómo lo ve el vecino mientras escribo. ✓
- Validación inteligente: me avisa si el % es muy bajo ("pueden no notarlo") o muy alto ("revisá tu margen"). Chips de vigencia (1 sem, 1 mes…). Si me falta un campo, **hace scroll al primer error**. (Acá el form está mejor resuelto que el registro del vecino.) ✓
- El copy cambia si estoy en pending_payment: "se publica cuando completes el pago". Honesto. ✓
- **No tengo quejas reales de esta pantalla. Es la mejor del producto.**

### Escenario 5 — Necesita ayuda
*"Algo no me anda, busco soporte."*

- En el menú lateral: "Soporte por WhatsApp". Toco. **Me abre WhatsApp hacia el número `549 3329 000000`** (C3). Ese número no existe — es un placeholder. Si el operador no seteó `VITE_SUPPORT_WHATSAPP` en el deploy, mi pedido de ayuda cae al vacío. Como comerciante que paga, que el soporte no funcione el primer día es grave.

### Escenario 6 — Sube la foto de su local
*"Quiero que mi local se vea lindo en la app."*

- "Mi comercio" → editar → subir cover. Selecciono una foto de 1.8MB desde el celular.
- La foto viaja como **base64 dentro del PATCH** (≈2.4MB inflados) (C4). En el wifi del local va. En 3G/4G lento de San Pedro, puede tardar >5s o cortar por timeout. Si falla, no sé bien por qué. El límite de 2MB del cliente ayuda pero no resuelve la conexión lenta.

---

## 3. Tabla priorizada — Matriz Impacto × Esfuerzo

| ID | Problema | Severidad | Esfuerzo | Quick win |
|----|----------|-----------|----------|-----------|
| **C1** | Hooks violation en MerchantShell | 🟠 Alta | 🟢 Bajo (mover 1 línea) | ✅ SÍ |
| **C2** | Sin "escanear de nuevo" tras error en cámara | 🟠 Alta | 🟢 Bajo (pasar onRetry + reset scanState) | ✅ SÍ |
| **C3** | Número de soporte placeholder | 🟠 Alta | 🟢 Bajo (setear env / validar) | ✅ SÍ (checklist) |
| **C4** | Upload base64 timeout en 3G | 🟡 Media | 🔴 Alto (presigned URLs) | ❌ (post-launch) |
| **C5** | Validar arranca en manual, no QR | 🟢 Baja | 🟢 Bajo (default 'qr') | ⚠️ Decisión de producto |
| **C6** | Monto sin confirmación de magnitud | 🟢 Baja | 🟡 Medio | ⚠️ Después |

---

## 4. Hallazgos detallados

### `[C1]` `[Estabilidad/React]` — `useState` después de returns condicionales en MerchantShell

📍 **Ubicación:** `apps/web/src/layouts/MerchantShell.tsx:60, 75, 89`
👀 **Qué vi:**
```tsx
export function MerchantShell() {
  const sessionState = useMerchantSession()   // hook
  const navigate = useNavigate()              // hook
  const localMerchant = useMerchant(...)      // hook
  useEffect(() => { ... }, [navigate])        // hook
  if (!session) return <Navigate ... />       // ← return condicional
  ...
  if (!user || !merchant) return <skeleton /> // ← return condicional
  ...
  const [confirmLogout, setConfirmLogout] = useState(false)  // ← HOOK #5 después de los returns
```

😖 **Por qué molesta:**
Viola las Rules of Hooks de React (el número de hooks debe ser constante entre renders). **Hoy NO crashea** porque `merchantAuth.login()` y `load()` setean `session` + `apiUser` + `apiMerchant` de forma atómica (`merchantStore.ts:73-77`), así que el `return` de la línea 75 casi nunca se dispara con la sesión presente. Pero es una **bomba de tiempo**: el día que alguien (vos o un AI) refactorice para cargar el merchant async, o aparezca una sesión vieja en `localStorage` sin `apiMerchant` que después se complete, el contador de hooks pasa de 4 a 5 entre renders → React tira *"Rendered more hooks than during the previous render"* → **pantalla blanca**. Además ESLint `react-hooks/rules-of-hooks` debería estar marcándolo.

🔥 **Severidad:** Alta (latente) · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Mover la declaración del `useState` arriba de todo, junto a los otros hooks (antes de la línea 60). Es mover una línea ~30 posiciones hacia arriba. Cero cambio de comportamiento, elimina el landmine.

---

### `[C2]` `[Fricción/Recuperación de error]` — Cámara sin "escanear de nuevo" tras error

📍 **Ubicación:** `apps/web/src/pages/admin/AdminValidarPage.tsx:279-286` (`ScanMode`)
👀 **Qué vi:**
En modo cámara, al escanear un QR el scanner se detiene (`instance.stop()`) y se setea `scannedPayload`. Si el resultado es error, el `ResultPanel` se renderiza **sin** la prop `onRetry` (a diferencia de `CodeMode`, que sí la pasa en la línea 136). La cámara queda frenada y no hay botón para reintentar.

😖 **Por qué molesta:**
Validar con cámara es una acción que el comercio hace **varias veces por día, con el cliente enfrente**. Si el primer QR falla (ya canjeado, otro comercio, vencido), el comerciante ve el error pero no tiene cómo volver a escanear sin cambiar de modo manual y volver. En el mostrador, esa fricción se siente como "esto no anda".

🔥 **Severidad:** Alta · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Pasar `onRetry` al `ResultPanel` de `ScanMode` que limpie `scannedPayload` y vuelva `scanState` a `'starting'` (re-arranca la cámara). Reusa el mismo patrón que ya funciona en `CodeMode`.

---

### `[C3]` `[Comunicación/Config]` — Número de soporte placeholder

📍 **Ubicación:** `apps/web/src/layouts/MerchantShell.tsx:22` + `apps/api/src/env.ts:31`
👀 **Qué vi:**
```ts
const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string) ?? '5493329000000'
```
El default `5493329000000` (área 3329 de San Pedro pero `000000`) es un placeholder. El link "Soporte por WhatsApp" del panel usa esto.

😖 **Por qué molesta:**
Si en el deploy no se setea `VITE_SUPPORT_WHATSAPP` (web) y `SUPPORT_WHATSAPP` (api), el comerciante que paga y necesita ayuda toca "Soporte" y cae en un número inexistente. Primera impresión de soporte rota.

🔥 **Severidad:** Alta · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** (a) setear el número real en los envs de producción (checklist de launch), y/o (b) ocultar el botón de soporte si el número sigue siendo el placeholder, para no exponer un link muerto.

---

### `[C4]` `[Performance percibida]` — Upload de imágenes como base64

📍 **Ubicación:** `apps/web/src/pages/admin/AdminComercioPage.tsx:57-80` (TODO BD01 ya documentado)
👀 **Qué vi:**
Cover (≤2MB) y logo (≤600KB) se mandan como data URL base64 en el body del `PATCH /merchants/me`, inflando el payload ~33%.

😖 **Por qué molesta:**
En conexión móvil lenta (común en pueblo), subir el cover puede tardar >5s o cortar por timeout, sin feedback claro de por qué. El comerciante abandona el armado de su perfil.

🔥 **Severidad:** Media · 🔧 **Esfuerzo:** Alto
✅ **Recomendación:** Post-launch, migrar a presigned URLs (R2/S3) como ya está planificado en el TODO BD01. Hasta entonces el límite client-side mitiga parcialmente. No bloquea vender.

---

### `[C5]` `[UX/Decisión de producto]` — Validar arranca en manual, no en QR

📍 **Ubicación:** `apps/web/src/pages/admin/AdminValidarPage.tsx:15`
👀 **Qué vi:** `const [mode, setMode] = useState<Mode>('code')` — arranca en "Código manual".
😖 **Por qué molesta:** Escanear el QR es más rápido y elimina errores de tipeo. Arrancar en manual obliga a un toque extra a quien prefiere cámara. (Contraargumento válido: muchos comerciantes mayores prefieren tipear y evitar el permiso de cámara — por eso es Baja, no Media.)
🔥 **Severidad:** Baja · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Evaluar arrancar en `'qr'`, o recordar la última preferencia del comerciante en localStorage. Decisión de producto, no un bug.

---

### `[C6]` `[Formularios]` — Monto del ticket sin confirmación de orden de magnitud

📍 **Ubicación:** `apps/web/src/pages/admin/AdminConfirmarCanjePage.tsx:70-86`
👀 **Qué vi:** Valida que el monto sea >0 y <$10M, pero un typo plausible (un cero de más: $50.000 vs $5.000) pasa sin aviso y se confirma de forma irreversible.
😖 **Por qué molesta:** Contamina el "ingreso generado de por vida" — justo la métrica que le mostrás al comercio como valor.
🔥 **Severidad:** Baja · 🔧 **Esfuerzo:** Medio
✅ **Recomendación:** Si el monto supera ~10× el ticket promedio del comercio (o un umbral fijo razonable), mostrar un "¿Seguro que el ticket fue de $X?" antes de confirmar. Post-launch.

---

## 5. Recomendaciones

### Quick wins (antes de cobrarle al primer comercio)
- **C1** — mover el `useState` arriba (1 línea, elimina landmine de pantalla blanca).
- **C2** — agregar "escanear de nuevo" en el modo cámara (reusa patrón de CodeMode).
- **C3** — setear el WhatsApp de soporte real en envs + ocultar botón si es placeholder.

### Mejora estratégica (post-launch, primera semana)
- **C4** — presigned URLs para imágenes (TODO BD01).
- **C5 / C6** — default de cámara configurable + guard de magnitud del monto.

### Lo que está EXCELENTE y NO hay que tocar
- ✅ `AdminDashboardPage` — KPIs, lifetime stats, onboarding contextual, acción rápida según estado, locked states honestos
- ✅ `AdminCuponEditPage` — plantillas por rubro, preview en vivo, validación con scroll-to-error, warnings de %, copy condicional por estado (la mejor pantalla del producto)
- ✅ `AdminConfirmarCanjePage` — monto obligatorio, preview de ahorro, cap de plausibilidad
- ✅ `MerchantShell` — banner pending_payment sticky en todas las pantallas, ConfirmDialog antes de logout, skeleton de carga, bottom-nav con tap targets WCAG
- ✅ `AdminValidarPage` (modo código) — copy de error específico por reason, "probar otro código", barra de progreso de dígitos
- ✅ `AdminWhatsappPage` — sin hooks violation, SSE en tiempo real, idempotencia del start
- ✅ `merchantStore` — manejo de 401/403 con mensajes específicos (suspendido/cancelado vs credenciales)
- ✅ Recuperación de contraseña del comercio completa (forgot + reset)

---

**Veredicto:**
El panel del comercio es la joya del producto. Solo hay **3 quick wins** que valen la pena antes de vender: el landmine de hooks (C1), el callejón de la cámara (C2) y el número de soporte (C3). Las tres son cambios chicos. C4/C5/C6 son backlog tranquilo post-launch.
