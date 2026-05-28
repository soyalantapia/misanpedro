# 🕵️ Auditoría UX — "En la piel del usuario"

**Plataforma:** Cuponcito · PWA de descuentos vecinales (multi-tenant, "Mi San Pedro" como deploy inicial)
**Stack:** Vite 7 + React 19 + TypeScript + Tailwind 4 · Hono + MongoDB (API)
**Auditor:** Claude (rol: usuario recurrente)
**Fecha:** 2026-05-28
**Método:** Recorrido en vivo con preview interactivo (mobile 375×812) + análisis estático del código

> **Nota previa**: este repo ya pasó por 7 auditorías técnicas previas que cerraron 60+ hallazgos. Esta 8ª pasada es distinta: la hago **en piel de usuario real**, sin mirar la lista de fixes anteriores, viendo qué se ROMPE o CONFUNDE cuando alguien de verdad entra a usar la app. Algunos hallazgos coinciden con tech-debt conocido, otros son nuevos.

---

## 1. Resumen ejecutivo

**Sensación general en 3 líneas:**
Cuponcito se siente **cuidado, moderno y consistente**. La paleta y la tipografía están bien resueltas, los empty states son útiles, el copy es rioplatense y humano. Pero **al primer impacto hay UNA contradicción gigante** ("11 cupones activos" mientras dice "No encontramos descuentos") que erosiona la confianza inmediatamente, y **el panel comercio sigue "vendiendo" funciones que no funcionan** cuando estás en pending_payment. La PWA aún arrastra inconsistencias de branding entre "Mi San Pedro" (legacy) y "Cuponcito" (actual).

### Las 5 fricciones que más sangran

| # | Fricción | Dónde duele |
|---|---|---|
| 🔴 1 | **Header dice "11 cupones activos", listado dice "No encontramos descuentos"** | Home vecino — primer load |
| 🔴 2 | **Sandra puede crear cupones sin saber que su comercio NO es visible** | Dashboard admin · pending_payment |
| 🟠 3 | **Mensaje de error de validación es redundante ("No es válido / Cupón inválido")** | Validar cupón — comerciante |
| 🟠 4 | **Branding mezclado: header "Cuponcito", footer "soporte@misanpedro.app"** | Toda la app vecino |
| 🟡 5 | **"Cancelar" arriba de pantallas que no son operaciones — confunde** | Login/Registro vecino |

### 3 quick wins (alto impacto, bajo esfuerzo, hacer esta semana)

1. **Filtrar el contador "X cupones activos" usando los MISMOS criterios que el listado** → evita la contradicción del primer load.
2. **Cuando `pending_payment`, deshabilitar el botón "Creá tu primer cupón" o cambiar copy a "Activá tu pago y empezá"** → impide trabajo en falso.
3. **Cambiar "Cancelar" por "← Inicio" o "← Volver"** en headers de Login y Registro vecino → reduce ambigüedad.

---

## 2. Diario del usuario (narrativa)

### 🧑 Lucas — vecino que abre la app por primera vez

> *Recibo un link de Cuponcito por WhatsApp de un amigo. Lo abro en mi celu.*

> *Carga rápido. Lindo encabezado violeta arriba "Cuponcito · Descuentos vecinales". Voy bajando: "Descubrí descuentos en tu ciudad — 0 comercios adheridos · **11 cupones activos**".*

> *Bajo más para ver los cupones. Pero... "**No encontramos descuentos. Pronto vamos a sumar más comercios al programa.**"*

> *¿Qué? Recién me dijo que hay 11 cupones activos. ¿Cuáles? ¿Es un error? ¿La app está rota?*

> *Pruebo el toggle "Por descuento" / "Por local" — nada. Pruebo categorías: Gastronomía, Cafetería, Panadería — nada en ninguna. El estado vacío es el mismo.*

> *Bueno, parece que en mi zona todavía no hay nada. Pero entonces ¿por qué me dice que hay 11 cupones activos? Cierra la app, no vale la pena.*

**Friction point**: el primer impacto es una contradicción no resuelta. El vecino se va.

---

> *Otro vecino — Lucas con sesión — abre la app un domingo a la noche.*

> *Llego a la home, tap en "Mis cupones". "Todavía no activaste ningún cupón. Cuando actives un descuento desde Descuentos, lo vas a ver acá con su QR y código." Bien claro. CTA "Ver descuentos" abajo.*

> *Bajo. Header dice **"Cada cupón activo tiene 30 minutos antes de expirar."*** Bueno, me apuro.*

> *Voy a "Canjeados". Vacío también con copy similar: "Sin canjes todavía". OK.*

> *Voy a "Perfil". Me lleva a Login. Tengo que tipear email. Listo, OK.*

> *En el header del login dice **"< Cancelar"**. Pero... ¿qué cancelo? No estaba en medio de nada. Me confunde por 2 segundos. Pruebo igual, vuelvo a home.*

**Friction point**: "Cancelar" se usa cuando NO hay una operación en curso. Copy semánticamente equivocado.

---

> *Lucas con cuenta vieja, abre la app después de meses.*

> *Footer del home dice **"soporte@misanpedro.app"**. Pero arriba el branding es "Cuponcito". ¿Es la misma empresa? ¿O esto se llamaba antes Mi San Pedro?*

> *Me da un poco de desconfianza. Como si fuera un proyecto a medio rebranderar.*

**Friction point**: inconsistencia de marca visible al usuario en cada pantalla.

---

### 🏪 Sandra — dueña de un comercio recién dado de alta

> *Hice el signup ayer. El pago de MP me dio error y me mandó al panel igual. Hoy abro a ver cómo está.*

> *Login. Llego al dashboard.*

> *Arriba: **"QA Browser Comercio · Panel comercio"**. Mi comercio. OK.*

> *Banner amarillo: **"Suscripción pendiente de pago. Completá el pago para que tu comercio sea visible para los vecinos. Tocá para ver el estado."***

> *"Tocá para ver el estado" — bueno, después lo veo.*

> *Bajo: tres KPIs grandes "0 / 0 / 0". Canjes hoy, esta semana, este mes. Triste pero esperable.*

> *Acción rápida: card violeta enorme **"Creá tu primer cupón. Sin cupones activos los vecinos no ven tu comercio en la app."***

> *¡Perfecto! Lo creo. Tap.*

> *Llego al editor. Lleno todo. Preview a la izquierda — qué bueno, veo cómo lo va a ver el vecino. Guardo.*

> *Vuelvo al dashboard, ahora dice "Mis cupones: 1 descuento activo". ✓*

> *...pero esperá. Si mi pago está pendiente, ¿mi comercio es visible o no?*

> *Tap en el banner amarillo. Me lleva a /admin/comercio. Veo el SubscriptionCard. Dice "Estado: Esperando primer pago". OK, NO estoy activa.*

> *Mi cupón existe pero NO se ve. Trabajé al pedo.*

**Friction point**: el dashboard te invita a crear cupones sin avisar que no van a ser visibles. Trabajo desperdiciado.

---

> *Sandra unos días después. Su pago se concretó. Ahora prueba validar un canje.*

> *Cliente llega al mostrador, le digo "abrí tu app y pasame el código". Cliente me dice "9 9 9 9 9 9".*

> *Lo tipeo. Aparece grande: **"NO ES UN CUPÓN VÁLIDO · Cupón inválido."***

> *¿Por qué no es válido? ¿Lo tipié mal? ¿Ya lo usaron? ¿Está vencido? ¿No es de este comercio? El mensaje no me dice nada.*

> *Le pido al cliente que mejor abra el QR. Si tuviera más info en el error, podríamos haber resuelto sin ese paso extra.*

**Friction point**: error técnicamente correcto pero inútil operativamente. Repite la palabra "inválido" sin agregar información.

---

> *Sandra explora la bottom nav: "Inicio / Validar / Cupones / Clientes / Promos / Comercio". Son 6 items en mi celu chico. Cada label apretado, los iconos chicos. Si me equivoco de tap por 8px, voy a la sección equivocada.*

**Friction point**: 6 items en bottom nav en mobile chico = tap targets borderline.

---

## 3. Tabla priorizada — Matriz Impacto × Esfuerzo

| ID | Problema | Severidad | Esfuerzo | ¿Quick win? |
|----|----------|-----------|----------|-------------|
| **F1** | Contador "11 cupones activos" vs listado "No encontramos descuentos" | 🔴 Crítica | Bajo | ✅ |
| **F2** | Pending_payment promueve crear cupones que NO se ven | 🔴 Crítica | Bajo | ✅ |
| **F3** | Error "No es un cupón válido · Cupón inválido" no dice por qué | 🟠 Alta | Bajo | ✅ |
| **F4** | Footer `soporte@misanpedro.app` con marca Cuponcito | 🟠 Alta | Bajo | ✅ |
| **F5** | "Cancelar" en headers de Login/Registro vecino | 🟠 Alta | Bajo | ✅ |
| **F6** | "Mis cupones" dice "30 minutos antes de expirar" pero CuponActivoPage dice "Sin tiempo límite" | 🟠 Alta | Bajo | ✅ |
| **F7** | Validar pantalla no muestra warning pending_payment | 🟠 Alta | Bajo | ✅ |
| **F8** | Doble CTA "Crear nuevo" + "Crear primer cupón" en empty state | 🟡 Media | Bajo | ✅ |
| **F9** | Bottom nav 6 ítems en mobile chico — apretado | 🟡 Media | Medio | — |
| **F10** | Validación de email vacío usa mensaje nativo del browser | 🟡 Media | Bajo | ✅ |
| **F11** | "Solo te lo pedimos esta vez" minimiza el costo cognitivo del registro de 5 campos | 🟡 Media | Bajo | ✅ |
| **F12** | DNI placeholder "30123456" + help "Sólo números, sin puntos" — redundante | 🔵 Baja | Bajo | ✅ |
| **F13** | "Mis cupones" vs "Descuentos del comercio" — distintos nombres para lo mismo | 🟡 Media | Bajo | ✅ |
| **F14** | Banner pending_payment dice "Tocá para ver el estado" — vago | 🟡 Media | Bajo | ✅ |
| **F15** | KPIs de dashboard muestran "0 / 0 / 0" sin contexto educativo cuando recién arrancás | 🟡 Media | Bajo | — *(parcialmente cubierto por onboarding banner DB02 ya implementado)* |
| **F16** | "Por descuento" / "Por local" toggle confunde — "por local" no es claro que sea "por comercio" | 🔵 Baja | Bajo | ✅ |
| **F17** | "Promos" como label del nav bottom — ambiguo (es WhatsApp masivo) | 🔵 Baja | Bajo | ✅ |
| **F18** | Footer queda detrás del bottom nav floating en mobile chico (cerca pero no se solapa) | 🔵 Baja | Bajo | — |

---

## 4. Hallazgos detallados

### [#F1] [Comunicación + Funcional] — Contador vs listado contradictorios al primer load
📍 **Ubicación:** `apps/web/src/pages/DescuentosPage.tsx:166-173` (header) y `:186-249` (listado).
👀 **Qué vi:** El hero dice **"0 comercios adheridos · 11 cupones activos."** y abajo el listado dice **"No encontramos descuentos. Pronto vamos a sumar más comercios al programa."**.
😖 **Por qué molesta:** El usuario nuevo lee el número 11, baja a verlos, y no encuentra nada. Conclusión inmediata: **"la app está rota"**. Es la primera impresión y desinfla la confianza al instante.
🔥 **Severidad:** Crítica
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** El contador debe usar la **misma lógica** que `filteredCoupons`/`filteredMerchants` — es decir, contar solo los cupones cuyo merchant existe en el store. Si no, mostrar `"Aún no hay comercios cargados"` y NO mostrar el número de cupones huérfanos. Copy sugerido: **"Aún no hay comercios adheridos en tu ciudad — sumate para enterarte cuando lleguen."**.

---

### [#F2] [Flujo + Funcional] — Comercio pending_payment puede crear cupones que no se ven
📍 **Ubicación:** `AdminDashboardPage.tsx` — sección "Acción rápida" cuando `merchant.estado === 'pending_payment'`.
👀 **Qué vi:** El dashboard muestra el banner amarillo "Suscripción pendiente de pago" pero **abajo te invita con un CTA enorme violeta a "Creá tu primer cupón"**. Sandra crea el cupón, vuelve al dashboard y dice "1 descuento activo" — pero el cupón NO se ve para vecinos hasta que pague.
😖 **Por qué molesta:** Trabajo desperdiciado. Sandra creyó que arrancó. Cuando se entera (días después), se siente engañada y desconfía del producto.
🔥 **Severidad:** Crítica
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cuando `estado === 'pending_payment'`, reemplazar el card "Acción rápida" por algo como:
```
[!] Activá tu pago para empezar
    Mientras esté pendiente, tus cupones no van a aparecer
    en la app del vecino.
    [Ir a completar pago →]
```
Y deshabilitar el botón "Creá tu primer cupón" hasta que el merchant esté activo (o permitirlo pero con warning "Lo creás ahora, se ve cuando pagues").

---

### [#F3] [Microcopy] — Error redundante en validación
📍 **Ubicación:** Pantalla Validar cupón cuando el código es inválido.
👀 **Qué vi:** Card rojo con título **"No es un cupón válido"** y subtítulo **"Cupón inválido"**. Dos veces la misma palabra, cero información operativa.
😖 **Por qué molesta:** Sandra no sabe si tipeó mal, si el cupón fue canjeado, si está vencido, o si es de otro comercio. Tiene que pedir al cliente que repita, abra el QR, etc. — pérdida de tiempo en el mostrador.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Aprovechar el `payload.error` o `payload.reason` del backend para mostrar mensajes específicos:
- `not-found` → **"No encontramos ese código. ¿Lo tipeaste bien? Pedile al cliente que abra el QR."**
- `already-redeemed` → **"Este cupón ya fue canjeado en este comercio el [fecha]."**
- `wrong-merchant` → **"Este cupón es para otro comercio adherido."**
- `expired` → **"Este cupón venció — el cliente puede reactivarlo desde la app."**

---

### [#F4] [Comunicación] — Branding inconsistente: header "Cuponcito" + footer "soporte@misanpedro.app"
📍 **Ubicación:** Footer del `AppShell` + `PerfilPage` + `AdminComercioPage` + páginas legales.
👀 **Qué vi:** Toda la app vecino usa "Cuponcito" en el header. El footer dice "soporte@misanpedro.app". Inconsistente.
😖 **Por qué molesta:** Da la sensación de "proyecto a medio rebranderar". El usuario duda si es la misma empresa, o si el soporte va a otro lado. Cosmético pero erosiona profesionalismo.
🔥 **Severidad:** Alta (por presencia masiva, baja por funcionalidad)
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Decidir un email único de soporte (`soporte@cuponcito.app` por marca, o mantener `misanpedro` si los DNS solo apuntan ahí) y usar `VITE_SUPPORT_EMAIL` consistentemente. Si Cuponcito es la marca paraguas y "Mi San Pedro" es solo el tenant, el email general debería usar el dominio de la marca paraguas.

---

### [#F5] [Microcopy] — "Cancelar" sin operación en curso
📍 **Ubicación:** `LoginPage` y `RegistroPage` — link arriba a la izquierda dice "< Cancelar".
👀 **Qué vi:** Llego a la pantalla por navegación (tap en "Perfil" sin sesión, o tap en "Crear cuenta"). El link arriba dice "< Cancelar". Pero no hay operación que cancelar — recién entré.
😖 **Por qué molesta:** Suena a "vas a perder algo". Confusión sutil pero recurrente.
🔥 **Severidad:** Alta (frecuencia altísima)
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cambiar a **"← Volver"** o **"← Inicio"** o **"← Cuponcito"** (marca). Solo usar "Cancelar" cuando realmente cancelo una acción (ej. en un form a medio llenar, edición a medio hacer).

---

### [#F6] [Comunicación] — Contradicción de "tiempo límite" entre pantallas
📍 **Ubicación:** `MisCuponesPage` header dice **"Cada cupón activo tiene 30 minutos antes de expirar."** Pero `CuponActivoPage` muestra **"Sin tiempo límite — el código vale hasta que lo uses"** cuando el backend no envía `expiresAt`.
👀 **Qué vi:** Dependiendo del estado, el usuario lee dos verdades opuestas en la misma sesión.
😖 **Por qué molesta:** Si Lucas creyó que tenía 30 min y va corriendo al comercio, después ve "sin tiempo límite" y desconfía. ¿Quién dice la verdad?
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Decidir UNA política: o todos los cupones expiran a 30min, o ninguno. Sincronizar el copy en `MisCuponesPage:158` con la realidad del backend. Idealmente: backend SIEMPRE envía `expiresAt` (aunque sea +99 años para "sin expiración") y la UI muestra el tiempo restante en ambos lados.

---

### [#F7] [Flujo + Comunicación] — Validar pantalla sin warning pending_payment
📍 **Ubicación:** `AdminValidarPage`.
👀 **Qué vi:** Sandra está en `pending_payment` (visible en dashboard). Va a Validar. Tipea un código. Ningún recordatorio de su estado.
😖 **Por qué molesta:** Si los vecinos no la ven en el catálogo, nadie va a generar códigos para canjear. Sandra puede estar tipeando códigos en vano sin entender por qué nada funciona.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Mostrar un banner sticky-top en TODO el panel admin cuando `pending_payment`, no solo en Inicio.

---

### [#F8] [UI] — Doble CTA "Crear nuevo" + "Crear primer cupón" en empty state
📍 **Ubicación:** `AdminCuponesPage` cuando no hay cupones.
👀 **Qué vi:** Botón arriba a la derecha "+ Crear nuevo" y card grande al centro con "+ Crear primer cupón". Misma acción, dos botones, redundancia visual.
😖 **Por qué molesta:** Distrae. ¿Cuál es el botón correcto?
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Si hay empty state con CTA explícito, ocultar el botón "+ Crear nuevo" arriba.

---

### [#F9] [UI + A11y] — 6 ítems en bottom nav del admin en mobile chico
📍 **Ubicación:** `MerchantShell.tsx` — nav bottom mobile.
👀 **Qué vi:** Inicio / Validar / Cupones / Clientes / Promos / Comercio. 6 ítems en 375px → cada tap target ~62px. Iconos y labels chicos. Borderline para WCAG (mínimo 44x44).
😖 **Por qué molesta:** Mistaps frecuentes. Sandra apura entre clientes y termina en la sección equivocada.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Medio
✅ **Recomendación:** Bajar a 5 ítems agrupando "Comercio" en un menú "Más" o moviendo "Promos" a un submenu de "Clientes". Alternativa: mantener 6 pero reducir padding lateral del contenedor de la nav.

---

### [#F10] [Forms + Comunicación] — Validación de email vacío usa copy del browser
📍 **Ubicación:** `LoginPage` botón "Enviarme el código" sin email.
👀 **Qué vi:** Pop-up nativo del browser "Completa este campo" — en idioma del SO del usuario (puede ser inglés "Please fill out this field").
😖 **Por qué molesta:** Sale del flow visual de Cuponcito, se ve cheap.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Quitar `required` nativo y manejar la validación con setError + `role="alert"` propio en el flow visual de la app, como ya hacen otros forms (ej. RegistroPage).

---

### [#F11] [Microcopy] — "Solo te lo pedimos esta vez" minimiza el costo del registro
📍 **Ubicación:** `RegistroPage` subheading.
👀 **Qué vi:** Pide nombre, DNI, email, WhatsApp, fecha de nacimiento, T&C. El copy arriba dice "Solo te lo pedimos esta vez."
😖 **Por qué molesta:** "Solo" es minimizador. El usuario LE DEDICA ENERGÍA cargando 5 datos personales. Reconocer eso es más empático.
🔥 **Severidad:** Media (registro es el momento más crítico de conversión)
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cambiar a algo como **"Una vez completado, no te lo pedimos más — usás todos los descuentos directo desde tu cuenta."** O incluso: **"~2 minutos. Después es 1 tap para canjear cualquier descuento."**.

---

### [#F12] [UI] — Placeholder DNI redundante con help text
📍 **Ubicación:** `RegistroPage` campo DNI.
👀 **Qué vi:** Placeholder "30123456" y debajo help "Sólo números, sin puntos".
😖 **Por qué molesta:** El placeholder YA muestra solo números sin puntos. El help es info repetida.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Eliminar el help text, o cambiarlo a algo distinto: "7 u 8 dígitos".

---

### [#F13] [Comunicación] — "Mis cupones" vs "Descuentos del comercio"
📍 **Ubicación:** En `AdminCuponesPage` el chip dice "MIS CUPONES" pero el H1 dice "Descuentos del comercio". En la app del vecino se usa "cupones" en navegación y "descuentos" en el catálogo.
👀 **Qué vi:** El producto usa los dos términos como sinónimos sin convención clara.
😖 **Por qué molesta:** Mínima fricción cognitiva. ¿Son lo mismo? ¿Hay diferencia?
🔥 **Severidad:** Media (presencia masiva)
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Adoptar un solo término. Mi sugerencia: **"descuentos"** para el catálogo público (lo que el vecino ve y comparte) y **"cupones"** para lo activado/canjeado (el QR personal). Esa convención ya está bien aplicada en parte; falta consolidarla.

---

### [#F14] [Microcopy] — Banner pending_payment dice "Tocá para ver el estado"
📍 **Ubicación:** `AdminDashboardPage`.
👀 **Qué vi:** "Suscripción pendiente de pago — Completá el pago para que tu comercio sea visible para los vecinos. Tocá para ver el estado."
😖 **Por qué molesta:** "Ver el estado" sugiere consulta pasiva ("ya sé el estado, decímelo"). El usuario quiere ACTUAR.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cambiar a **"Tocá para pagar y activar tu comercio."** El CTA implícito debe ser acción, no consulta.

---

### [#F15] [UI + Comunicación] — Dashboard sin canjes muestra "0 / 0 / 0" frío
📍 **Ubicación:** `AdminDashboardPage` KPIs.
👀 **Qué vi:** Tres cards "Canjes hoy / Esta semana / Este mes" con tres ceros idénticos. El de "Este mes" está destacado en violet por accent.
😖 **Por qué molesta:** Visual frío. Comercios nuevos ven 0/0/0 cada vez que entran.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cuando los 3 son 0, mostrar UN solo card grande "Listo para tu primer canje · Recibí a un cliente, pedile el código, validá. ¡Te esperamos!" con CTA a Validar. Ya hay un onboarding banner en el código pero queda tapado por las KPIs vacías.

---

### [#F16] [Microcopy] — Toggle "Por descuento" / "Por local" confunde
📍 **Ubicación:** `DescuentosPage` ViewToggle.
👀 **Qué vi:** Dos botones "Por descuento" / "Por local". El segundo es ambiguo — ¿"local" = "comercio cercano"? ¿"local" = "negocio"?
😖 **Por qué molesta:** "Local" en argentino puede ser comercio o "cerca de mí". El usuario no entiende qué cambia.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cambiar a **"Por descuento" / "Por comercio"** o **"Ofertas" / "Comercios"**.

---

### [#F17] [Microcopy] — "Promos" en nav bottom es ambiguo
📍 **Ubicación:** `MerchantShell` nav.
👀 **Qué vi:** "Promos" es el ícono de WhatsApp. Sandra puede pensar que es "ver promociones disponibles" no "mandar promos a clientes".
😖 **Por qué molesta:** Mistapeo + curva de aprendizaje innecesaria.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cambiar label a **"WhatsApp"** (es lo que es). El ícono ya es de mensajería, no se gana nada con la palabra "Promos".

---

### [#F18] [UI + Mobile] — Footer y bottom nav cerca en mobile chico
📍 **Ubicación:** `AppShell` mobile.
👀 **Qué vi:** Footer (Términos · Privacidad · Mi cuenta · email) queda a ~67px del bottom nav floating. Visualmente apretado en pantallas chicas, con el nav semitransparente encima del footer cuando hay scroll.
😖 **Por qué molesta:** Sensación de "amontonado" en la zona pulgar.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Aumentar `pb-32` → `pb-40` en el `<main>` del AppShell para más respiración. O mover el footer al panel de Perfil (donde realmente buscás esos links).

---

## 5. Recomendaciones

### Quick wins — hacer esta semana

| Fix | Impacto |
|-----|---------|
| **F1** — Sincronizar contador con listado filtrado | Saca la contradicción del primer load. Crítico. |
| **F2** — Bloquear/transformar "Crear cupón" si pending_payment | Evita trabajo en vano de comercios nuevos. |
| **F3** — Error de validación con razón específica del backend | Reduce fricción en mostrador. |
| **F4** — Decidir email único de soporte vía `VITE_SUPPORT_EMAIL` | Profesionalismo. |
| **F5** — Cambiar "Cancelar" → "Volver" en headers de Login/Registro | Microclaridad recurrente. |
| **F6** — Sincronizar copy "30 minutos" entre MisCupones y CuponActivo | Verdad operativa única. |
| **F7** — Banner pending_payment sticky en todo el admin | Contexto persistente. |
| **F14** — "Tocá para ver el estado" → "Tocá para pagar" | CTA accionable. |
| **F17** — "Promos" → "WhatsApp" | Claridad. |
| **F8** — Remover botón duplicado "Crear nuevo" en empty state cupones | Limpieza visual. |
| **F10** — Quitar `required` nativo, usar validación visual propia | Consistencia de marca. |

**Estimado total:** ~3-4 horas de dev. Todos riesgo bajo.

### Mejoras estratégicas — próximos sprints

- **F9 — Replantear el nav bottom del admin.** 6 ítems no entran cómodos en mobile. Posibles caminos: agrupar "Comercio" en un menú "Más", o agrupar "Promos + Clientes" como "Comunicación". Requiere decisión de IA (information architecture).
- **F13 — Glosario consistente.** Un documento de "convenciones de copy" que defina cupón vs descuento, vecino vs cliente, comercio vs local. Sirve para que cada nuevo dev/diseñador no reabra esta discusión.
- **F15 — Onboarding visual para comercio nuevo.** En lugar de "0/0/0", una bienvenida con 3 pasos: "1. Creá un descuento · 2. Esperá a tu primer cliente · 3. Validá su código". Ya hay un banner de DB02 pero queda tapado.

### Lo que está bien (no tocar)

- **Empty states** del vecino (Mis cupones, Canjeados) — excelentes, copy útil + CTA claro
- **Editor de cupones** con preview en vivo y presets de % — fricción mínima
- **TemplatesPicker** de plantillas pre-llenadas por rubro — onboarding tácito brillante
- **OTP login** con código grande + countdown + reenviar + cambiar email — muy bien resuelto
- **SubscriptionCard** con Ley 24.240 explícita — honesto y legal
- **Notifications bell** con SSE en tiempo real — diferencial
- **PWA install prompt** con instrucciones iOS manuales — cubre el 30-40% de usuarios que el `beforeinstallprompt` deja afuera

---

## Apéndice — Método y limitaciones

- **Recorrido en vivo:** Mobile 375×812 con dev server local (vite + react 19).
- **Sin backend real:** El API no estaba corriendo. La sesión simulada no rehidrató el zustand-like store entre navegaciones → no pude recorrer 100% de los flujos autenticados del vecino.
- **Lo no auditado:** Flujo de pago Mercado Pago real (queda en mock), flujo de WhatsApp Business sesión QR (requiere whatsapp-web.js), flujo de canje confirmado real (sin API).
- **Próxima vez:** correr API + Mongo + MP sandbox para auditar pago + WhatsApp E2E.

---

*Reporte generado por auditoría exploratoria. No se modificó ningún archivo de código de producción durante esta pasada — solo este `.md`.*
