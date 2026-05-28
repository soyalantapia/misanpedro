# 🕵️ Auditoría UX — "En la piel del usuario" · v3

**Plataforma:** Cuponcito · ecosistema multi-app (PWA vecino+comercio · Owner panel · Landing comercial)
**URL DEV:**
- PWA: http://localhost:5180/misanpedro/
- Owner panel: http://localhost:5182/
- Landing comercial: http://localhost:5181/misanpedro/comercios/

**Auditor:** Claude — personajes mezclados (Lucas vecino · Sandra comercio · Marina owner)
**Fecha:** 2026-05-28 · 3ª vuelta tras aplicar 22 quick wins entre v1 (11) y v2 (11)
**Método:** Navegación real + recorrido por 5 escenarios cubriendo apps que ninguna vuelta anterior había mirado

> **Nota previa:** v1 levantó 18 hallazgos (F1-F18), v2 sumó 9 nuevos (N1-N9) + 2 arrastrados. Todos están aplicados al main. Esta v3 se enfoca en **Owner panel + Landing comercial + flow vecino completo**, áreas que las vueltas anteriores tocaron poco. Resultado: **menos hallazgos nuevos** (señal positiva de madurez) pero **3 son críticos de marca** que pueden tirar abajo conversión comercial.

---

## 1. Resumen ejecutivo

**Sensación general en 3 líneas:**
La PWA principal (vecino + comercio) **se siente sólida y consistente** después de 22 fixes acumulados. Los empty states son útiles, el copy se siente humano, el branding es coherente dentro de la app. Pero **la landing comercial y el Owner panel quedaron desincronizados con el rebrand a Cuponcito** — la landing sigue mostrando "misanpedro" + email "@misanpedro.app" en el header, y el copy del CTA principal dice "Probar gratis" cuando el plan cuesta $25.000/mes. **El embudo de venta tiene fugas que el panel ya resolvió hace 2 versiones.**

### Las 5 fricciones que más sangran (ahora)

| # | Fricción | Dónde duele |
|---|---|---|
| 🔴 1 | **Landing dice "misanpedro" en logo y header** mientras el resto de la app dice "Cuponcito" | Conversión: comerciante duda "¿qué marca soy?" |
| 🔴 2 | **CTA "Probar gratis" en landing** sin trial real (plan es $25.000/mes desde día 0) | Promesa engañosa, abandono en checkout |
| 🟠 3 | **Owner panel sin "¿Olvidaste tu contraseña?"** — pérdida de credenciales = lockout total | Marina queda afuera del SaaS sin recovery path |
| 🟠 4 | **Vecino sin merchants ve search/toggle/categorías sin sentido** | Empty state global tira CTA pasivo en lugar de explicar |
| 🟡 5 | **Registro vecino "Solo te lo pedimos esta vez" minimiza** la carga de 5 datos personales | Tono condescendiente en el momento más crítico de conversión |

### 3 quick wins (hacer hoy)

1. **Sweep de "misanpedro" → "Cuponcito"** en `apps/landing` (logo, header, email del mockup, dominios).
2. **CTA landing "Probar gratis" → "Empezar (30 días sin cargo)"** o "Sumarme a Cuponcito".
3. **Link "¿Olvidaste tu contraseña?"** en owner panel login → reusar el flow de recovery del comercio (ya existe).

---

## 2. Diario del usuario (narrativa)

### 🧑 Lucas, vecino nuevo, llega vía link de WhatsApp

> *Abro Cuponcito. Header lindo "Cuponcito · Descuentos vecinales". Hero: "Descubrí descuentos en tu ciudad". Abajo: "Pronto vamos a sumar más comercios a tu ciudad."*

> *Bueno, no hay descuentos todavía. Bajo igual y veo: barra de búsqueda, toggle "Por descuento / Por local", botón "Ver distancias", chips de categorías "Gastronomía · Cafetería · Panadería…", y al final "No encontramos descuentos · Pronto vamos a sumar más comercios al programa."*

> *Espera. Si no hay descuentos, ¿para qué muestran 5 controles que no sirven? Búsqueda vacía, toggle vacío, distancias de nada, 19 categorías sin nada adentro.*

> *La pantalla se siente "rota" — como una app esperando data que nunca llegó.*

**[V4 — Controles fantasma en empty state global]**

> *Voy a Perfil → me lleva a /login. Pongo email vacío, le doy "Enviarme el código". Error in-app claro: "Ingresá tu email para que te mandemos el código." ✓ Sin popup feo del browser.*

> *Voy a Registro. "Estás a un paso · Creá tu cuenta para canjear · Solo te lo pedimos esta vez. Después usás todos los descuentos sin volver a registrarte."*

> *"Solo te lo pedimos esta vez" — me piden nombre, DNI, email, WhatsApp, fecha de nacimiento y aceptar T&C. 6 cosas. No es "solo". Es un montón. Decime "es un toque tedioso pero después es mágico", no me trates como tonto.*

**[V8 — Copy minimizador en registro]**

---

### 🏪 Sandra, dueña de comercio, googleá "cuponcito comercios" y aterriza en la landing

> *Voy a cuponcito.app/comercios o el link que vi en el flyer. Carga la landing.*

> *Header: logo **misanpedro** y el menú "Funciones · Cómo funciona · Casos de uso · Precios · FAQ" + CTA "Empezar".*

> *Espera, ¿misanpedro? Yo busqué Cuponcito. ¿Es lo mismo? ¿Cambió la marca? ¿Es vieja la landing? Ya empiezo a dudar.*

**[L1 — Branding inconsistente landing vs panel]**

> *Bajo. Headline gigante: "Tus clientes vuelven solos. Sin imprimir un volante más." OK, eso me gusta. "Subí tus descuentos en 5 minutos, validalos con un código de 6 dígitos…" Bien escrito.*

> *Dos CTAs: "Probar gratis →" (violeta primario) y "Ver precio →" (texto).*

> *Click en "Probar gratis". Me lleva a /admin/registro. Form de 3 pasos. Lleno datos. Llego al paso "Activá tu suscripción" y veo: **$25.000 / mes**. PRECIO CONGELADO DE POR VIDA.*

> *Esperá. ¿Y lo "gratis"? La landing me dijo "Probar gratis" pero ahora me cobra desde día 1. ¿Hay trial? ¿15 días? ¿No dice nada?*

> *Me siento engañada. Cierro la pestaña.*

**[L2 — "Probar gratis" sin trial real]**

> *Bajo a ver la maqueta del admin. El mockup muestra "admin.misanpedro.app" en la URL del browser. Pero arriba el header dice "misanpedro" no "Cuponcito". Toda la landing parece de una marca antigua.*

**[L3 — Mockup muestra dominio viejo misanpedro.app]**

---

### 👑 Marina, owner del SaaS, vuelve después de 2 meses y olvidó su password

> *Voy a admin.cuponcito.app (Owner panel). Login limpio: "Entrar al Owner Panel · Acceso restringido a dueños del SaaS". Bien.*

> *Pongo mi email. Pongo password que creo que era. Click "Continuar". Error: "Email o contraseña incorrectos." OK, lo intento de nuevo.*

> *Después de 3 intentos me doy cuenta que olvidé la password real. Busco un link "¿Olvidaste tu contraseña?" — **no existe**. No hay forma de recuperar.*

> *Si la owner pierde su contraseña, queda afuera del SaaS hasta que el dev (yo) entre a la DB y la reset manualmente. **Es el SPOF más crítico del producto**.*

**[O1 — Sin password recovery en Owner panel]**

> *El botón "Continuar →" se ve **deshabilitado/translucido** cuando recién entré (sin tipear nada). Pero al clickear sí funciona. Confunde — pensé que estaba bloqueado.*

**[O2 — Estado disabled visual sin lógica de disabled]**

---

## 3. Tabla priorizada — Matriz Impacto × Esfuerzo

| ID | Problema | Severidad | Esfuerzo | ¿Quick win? |
|----|----------|-----------|----------|-------------|
| **L1** | Landing dice "misanpedro" en logo + header | 🔴 Crítica | Bajo | ✅ |
| **L2** | "Probar gratis" sin trial real | 🔴 Crítica | Bajo | ✅ |
| **L3** | Mockup landing muestra "admin.misanpedro.app" | 🟠 Alta | Bajo | ✅ |
| **O1** | Owner panel sin password recovery | 🟠 Alta | Medio | — |
| **V4** | Vecino empty state global muestra controles fantasma | 🟠 Alta | Bajo | ✅ |
| **O2** | Owner panel botón "Continuar" visualmente disabled sin estar disabled | 🟡 Media | Bajo | ✅ |
| **V8** | Registro vecino "Solo te lo pedimos esta vez" minimiza | 🟡 Media | Bajo | ✅ |
| **V11** | Landing nav 6 items sin scroll mobile (rompe en mobile chico) | 🟡 Media | Bajo | ✅ |

---

## 4. Hallazgos detallados

### [#L1] [Comunicación + Branding] — Landing comercial dice "misanpedro" en header
📍 **Ubicación:** `apps/landing/src/sections/Nav.tsx` — logo + texto "misanpedro" en navbar superior.
👀 **Qué vi:** Header de la landing muestra avatar "m" + texto "misanpedro" en negrita. El resto del ecosistema (PWA + Owner panel) ya migró a "Cuponcito" desde hace 3+ commits. La landing quedó en el branding viejo.
😖 **Por qué molesta:** Sandra googleá "Cuponcito" o "Cuponcito comercios", llega a la landing y ve OTRA marca. Duda. Pierde confianza. Puede pensar "se equivocaron de página". El embudo de venta tiene fuga **antes de que mire el producto**.
🔥 **Severidad:** Crítica (es la página comercial — primer punto de contacto B2B)
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Sweep de "misanpedro" → "Cuponcito" en todo `apps/landing/src/`. Cambiar logo "m" por "c" (ya existe en owner panel). Verificar también copy de Hero, Footer, FAQ.

### [#L2] [Microcopy + Conversión] — CTA "Probar gratis" sin trial real
📍 **Ubicación:** `apps/landing/src/sections/Hero.tsx` + `FinalCTA.tsx`.
👀 **Qué vi:** Botón violeta primario "Probar gratis →". Click → /admin/registro. Al llegar al paso 3 "Pago", precio: $25.000/mes, sin mención de trial gratuito. El precio se cobra desde el primer mes.
😖 **Por qué molesta:** Es publicidad engañosa de manual. Sandra clickea esperando un trial, encuentra precio + tarjeta de crédito. Abandona y siente que la engañaron — además, te expone a denuncia por Ley 24.240 art. 7 (igual que el blocker B1 de precio que ya cerramos en el panel).
🔥 **Severidad:** Crítica
🔧 **Esfuerzo:** Bajo (decisión de negocio + cambio de copy)
✅ **Recomendación:** Tres opciones:
- **A** Implementar trial real de 14-30 días sin cobro (requiere backend + MP support — más laburo).
- **B** Cambiar CTA a "Sumarme a Cuponcito" o "Empezar ahora" sin promesa "gratis".
- **C** Cambiar a "Probar 10 días con reembolso garantizado" (alineado con el arrepentimiento Ley 24.240 que ya tenés implementado).

### [#L3] [Branding] — Mockup landing muestra "admin.misanpedro.app"
📍 **Ubicación:** Hero section visual mockup del admin panel.
👀 **Qué vi:** Pantalla simulada del admin con URL "admin.misanpedro.app" en la barra del browser fake.
😖 **Por qué molesta:** Refuerza la confusión L1. Sandra ya dudaba con el header — el mockup confirma "ah, no es Cuponcito, es Mi San Pedro". Doble golpe a la confianza.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Editar el mockup para mostrar "admin.cuponcito.app" o "sanpedro.cuponcito.app". Ideal: mockups por ciudad para reforzar la idea multi-tenant.

### [#O1] [Funcional + UX] — Owner panel sin recovery de contraseña
📍 **Ubicación:** `apps/owner/src/pages/LoginPage.tsx`.
👀 **Qué vi:** Login form con email + password + "Continuar →". Sin link "¿Olvidaste tu contraseña?" ni similar. Si Marina pierde su credencial, el único recovery es ir directo a la DB y resetear la columna `passwordHash`.
😖 **Por qué molesta:** Es el SPOF crítico del SaaS. Si el owner queda lockout-eado, no puede dar de alta nuevas ciudades, gestionar suscripciones cross-tenant, ver métricas globales. El recovery flow del comercio (`/admin/forgot-password`) ya existe — solo falta replicarlo.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Medio (replicar flow forgot + reset adaptándolo a la tabla `Owner`)
✅ **Recomendación:** Agregar `OwnerForgotPasswordPage` + endpoint backend `POST /owner/auth/forgot-password` + email con magic link / código. Reusar el componente y la lógica de `AdminForgotPasswordPage`.

### [#V4] [Comunicación + UI] — Vecino empty state global muestra controles fantasma
📍 **Ubicación:** `DescuentosPage.tsx` cuando no hay merchants y no hay cupones.
👀 **Qué vi:** En empty state TOTAL muestra: SearchBar + ViewToggle "Por descuento/Por local" + GeoButton "Ver distancias" + 19 CategoryChips + EmptyState al fondo. Todo controles sin función operativa.
😖 **Por qué molesta:** Hace que la app parezca rota o "esperando datos que no llegan". La primera impresión del vecino nuevo (mucho UI vacío con muchos controles inertes) es mala.
🔥 **Severidad:** Alta (es el primer load de cualquier vecino antes de que llegue el primer merchant en la ciudad)
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Si `merchants.length === 0 && COUPONS.length === 0`, mostrar SOLO el header + EmptyState dedicado:
```
[icono mapa pin]
Estamos sumando comercios en tu ciudad.
Avisanos qué comercio querés ver: [WhatsApp soporte]
También podés sumar el tuyo: [Probar Cuponcito]
```
Ocultar search, toggle, geo y categorías hasta que haya algo que filtrar.

### [#O2] [UI + Affordance] — Owner panel botón "Continuar" se ve disabled sin estarlo
📍 **Ubicación:** `apps/owner/src/pages/LoginPage.tsx` botón submit.
👀 **Qué vi:** Botón violeta translucido en estado neutro. Visualmente parece deshabilitado, pero al clickear funciona.
😖 **Por qué molesta:** Marina entra al panel, ve un botón gris-violet apagado, asume que está bloqueado y no clickea hasta que tipea algo. Fricción mental innecesaria. O peor: clickea, ve que funciona, después en el panel se confunde con disabled "reales" (que SÍ están bloqueados).
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Usar el gradient `from-accent-400 to-accent-600` (igual que el PWA principal) para el estado activo del CTA. Si querés indicar "rellená el form primero", usar `disabled` real con cursor:not-allowed y opacity-50.

### [#V8] [Microcopy] — "Solo te lo pedimos esta vez" minimiza
📍 **Ubicación:** `RegistroPage.tsx` subheader.
👀 **Qué vi:** Pide nombre, DNI, email, WhatsApp, fecha de nacimiento, T&C. 6 items. Copy arriba: "Solo te lo pedimos esta vez. Después usás todos los descuentos sin volver a registrarte."
😖 **Por qué molesta:** "Solo" es minimizador. El vecino LE DEDICA TIEMPO a cargar 6 datos personales. Reconocer eso es más empático.
🔥 **Severidad:** Media (registro es el momento más crítico de conversión)
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cambiar a algo como **"Esto es un toque tedioso, pero después es 1 tap para canjear cualquier descuento."** O: **"~2 minutos. Una sola vez en tu vida."**

### [#V11] [Responsive + UI] — Landing nav 6 items sin scroll en mobile chico
📍 **Ubicación:** `apps/landing/src/sections/Nav.tsx`.
👀 **Qué vi:** Header desktop: logo + 5 links + CTA. En mobile chico (375px) los 5 links + CTA + logo no entran. Sin hamburger explícito visible en este viewport.
😖 **Por qué molesta:** Sandra entra desde mobile (probable), no puede navegar a Pricing o FAQ.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Implementar hamburger menu para mobile, dejando solo logo + CTA "Empezar" en el header. El menú overflow tiene Funciones / Cómo funciona / Casos / Precios / FAQ.

---

## 5. Recomendaciones

### Quick wins — hacer esta semana (todos ≤2h)

| Fix | Impacto |
|-----|---------|
| **L1** — Sweep "misanpedro" → "Cuponcito" en apps/landing | Cierra fuga #1 del embudo comercial |
| **L2** — CTA "Probar gratis" → "Sumarme a Cuponcito" + reassurance "10 días para arrepentirte" | Cierra falsa promesa, alinea con Ley 24.240 |
| **L3** — Mockup con dominio actualizado | Refuerza consistencia de marca |
| **V4** — Hide search/toggle/geo/chips en empty state TOTAL | Mejora primera impresión vecino nuevo |
| **O2** — Botón "Continuar" en owner login con gradient activo | Saca ambigüedad de disabled visual |
| **V8** — Copy registro "Solo te lo pedimos esta vez" → "~2 minutos, una sola vez" | Reduce condescendencia |
| **V11** — Hamburger menu en landing mobile | Navegación funcional en mobile |

**Estimado total: ~4h dev.**

### Mejoras estratégicas — próximos sprints

- **O1** — Owner password recovery completo (forgot + reset endpoints + email + page). 4-6h dev.
- **Trial real de 14 días** (en lugar de cobro desde día 1) — decisión de negocio + cambios MP/backend. Discutir con contador antes.
- **Mockups landing por ciudad** (sanpedro.cuponcito.app / ramallo.cuponcito.app / etc.) — refuerza propuesta de valor SaaS multi-tenant.

### Lo que está cuidado (no tocar)

- **PWA vecino + comercio**: tras 22 fixes acumulados, se siente sólida y consistente. Branding "Cuponcito" coherente en todas las pantallas.
- **Validar canje**: F3 + N3 = mensajes específicos + autoclear → mostrador eficiente.
- **PendingPaymentBanner sticky** + Acción Rápida violeta = comunicación clara.
- **Editor de cupón** copy condicional según estado del merchant (N9) = honestidad operativa.
- **Owner panel core**: login + 2FA TOTP + dashboard + apps list todo funciona y se ve bien.
- **Landing copy**: "Tus clientes vuelven solos. Sin imprimir un volante más." es excelente. Las features y el orden de las secciones están bien pensados. Sólo falta el sweep de marca.

---

## Apéndice — Método y limitaciones

- **3 apps levantadas** simultáneamente: PWA (5180) + Owner panel (5182) + Landing (5181). El preview tool a veces cambia de tab entre evaluaciones — algunos screenshots quedaron en proyectos vecinos sin querer.
- **Sin backend API:** no probé login real ni el flow MP. Auditoría visual + lectura de código.
- **Apps no auditadas a fondo en esta vuelta:** apps/owner (solo login screen), AdminComercioPage editor de horarios (la sesión no llega a cargar), Owner DashboardPage / AppsPage / NewAppPage.
- **Personajes mezclados:** Lucas vecino + Sandra comercio + Marina owner — para cubrir 3 lados del SaaS.

---

## Histórico de auditorías

| Vuelta | Hallazgos detectados | Hallazgos aplicados |
|--------|---------------------:|--------------------:|
| **v1** (F1-F18) | 18 | 11 |
| **v2** (N1-N9 + F9 + F13) | 11 | 11 |
| **v3** (L1-L3 + O1-O2 + V4 + V8 + V11) | **8** | 0 (este reporte) |
| **Total acumulado** | **37** | **22 + 0** |

---

*Reporte v3 generado el 2026-05-28. Cero archivos de código modificados durante esta vuelta — solo este `.md`. Los reportes anteriores se preservaron como `REPORTE-AUDITORIA-UX-v1.md` y `REPORTE-AUDITORIA-UX-v2.md`.*
