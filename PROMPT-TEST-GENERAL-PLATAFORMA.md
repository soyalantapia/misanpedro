# Prompt — Test GENERAL de toda la plataforma (Mi San Pedro)

> Pegá esto como prompt en una sesión de Claude Code parada en `~/dev/misanpedro`.
> Probá **toda la plataforma** (vecino + comercio + owner + landings + API): funcional,
> visual, E2E, seguridad, accesibilidad y production-readiness. Documentá cada hallazgo
> (esperado vs actual) y cerrá con un veredicto de producción. No arregles nada salvo
> que se pida; no toques `main` ni la DB de prod.

---

## Contexto
**Mi San Pedro** = club de ahorro de la ciudad. Monorepo pnpm/turbo:
- `apps/web` — PWA del **vecino** + panel **comercio** (`/admin`). React 19 · Vite 7 · Tailwind 4 · HashRouter, base `/misanpedro/`.
- `apps/api` — backend Hono · MongoDB Atlas (dev). Multi-tenant por header **`X-Tenant-Slug`** (tenant `sanpedro`).
- `apps/owner` — super-admin del **operador** sobre TODOS los tenants (ciudades/comercios/usuarios/suscripciones).
- `apps/landing` (captación comercios) · `apps/landing-vecino` (landing del vecino).
- `packages/shared` — contrato FE/BE (types + Zod). Single source of truth.

**Marca / reglas DURAS:** naranja `#ea580c` = acción/marca · **verde `#059669` = SOLO ahorro** · tokens single-knob (sin hex sueltos) · tema **LIGHT**. Narrativa LOCKED: "El club de ahorro de San Pedro" · "Tu plata rinde más" · **"tu ciudad", nunca "pueblo"** · **nunca "fundador"**. **Mobile-first 390×844** (+ 360/768/1280).

**Cómo correr:** `pnpm dev` (web + api en paralelo). Owner: `pnpm --filter @misanpedro/owner dev`. Landings idem. Puertos según `launch.json`/consola (en este setup: web **:5191**, api **:3002**; canónicos CLAUDE.md: web 5180/api 3001/owner 5182/landing 5181). Headers API: `X-Tenant-Slug: sanpedro` + `Authorization: Bearer <token>`.

**Auth (dev devuelve el OTP en la respuesta como `_debugCode`):**
- Vecino: `POST /auth/request-otp {email}` → `_debugCode`; `verify-otp`; registro `POST /auth/register` (dni 7-8 díg, email/whatsapp ÚNICOS).
- Comercio: `POST /merchant/auth/request-otp` → `_debugCode`; `verify-otp`. **Signup 3/hora, OTP-request 5/hora** → para repetir, OTP-login a un comercio existente o reusar token.

---

## 0) Automáticos (correr primero, deben estar verdes)
```bash
pnpm typecheck                                   # 6/6 paquetes
pnpm --filter @misanpedro/api exec vitest run     # suite api (incl. límite por persona: unit + integración DB)
pnpm --filter @misanpedro/web exec vitest run     # suite web
pnpm --filter @misanpedro/web exec playwright test # e2e smoke (apps/web/e2e), si está configurado
bash scripts/e2e-limite-uso.sh                    # E2E límite de uso por persona (10 checks)
```
Anotá totales y cualquier rojo.

## 1) 🔁 EL LOOP ESTRELLA (E2E del cupón — corazón del producto)
Con 2 sesiones (comercio + vecino), de punta a punta, verificando **consistencia en ambos lados**:
1. **Comercio crea cupón** (`/admin/cupones/nuevo`): tipo (`%`/2x1/precio fijo/happy hour), título, %, precio ref, condiciones, días/franja, vigencia, imagen, objetivo, **y el "¿cada cuánto puede usarlo cada persona?"**. Verificar el preview de ahorro.
2. **Aparece en el catálogo del vecino** (`/`, `/locales`, `/cupon/:id`, `/comercio/:slug`) igual a lo cargado.
3. **Vecino activa** → registro `/datos` (1er uso) → **código 6 díg + QR** (`/activacion/:id`).
4. **Comercio valida** (`/admin/validar`, QR o código) → ok / inválido / expirado / ya canjeado / de otro comercio.
5. **Comercio confirma** (`/admin/canje/:id`) con **monto obligatorio** (>0, tope $10M).
6. **Post-canje:** vecino → Canjeados + billetera + **El Club** (nivel/entradas/racha); comercio → Clientes + Estadísticas. **¿Los números coinciden?**
7. **Límite por persona:** el 2º intento del mismo cupón se bloquea según la ventana elegida (ver `PROMPT-TEST-LIMITE-USO.md` para el detalle preciso).

## 2) VECINO — todas las pantallas
Home/Cupones (`/`) · Locales (`/locales`) · Mapa (`/mapa`: lista + tap-to-fly + popups) · detalle cupón/comercio · activación/código (`/activacion/:id`) · **Alertas** (`/alertas`: crear/editar/pausar/borrar, push toggle, feed) · **Perfil** (`/perfil`: billetera + **El Club** niveles + datos + privacidad/eliminar) · Registro (`/datos`) · Canjeados · **Plan** (`/plan` "Armá tu plan") · nav (FAB Cupones) · 404 · selector de ciudad · offline · install PWA. Estados: 0/1/muchos, textos largos.

## 3) COMERCIO `/admin` — todas las pantallas
`/registro` (alta 3 meses gratis; ojo paso fiscal CUIT) · `/login` (OTP) · `/` dashboard (estado pending_payment/activo/trial + banner) · `/cupones` + crear/editar (tipos, días/franja, objetivo, preview, imagen, **límite por persona**, pausar/activar/borrar) · `/validar` + `/canje` · `/clientes` (+detalle) · `/estadisticas` · `/whatsapp` · `/referidos` (+1 sem, tope 8) · `/comercio` (micro-sitio: tagline/desc/servicios/redes/logo/horarios/galería máx4/productos máx20/preview).

## 4) OWNER `/owner` — super-admin del operador
Login · dashboard (métricas globales, recharts) · ciudades/tenants · comercios (estados, suscripciones, freeTrial) · usuarios/vecinos · cualquier acción de gestión. Verificar que ve **todos los tenants** y que los datos cuadran con lo creado en web/admin.

## 5) LANDINGS
`apps/landing` (captación comercios: pricing 3-meses-gratis/$50k, CTA a `/admin/registro`) y `apps/landing-vecino`. Visual + responsive + links + copy (narrativa LOCKED) + que los CTAs lleven bien.

## 6) Transversal (aplica a todo)
- **Seguridad/auth:** OTP (rate-limits 3/5/hora), refresh + detección de reuso, **cross-merchant** (un comercio no valida cupón de otro), **cross-rol** (¿un vecino entra a `/admin` o `/owner`?), **multi-tenant** (no se filtran datos entre ciudades), CORS (origin del front en el allowlist), nada de secretos en el front.
- **Visual/diseño:** naranja=marca, verde=solo ahorro, sin hex sueltos; **¿admin y owner respetan el mismo light+naranja?** (restos de violeta); **contraste WCAG AA** (naranja sobre blanco chico ≈3.6:1 < AA); consistencia (espaciados/estados hover-focus-disabled); responsive 360/390/768/1280.
- **Accesibilidad:** aria-labels, foco visible, teclado, touch ≥44px, headings, alt en imágenes.
- **Performance/PWA:** carga inicial + lazy chunks + skeletons; offline; install; push (limitaciones); service worker.
- **Production-readiness:** ⚠️ **datos de prueba "QA Test" en el catálogo** (bloqueante de lanzamiento, F-001) · cero `console.error`/401 deslogueado · **theme-color** del navegador en naranja (no violeta) · imágenes rotas de comercio · cero TODO/placeholder/links rotos.

## 7) Los 3 ángulos (en CADA pantalla, de los 3 roles)
**A) Visual/UI/color** · **B) Funcional/bugs** (estados loading/error/empty sin "undefined/NaN/Invalid Date", formularios, cálculos: ahorro/stats/Club/% off/distancias) · **C) UX/usabilidad** (¿se entiende sin ayuda? fricción, copy, dead-ends).

## Método
1. `pnpm dev` (+ owner + landings). Abrí **3 contextos**: vecino, comercio, owner (OTP con `_debugCode` de dev). Navegá con browser headless (gstack `browse`) y/o device.
2. Recorré pantalla por pantalla (los 3 roles) + corré el **loop E2E** + el **límite por persona**.
3. Screenshot **mobile + desktop**, **consola + red** abiertas, happy paths **y** error/edge (sin monto, código expirado, % inválido, sin permisos geo/push, API caída).
4. Anotá **todo** con evidencia.

## Reusar lo que ya hay
- Prompts específicos: `PROMPT-TEST-LIMITE-USO.md` (límite por persona) · `PROMPT-QA-E2E-COMPLETO.md` (vecino+comercio) · `PROMPT-AUDITORIA-UX-QA.md` (visual vecino).
- Scripts: `scripts/e2e-limite-uso.sh`. Reportes previos: `REPORTE-*.md`.
- **Regresión de fixes ya hechos** (que no vuelvan): theme-color naranja, 404 sin violeta, sin 401 deslogueado, detalle de comercio compacto, doble-confirm → 409 limpio.
- **Conocidos a confirmar:** F-001 (data de prueba) sigue siendo el bloqueante #1 de lanzamiento; **stock global = feature muerta** (`stockMaximo` no settable por API ni enforced) — fuera de scope.

## Salida — `REPORTE-TEST-GENERAL.md`
Encabezado: fecha, commit, alcance cubierto (web vecino/comercio + owner + landings + api) y qué quedó "No verificado"; **tabla resumen por severidad**; **veredicto "¿LISTO PARA PRODUCCIÓN? Sí/No + bloqueantes"**.

Cada hallazgo:

    ### [F-001] Título corto
    - Severidad: 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🔵 Bajo
    - App/Rol: Vecino · Comercio · Owner · Landing · API
    - Categoría: Visual/Color · Funcional/Bug · UX · Accesibilidad · Seguridad · Copy · Performance · Producción
    - Pantalla / Ruta / Componente (archivo si lo ubicás)
    - Pasos para reproducir
    - Esperado vs Actual
    - Evidencia (screenshot / consola / request)
    - Fix sugerido + esfuerzo (S/M/L)
    - Estado: Abierto

Severidad: 🔴 bloquea prod (rompe el loop del cupón / crash / inconsistencia o pérdida de datos / dato de prueba o secreto expuesto / acceso indebido entre roles o tenants / contraste ilegible) · 🟠 bug grave con workaround · 🟡 inconsistencia/UX/a11y media · 🔵 cosmético. Cerrá con **bloqueantes priorizados + veredicto**.

## Reglas
- No arreglar / commitear / deployar (salvo pedido). No inventar: reproducí o marcá "No verificado" y por qué.
- En **dev** podés crear cupones/canjes/altas de prueba (DB descartable). **Nunca** contra prod.
- Documentá TODO pero **priorizá por severidad**.
