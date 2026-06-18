# Auditoría pre-lanzamiento — Mi San Pedro

**Fecha:** junio 2026 · **Objetivo:** lanzamiento oficial con 0 P0/P1 abiertos.
**Método:** (1) auditoría EN VIVO en producción manejando Chrome (chrome-devtools MCP) sobre las
superficies públicas; (2) auditoría de CÓDIGO en paralelo de las 29 pantallas + 2 landings (workflow
de 27 agentes, 159 hallazgos). Report-only — no se tocó código.
**Dump completo de los 159 hallazgos:** `tasks/wamuxcvla.output` (P2/P3 incluidos, con archivo:línea y fix).

---

## 0. RESUMEN EJECUTIVO — ¿listos para lanzar?

**Veredicto: CASI. El camino crítico CORE funciona, pero hay un lote de P1 para cerrar antes de abrir.**
No hay ningún P0 catastrófico en el flujo principal del vecino (ver catálogo → activar → QR) ni en el
alta del comercio: en vivo, render on-brand, **consola y red limpias, API+CORS 100% OK, sin data mock
fantasma**. Pero el análisis de código encontró bordes filosos que conviene limar para un lanzamiento.

**Conteo (análisis de código): 159 — P0:5 · P1:29 · P2:57 · P3:68.**

**Reconciliación de los 5 "P0" (importante):**
| "P0" reportado | Realidad tras verificar en vivo | Queda en |
|---|---|---|
| CTAs landing vecino → gh-pages si no hay `VITE_APP_URL` | **Mitigado**: `deploy-hostinger.mjs` inyecta `VITE_APP_URL=app.misanpedro.com`; verifiqué en vivo que los CTAs van al dominio correcto. El agente no vio ese script. | **P2** (footgun: arreglar el default) |
| CTAs landing comercios → gh-pages | **Mitigado** igual (verificado en vivo: "Soy un comercio" → app.misanpedro.com) | **P2** (footgun) |
| Alta del comercio con `bg-violet-mesh` (#695ede) | **Real** pero sutil (mesh a 0.16 opacidad). Violeta PROHIBIDO + sistémico (lo usan otras pantallas) | **P1** (marca) |
| WhatsApp: audiencia del store demo, no del backend real | **Real**, pero módulo **secundario** (no es el camino crítico) | **P1** (módulo WhatsApp) |
| WhatsApp: todos reciben el nombre del 1er cliente | **Real**, módulo secundario | **P1** (módulo WhatsApp) |

→ **Cero P0 en el camino crítico core.** Los bloqueantes reales antes de lanzar son el **lote P1 por temas** de abajo.

---

## 1. LOS 6 TEMAS A RESOLVER (raíz común, muchas pantallas)

### TEMA 1 — 🟠 Glosario "cupón" vs "descuento" inconsistente (lo más extendido)
La regla es: **vecino = "cupón"**, **comercio = "descuento"**. Hoy está roto en AMBAS direcciones:
- **Comercio dice "cupón"** (debería "descuento"): `AdminLoginPage` (hero), `AdminDashboardPage` (header, CTAs, "Mis cupones"), `AdminCuponesPage` (empty-state, 3 toasts, 3 ConfirmDialog), `AdminEstadisticasPage` ("Tus cupones", insights, CTA). *(T5 solo arregló el editor + el header del listado; faltó el resto del panel.)*
- **Vecino dice "descuento"** (debería "cupón"): `MerchantDetailPage` ("Descuentos disponibles"), `MisCuponesPage` (header/empty/botón + manda a una pantalla "Descuentos" que no existe; el tab real es "Cupones"), `RegistroPage` (botón "Canjear mi descuento").
- **Tensión a decidir**: la **landing del vecino** usa "descuento" en todo (lenguaje llano), mientras la **app del vecino** usa "cupón". Hay que **fijar el término del vecino de una vez** y barrer. → *Decisión tuya: ¿el vecino ve "cupón" o "descuento"?* (recomiendo "cupón" en la app por consistencia con el tab, y revisar si la landing se alinea).

### TEMA 2 — 🟠 Estados de error de API no manejados (en prod, una caída = pantalla fantasma)
Varias pantallas leen `.data`/`.loading` pero NO `.error`, así que si la API falla muestran vacío/skeleton infinito en vez de "sin conexión + reintentar" (los hooks ya exponen `refetch`). *(T4 cubrió Descuentos/Dashboard; faltan estas):*
- `MapaPage` → mapa pelado sin aviso. `PlanPage` → muestra "Estamos sumando comercios" (miente: parece que tu ciudad no tiene comercios). `MisCuponesPage` → tarjetas en skeleton infinito. `AdminCuponesPage` → "No tenés cupones cargados" aunque tengas (y peor: las acciones caen al store local fantasma).

### TEMA 3 — 🟠 Dominios viejos en lugares de usuario / SEO (`misanpedro.app`, `soyalantapia.github.io`)
- **Email de soporte `hola@misanpedro.app`** en Footer landing-vecino, `TenantSelectorPage`, y `misanpedro.app` en cn.ts de comercios. Si esa casilla no existe, el vecino/comercio escribe a la nada.
- **SEO landing-vecino**: `robots.txt` + `sitemap.xml` apuntan a `soyalantapia.github.io/.../comercios/` (gh-pages + sección equivocada) mientras el `<head>` ya usa `misanpedro.com`. Google indexaría URLs muertas.
- **JSON-LD landing-comercios**: `url`/`logo` a gh-pages (contradice canonical/OG en misanpedro.com).
- **WhatsApp**: el `{{link}}` del mensaje saliente es el literal `misanpedro.app` (sin https → ni se hace clickeable).

### TEMA 4 — 🟠 Bugs funcionales puntuales (varios tocan el camino crítico)
- **`AdminValidarPage`** — todo error 409 se muestra como **"ya fue canjeado"**, aunque el cupón esté pausado/vencido/cancelado. En el momento de cobrar, el comercio le dice al vecino "ya lo usaste" siendo falso → desconfianza. *(El API ya manda `status` para desambiguar.)*
- **`RegistroPage`** — si la activación falla tras registrarse (sin stock, ya canjeado, red), el catch navega de vuelta **sin ningún toast** → dead-end en el happy-path del canje.
- **`CuponActivoPage`** — promete "esta pantalla se actualiza sola" pero en el flujo demo/local el polling no arranca → el vecino mira el QR para siempre.
- **`TenantSelectorPage`** — loop de reload infinito en modo privado / storage bloqueado (iOS Safari).
- **`AdminClientesPage`** — el export CSV crashea si una fecha viene `null` (sin coalescing).
- **`AdminComercioPage`** — en `pending_payment` muestra "Pagar" y "Cancelar suscripción" a la vez (callejón confuso).
- **`PerfilPage`** — UI contradictoria: billetera/Club logueados encima del bloque anónimo "Tu perfil" si el token está pero el store no hidrató.

### TEMA 5 — 🟡 Marca: violeta viejo (#695ede) residual
`index.css` define `bg-violet-mesh` y la mitad de `bg-emerald-mesh` con `rgba(105,94,222,…)` = el violeta PROHIBIDO. `AdminSignupPage` usa `bg-violet-mesh` de fondo (sutil, pero es lo primero que ve el comercio al registrarse). También un comentario stale en index.css del vecino dice "Brand — violet #695EDE" sobre el token naranja, y el color del `noscript` de la landing-comercios es #695ede.

### TEMA 6 — 🟡 Accesibilidad: foco de teclado invisible en TODA la app
`index.css` hace `*:focus-visible { outline: none }` **sin reemplazo** → ningún botón/link/input muestra foco al navegar con teclado (falla WCAG 2.4.7). Es global, afecta toda la app.

---

## 2. HALLAZGOS SOLO-EN-VIVO (no salen del código)

| # | Pantalla | Sev | Qué pasa | Fix |
|---|---|---|---|---|
| L1 | Home/detalle | **P1** | Cupón real con badge **"40% OFF"** pero título **"20% de descuento"** (comercio TAP) → info contradictoria en el catálogo de lanzamiento. Es DATO del comercio. | Revisar TODOS los cupones vivos (título vs %); idealmente que el asesor advierta el desajuste. |
| L2 | Catálogo | P2 | Títulos de comercios con typos ("Promocion 20$", sin tilde). Dato del comercio. | Revisión de contenido antes de lanzar. |
| L4 | App (1ª carga) | P2 | El prompt **"Instalá Mi San Pedro" salta de entrada y tapa el catálogo**. | Diferirlo (tras scroll/engagement). |
| L5 | Formularios | P2 | Inputs **sin `id`/`name`** (consola: alta ×5, home ×1) → rompe autocompletado + a11y. | Agregar `id`+`name`. |
| L3 | Cards/detalle | P3 | Money con espacio: "$ 3.000". | Formatear "$3.000". |
| L6 | Home | P3 | Doble fetch de `/merchants` y `/coupons`. | Deduplicar. |

**Positivos en vivo (no romper):** red 100% 200/204 (API+CORS OK, sin mock fantasma) · consola limpia salvo id/name · marca naranja consistente · **verde solo para el ahorro** ✅ · alta sin fiscal + pin opcional (T2) ✅ · onboarding sin fricción ✅ · 404 on-brand · catálogo con data real (10+ comercios).

---

## 3. CONTEO POR PANTALLA (análisis de código)

| Pantalla | P0 | P1 | P2 | P3 | | Pantalla | P0 | P1 | P2 | P3 |
|---|--|--|--|--|--|---|--|--|--|--|
| landing-vecino | 1* | 2 | 3 | 2 | | admin-login | 0 | 1 | 1 | 3 |
| landing-comercios | 1* | 3 | 2 | 1 | | admin-signup | 1 | 0 | 2 | 1 |
| home-descuentos | 0 | 0 | 2 | 4 | | admin-dashboard | 0 | 2 | 4 | 2 |
| mapa | 0 | 1 | 2 | 2 | | admin-validar | 0 | 1 | 2 | 2 |
| cupon-detalle | 0 | 0 | 2 | 3 | | admin-confirmar | 0 | 0 | 2 | 4 |
| comercio-detalle | 0 | 1 | 2 | 3 | | admin-cupones | 0 | 2 | 1 | 2 |
| cupon-activo | 0 | 1 | 1 | 3 | | admin-cupon-edit | 0 | 0 | 3 | 5 |
| canjeados | 0 | 0 | 3 | 2 | | admin-clientes | 0 | 2 | 6 | 3 |
| mis-cupones | 0 | 2 | 2 | 1 | | admin-estadisticas | 0 | 1 | 2 | 2 |
| alertas | 0 | 1 | 1 | 3 | | admin-whatsapp | 2 | 1 | 3 | 2 |
| perfil | 0 | 1 | 1 | 3 | | admin-referidos | 0 | 1 | 1 | 3 |
| plan | 0 | 1 | 1 | 2 | | admin-comercio | 0 | 1 | 3 | 3 |
| registro-vecino | 0 | 2 | 2 | 1 | | tenant-selector | 0 | 2 | 2 | 3 |
| not-found | 0 | 0 | 1 | 3 | | | | | | |

*Los P0 de las landings son footgun de build, ya mitigados en el deploy real (ver Resumen).

---

## 4. PLAN PRIORIZADO (qué arreglar primero)

**Antes de abrir (cerrar P1):**
1. **Estados de error de API** (Tema 2) — extender el patrón T4 a Mapa/Plan/MisCupones/AdminCupones. *(confiabilidad)*
2. **Bugs funcionales del camino crítico** (Tema 4) — validar-409, registro-silencioso, cupon-activo, tenant-loop. *(no perder canjes/altas)*
3. **Glosario** (Tema 1) — decidir término del vecino + barrer panel comercio y app vecino. *(coherencia de marca)*
4. **Dominios viejos** (Tema 3) — soporte `@misanpedro.com`, robots/sitemap/JSON-LD → misanpedro.com, link WhatsApp. *(SEO + contacto)*
5. **L1 — revisar la data de los cupones vivos** (título vs %). *(primera impresión del catálogo)*

**Pulido (P2):** violeta residual (Tema 5), foco de teclado (Tema 6), prompt de instalación (L4), inputs id/name (L5), defaults de `VITE_APP_URL` (footgun), CSV null (AdminClientes), pending_payment (AdminComercio).

**Mejoras (P3, post-lanzamiento):** money format, doble fetch, contenido de comercios/WhatsApp en la landing, y el resto del dump.

**Pendiente de testeo (no se pudo en prod sin ensuciar datos):** los flujos que CREAN datos —activar cupón, confirmar canje, alta real, crear cupón con el asesor— hay que correrlos en **LOCAL** (`pnpm dev:api` + `pnpm dev:web`) para validar el camino crítico end-to-end.
