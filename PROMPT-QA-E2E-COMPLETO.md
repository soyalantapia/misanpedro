# Prompt — QA E2E completo (vecino + comercio) · Mi San Pedro

> Pegá todo lo de abajo como prompt en una sesión de Claude Code parada en `~/dev/misanpedro`.
> Cubre **las dos puntas** (app del vecino + panel del comercio) y el **loop completo del cupón**:
> crear → verlo → activarlo → validarlo → canjearlo. Objetivo: probar ABSOLUTAMENTE TODO
> (funcional, QA manual, visual/color, usabilidad) y documentar cada bug para production-readiness.

---

## Rol y objetivo
Sos un QA senior + diseñador UX/UI. Probá **todo el sistema de punta a punta**: cada pantalla y cada flujo del **vecino** y del **comercio**, el **ciclo de vida completo del cupón**, lo visual (¿se ve bien? ¿falta cambiar algún color? ¿está todo en orden?) y lo funcional (¿anda? ¿hay bugs?). **Encontrá y documentá TODO** error/inconsistencia y dictaminá si está **listo para producción**.

**No arregles nada.** Reproducí, sacá evidencia y documentá. No commitees, no deployes, no toques `main` ni la DB de prod.

## Contexto del producto
- **Mi San Pedro** = el **club de ahorro de San Pedro**. El vecino usa una **PWA gratis** (ve cupones, activa uno, le sale un código de 6 dígitos/QR, lo muestra en la caja y paga menos). El **comercio** usa un **panel** para cargar cupones y validar canjes.
- **Una sola app (`apps/web`)** contiene las dos caras: el vecino y el panel `/admin`. React 19 · Vite 7 · TS · Tailwind 4 · HashRouter, base `/misanpedro/`. Tenant `sanpedro`.
- **Backend** `apps/api` (Hono + MongoDB). Levantar todo: `pnpm dev` (web + api) o `pnpm dev:web` + `pnpm dev:api`. Online (deploy manual): https://soyalantapia.github.io/misanpedro/
- **Modelo de negocio (verificá el copy):** el comercio tiene **3 meses gratis sin tarjeta**, después **$50.000/mes**; nace `estado:'activo'`; Mercado Pago quedó **bypasseado en el alta**. Cabos sueltos conocidos a chequear: el paso fiscal del signup pide CUIT aunque diga "Opcional"; copy "factura C de la suscripción mensual" stale.

### Reglas DURAS de marca / design system
- **Naranja `#ea580c` = marca** (acción/nav/CTAs). **Verde `#059669` = SOLO ahorro** ("Ahorrás ~$X"). Single-knob: tokens semánticos (`--color-brand`, `fin-*`), **sin hex sueltos**. Tema **LIGHT**.
- Narrativa LOCKED: "El club de ahorro de San Pedro" · "Tu plata rinde más" · **"tu ciudad", nunca "pueblo"** · **nunca "fundador"** ("comercios"/"comercio adherido"). Imagen digna.
- **Mobile-first**: primario **390×844**; revisar **360 / 768 / 1280**.

## Dos roles — cómo loguear cada uno
- **Vecino:** OTP por email (en `/datos` al primer canje, o el flujo de login del vecino).
- **Comercio:** OTP por email en `/admin/login` (email → código de 6 dígitos).
- **CLAVE para testear:** en **desarrollo el backend devuelve el código OTP en la respuesta** → podés loguear ambos roles sin email real. Aprovechalo para correr el loop E2E con 2 sesiones/navegadores (uno vecino, uno comercio).

---

## 🔁 EL FLUJO ESTRELLA — ciclo de vida del cupón (probar de punta a punta)
Este es el corazón del producto. Corré el loop completo y verificá la **consistencia en ambos lados** en cada paso:

1. **Comercio crea un cupón** — `/admin/cupones/nuevo`:
   - **Tipo de oferta**: `porcentaje` · `dos_por_uno` (2x1) · `precio_fijo` · `happy_hour` — probá los 4.
   - Campos: título, **% de descuento**, **precio de referencia**, condiciones, **días que aplica + franja horaria**, **vigencia (hasta)**, **imagen** (base64/URL, opcional), **objetivo** ("Traer clientes nuevos" / "Llenar días y horas flojas" / "Vaciar stock" / "Fidelizar").
   - Verificá el **preview de ahorro** (vecino paga $X / ahorra $Y = precio × %). Validá: % fuera de rango, vigencia en el pasado, días vacíos, título vacío, imagen pesada.
2. **El cupón aparece en el catálogo del vecino** — home `/`, `/locales`, detalle `/cupon/:id`, detalle de comercio `/comercio/:slug`:
   - ¿Se ve **igual a lo cargado**? (% , título, vigencia, "Ahorrás ~$X" en verde, condiciones, días/franja). ¿La imagen o el placeholder por categoría se ven bien?
3. **El vecino activa el cupón** → si es primer uso pasa por **registro `/datos`** → genera **código de 6 dígitos + QR** (`/activacion/:id`):
   - Verificá el código, el QR, la **vigencia/expiración** del código, y qué pasa si recargás o volvés.
4. **El comercio valida** — `/admin/validar`:
   - Dos modos: **Escanear QR** (cámara) y **Código manual** (6 dígitos). Probá: código válido, inválido, **expirado**, **ya canjeado**, de otro comercio.
5. **El comercio confirma el canje** — `/admin/canje/:activationId`:
   - **Monto del ticket OBLIGATORIO** (sin descuento). Validá: **sin monto** (error "Falta el monto"), monto 0/negativo, monto **> $10.000.000** (error de plausibilidad), monto OK → "Canje confirmado".
6. **Post-canje — verificá que se refleje en AMBOS lados**:
   - **Vecino**: aparece en **Canjeados**, suma el **ahorro** en la billetera, y mueve **El Club** (nivel del mes / entradas al sorteo / racha).
   - **Comercio**: aparece en **Clientes** y en **Estadísticas** (canje + ingreso + ahorro otorgado).
   - ¿Los números **coinciden** entre lo que ve el vecino y lo que ve el comercio?

---

## Alcance — VECINO (todas las pantallas)
Home/Cupones (`/`), Locales (`/locales`), Mapa (`/mapa` — lista + tap-to-fly + popups), detalle de cupón y de comercio, **activación → código/QR** (`/activacion/:id`), Alertas (`/alertas`), **Perfil** (billetera + **El Club**: niveles/entradas/racha + datos + privacidad/eliminar), Registro (`/datos`), Canjeados, Plan (`/plan`), nav (FAB "Cupones"), 404, selector de ciudad, offline, install PWA. Estados: 0/1/muchos, textos largos, **datos "QA Test" que no deberían verse en prod**.

## Alcance — COMERCIO / panel `/admin` (todas las pantallas)
- **`/admin/registro`** — alta: 3 meses gratis sin tarjeta. Chequeá el **paso fiscal** (¿exige CUIT pese a "Opcional"?) y el copy de facturación.
- **`/admin/login`** — OTP (6 dígitos; en dev el código viene en la respuesta).
- **`/admin`** — dashboard: métricas, **estado del comercio** (`pending_payment`/`activo`/free trial) y el **PendingPaymentBanner** sticky.
- **`/admin/cupones`** — listado + **crear/editar** (`/admin/cupones/nuevo`, `/admin/cupones/:id/editar`): los 4 tipos de oferta, días/franja, objetivo, preview de ahorro, imagen base64, pausar/activar/borrar.
- **`/admin/validar`** + **`/admin/canje/:id`** — el flujo de validación y canje (ver flujo estrella).
- **`/admin/clientes`** + detalle (`/admin/clientes/:userId`).
- **`/admin/estadisticas`** — stats por período + "asesor".
- **`/admin/whatsapp`** — estado/campañas.
- **`/admin/referidos`** — comercio→comercio (+1 semana por referido, tope 8).
- **`/admin/comercio`** — **ficha / micro-sitio editable**: tagline, descripción, servicios, redes, logo, horarios/"abierto ahora", **galería (base64, máx 4)**, **productos (máx 20)**, **preview en vivo**. Probá límites y persistencia.

## Los 3 ángulos (auditá CADA pantalla, en vecino Y en comercio)
**A) Visual / UI / color** — naranja=marca, verde=solo ahorro, sin hex sueltos; **¿el panel del comercio respeta el mismo design system light+naranja que el vecino?** (buscar restos de violeta/paleta vieja); contraste WCAG AA (naranja sobre blanco en texto chico ≈3.6:1 < AA); consistencia (espaciados/estados hover-focus-disabled); responsive 360/390/768/1280; imágenes rotas; truncado/overflow.

**B) Funcional / bugs** — cada acción hace lo que dice; **formularios** (cupón: %, vigencia, días, imagen; canje: monto; signup: CUIT/fiscal); estados loading/error/empty sin pantallas blancas ni "undefined/NaN/Invalid Date"; **cálculos** (ahorro, vecino paga, stats, niveles del Club, entradas, racha, distancias); edge cases (0/1/muchos, textos largos, montos grandes); persistencia; **consola + red** (401/403/404/500, CORS, duplicados); refresh/deep-link/back; permisos (cámara para QR, geo, push); seguridad básica (¿el vecino puede entrar a `/admin`? ¿un comercio valida cupones de otro?).

**C) Usabilidad / producción** — ¿el **comercio** entiende cómo **crear** y **validar** sin ayuda? ¿el **vecino** completa **descubrir→activar→canjear** sin fricción? dead-ends, copy (typos, narrativa LOCKED, sin "pueblo"/"fundador"), affordances + feedback (toasts), a11y (aria, foco, teclado, touch ≥44px), performance percibida; **cero placeholders/QA-Test/TODO/console.error/links rotos/secretos**.

## Método
1. Levantá `pnpm dev` (web + api). Abrí **dos contextos**: uno como **vecino**, otro como **comercio** (login OTP con el código que devuelve el backend en dev).
2. Recorré **pantalla por pantalla** (vecino y admin) y **corré el loop E2E completo** (crear→ver→activar→validar→canjear→verificar ambos lados).
3. En cada pantalla: screenshot **mobile + desktop**, los 3 ángulos, **consola + red** abiertas.
4. Probá happy paths **y** error/edge (sin monto, código expirado, % inválido, sin permisos, API caída).
5. Anotá **todo** con evidencia. (Opcional: skills gstack `/qa`, `/design-review`, `/cso`.)

## Salida — `REPORTE-QA-E2E-COMPLETO.md`
Encabezado: fecha, commit, alcance cubierto (vecino + comercio + E2E) y qué quedó "No verificado", **tabla resumen por severidad**, y **veredicto "¿LISTO PARA PRODUCCIÓN? Sí/No + bloqueantes"**.

Cada hallazgo:

    ### [F-001] Título corto
    - Severidad: 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🔵 Bajo
    - Rol: Vecino | Comercio | E2E
    - Categoría: Visual/Color · Funcional/Bug · UX · Accesibilidad · Copy · Seguridad · Performance · Producción
    - Pantalla / Ruta / Componente (archivo si lo ubicás)
    - Pasos para reproducir
    - Esperado vs Actual
    - Evidencia (screenshot / consola / request)
    - Fix sugerido + esfuerzo (S/M/L)
    - Estado: Abierto

Severidad: 🔴 bloquea prod (rompe el loop del cupón / crash / pérdida o inconsistencia de datos / dato de prueba o secreto expuesto / acceso indebido entre roles / contraste ilegible) · 🟠 bug grave con workaround · 🟡 inconsistencia/UX/a11y media · 🔵 cosmético. Cerrá con **bloqueantes priorizados + veredicto**.

## Reglas
- No arregles / commitees / deployees. Solo auditar + documentar.
- No inventes: reproducí cada hallazgo; lo que no puedas probar marcalo "No verificado" y por qué.
- En **dev** podés crear cupones / canjes / altas de prueba (la DB de dev es descartable). **Nunca** contra la DB de prod.
- Documentá TODO, pero **priorizá por severidad**.
