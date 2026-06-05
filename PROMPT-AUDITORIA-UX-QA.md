# Prompt — Auditoría integral UX/UI + QA funcional (Mi San Pedro · app del vecino)

> Pegá todo lo de abajo como prompt en una sesión de Claude Code parada en `~/dev/misanpedro`.
> Objetivo: revisar la app del vecino **desde todos los ángulos** (visual, funcional, usabilidad)
> y decidir si está **lista para producción**, **encontrando y documentando TODOS los bugs**.

---

## Rol y objetivo
Sos un auditor senior de producto: **QA funcional + diseño UX/UI + accesibilidad**, con ojo de usuario final exigente. Tu trabajo es revisar **de punta a punta la app del vecino de Mi San Pedro** y determinar si está **lista para producción**. Tenés que **encontrar TODOS los errores, bugs e inconsistencias** —visuales, funcionales y de usabilidad— y **documentarlos** en un reporte accionable.

**No arregles nada.** Solo auditá, reproducí y documentá. No commitees, no deployes, no toques `main`.

## Contexto del producto
- **Qué es:** "Mi San Pedro", el **club de ahorro de la ciudad de San Pedro** — PWA gratis del vecino con cupones de descuento en comercios locales. Tagline: *"Tu plata rinde más"*.
- **App:** monorepo `~/dev/misanpedro`, vecino en `apps/web` (React 19 · Vite 7 · TS strict · Tailwind 4 · React Router 7 **HashRouter**, base `/misanpedro/`). Multi-tenant, tenant = `sanpedro`.
- **Levantarlo:** `pnpm dev:web` (Node 22). También online (deploy **manual**, puede estar viejo): https://soyalantapia.github.io/misanpedro/
- **Auth:** el vecino entra por **OTP email**. Perfil, Canjeados, Alertas y activar/canjear cupón **requieren login**. Si no podés loguear headless, auditá todos los estados públicos y **marcá explícitamente qué quedó “No verificado” por falta de login**.

### Reglas DURAS de marca / design system (medilas contra esto)
- **Naranja `#ea580c` = marca** (acción, nav, énfasis, CTAs).
- **Verde `#059669` = RESERVADO al ahorro** ("Ahorrás ~$X", ahorro total). No se usa para otra cosa.
- **Single-knob:** todo color sale de tokens semánticos (`--color-brand`, alias `fin-*`). **No debe haber hex sueltos** ni escalas tipo `accent-500` en componentes.
- Tema **LIGHT** forzado (blanco). No debe haber restos de dark mode.
- **Narrativa LOCKED (revisá el copy):** "El club de ahorro de San Pedro" · "Tu plata rinde más" · decir **"tu ciudad"/"San Pedro", NUNCA "pueblo"** · **nunca "fundador"** (usar "comercios"/"comercio adherido"/"los primeros 20 comercios") · imagen digna, no "app para pobres".
- **Mobile-first:** viewport primario **390×844**. Revisá también **360** (chico), **768** (tablet) y **1280** (desktop).

## Alcance — recorré TODAS las pantallas y flujos
1. **Home / Cupones** (`/`): billetera de ahorro, buscador, **cuadraditos de categoría con emoji**, grilla de cupones (badge % naranja, ahorro en verde), corte "Armá tu plan", estados vacío/carga/error.
2. **Locales** (`/locales`): listado de comercios + buscador + chips.
3. **Mapa** (`/mapa`): mapa Leaflet + pines + **lista de locales abajo con tap-para-volar-al-pin** + popups.
4. **Detalle de comercio** (`/comercio/:id`) y **detalle de cupón** (`/cupon/:id`).
5. **Activar cupón → código de 6 dígitos / QR → canje** (`/activacion/:id`): el **flujo de valor crítico**.
6. **Alertas** (`/alertas`): crear/editar/pausar/borrar alertas (rubros, % mínimo, comercio), toggle de notificaciones push, feed "Cupones para vos".
7. **Perfil** (`/perfil`): billetera de ahorro, **tarjeta "El Club" (niveles Bronce/Plata/Oro + progreso + entradas al sorteo del mes + ahorro total + racha)**, datos personales, privacidad (eliminar datos), legal, salir.
8. **Registro** (`/datos`): formulario (nombre, DNI, fecha de nacimiento, email, WhatsApp con país), validaciones, responsive.
9. **Canjeados** (`/canjeados`), **Plan** (`/plan`).
10. **Navegación:** bottom nav con **FAB central "Cupones"**, sidebar (desktop), header.
11. **Globales:** selector de ciudad/tenant, banner offline, install prompt PWA, **404** (`*`).
12. **Estados de datos:** 0 comercios/cupones, 1, muchos; nombres/direcciones largos; **datos de prueba “QA Test” que NO deberían verse en producción**.

## Los 3 ángulos (auditá CADA pantalla por los tres)

### A) Visual / UI / color
- Adherencia al design system: solo tokens semánticos; **naranja=marca, verde=solo ahorro**; sin hex sueltos.
- **Contraste WCAG AA**: texto chico ≥4.5:1, texto grande/CTA ≥3:1 (ojo blanco sobre naranja ≈3.6:1 → válido para botones/títulos, NO para texto chico), badges, placeholders, texto sobre tints de categoría.
- Consistencia: espaciados, radios, sombras, tipografía, tamaños de ícono, estados **hover/active/focus/disabled**.
- Jerarquía, alineación, **truncado/overflow** de textos largos, anillos/sombras recortados por contenedores con `overflow`.
- **Responsive** (360/390/768/1280): safe-area, solapamiento con bottom nav/FAB, scroll horizontal indeseado, reflow de grillas.
- **Imágenes rotas / placeholders** (pendiente conocido: imágenes de comercio).
- Animaciones suaves, sin jank; respetar `prefers-reduced-motion`.
- Señales de "AI slop"/descuido (emojis desalineados, doble borde, glow excesivo).

### B) Funcional / interacción / bugs
- Cada control hace lo que dice (nav, filtros, búsqueda, toggles, switches, FAB, tap-to-fly del mapa).
- Estados **loading / error / empty** sin pantallas blancas, sin "undefined/NaN/Invalid Date", sin crashes.
- **Formularios**: validación, errores claros, requeridos, formatos (DNI, WhatsApp+país, fecha, email), submit, doble-submit, teclado mobile, autocompletar.
- Edge cases: 0/1/muchos; nombres y direcciones largos; caracteres especiales/emojis; números grandes ($, %).
- **Cálculos correctos** (verificá contra los datos reales): ahorro total, **niveles del Club (Bronce 1 / Plata 4 / Oro 8), entradas del mes, racha**, % off, distancias, "Ahorrás ~$X".
- Persistencia localStorage por tenant (alertas, vista, ahorro) y entre pestañas.
- API caída / CORS → fallback sin romper. Revisá **consola (errores/warnings) y red (401/404/500, CORS, requests duplicados)**.
- Refresh y deep-link en cualquier ruta (HashRouter), back/forward del navegador.
- PWA: offline, install, service worker; push (documentá limitaciones).

### C) Usabilidad / UX real / listo-para-producción
- ¿Se entiende sin instrucciones? ¿El flujo estrella **descubrir → activar → canjear** es fluido y sin fricción?
- Dead-ends, botones que no llevan a nada, pasos de más, callejones sin salida.
- **Copy**: claro, sin typos, on-brand, narrativa LOCKED (sin "pueblo"/"fundador"), consistente entre pantallas.
- Affordances (se ve tocable) y feedback (toasts/loaders/estados activos).
- **Accesibilidad**: `aria-label`, foco visible, navegación por teclado, **touch targets ≥44px**, jerarquía de headings, lectores de pantalla, `alt` en imágenes.
- Performance percibida (carga inicial, skeletons, lazy chunks).
- **Production-readiness**: cero placeholders, cero datos "QA Test" visibles, cero TODO/FIXME en pantalla, cero `console.error`, cero links rotos/404, cero secretos expuestos, theme-color del navegador correcto (no el violeta viejo).

## Método
1. Levantá `pnpm dev:web` (o usá el deploy). Navegá con el headless de gstack (`browse`) y/o un device real. Probá **logueado y deslogueado**.
2. Recorré **pantalla por pantalla y flujo por flujo**. En cada una: screenshot **mobile (390) + desktop (1280)**, revisá los 3 ángulos, abrí **consola** y **red**.
3. Probá **happy paths Y caminos de error/edge** (datos vacíos, API caída, inputs inválidos, sin permisos de ubicación/notificaciones).
4. Anotá **todo** hallazgo, por chico que sea, con evidencia (screenshot/log/request).
5. (Opcional, acelera) podés apoyarte en las skills gstack: `/qa-only`, `/design-review`, `/cso`.

## Salida — Reporte accionable (guardar en `REPORTE-AUDITORIA-UX-QA.md`)
Encabezado: fecha, commit/build auditado, alcance cubierto + qué quedó "No verificado", **tabla resumen con conteo por severidad**, y **veredicto "¿LISTO PARA PRODUCCIÓN?" (Sí / No + lista de bloqueantes)**.

Cada hallazgo, así:

    ### [F-001] Título corto y claro
    - Severidad: 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🔵 Bajo
    - Categoría: Visual/Color · Funcional/Bug · UX · Accesibilidad · Copy · Performance · Producción
    - Pantalla / Ruta / Componente (archivo si lo ubicás)
    - Pasos para reproducir (1, 2, 3…)
    - Esperado vs Actual
    - Evidencia: screenshot / log de consola / request fallido
    - Fix sugerido + esfuerzo (S / M / L)
    - Estado: Abierto

Criterio de severidad:
- 🔴 **Crítico** — bloquea producción: rompe el flujo de valor, crash, pérdida de datos, dato de prueba/secreto expuesto, texto ilegible por contraste.
- 🟠 **Alto** — bug funcional o visual grave (hay workaround).
- 🟡 **Medio** — inconsistencia de diseño / UX subóptima / a11y media.
- 🔵 **Bajo** — cosmético / nice-to-have.

Cerrá con: **lista priorizada de bloqueantes de producción** + **veredicto final**.

## Reglas
- **No arregles, no commitees, no deployes.** Solo auditar + documentar (salvo pedido explícito).
- **No inventes**: reproducí cada hallazgo. Lo que no puedas probar (ej. por login OTP) marcalo "No verificado" y por qué.
- Documentá **TODO**, pero **priorizá por severidad** para que sea accionable, no ruido.
