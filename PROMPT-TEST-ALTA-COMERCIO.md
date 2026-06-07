# Prompt — Test PRECISO del ALTA DE COMERCIO mínima (sin fiscal)

> Pegá esto como prompt en una sesión de Claude Code parada en `~/dev/misanpedro`,
> rama `feat/alta-comercio-minima` (commit base `815c5b9`).
> Probá AL DETALLE el alta de comercio rediseñada: alta corta sin datos fiscales,
> que crea un comercio **activo y visible**, y que **empuja (sin obligar)** a completar
> el perfil. Documentá cada hallazgo (esperado vs actual) y cerrá con veredicto.
> No arregles nada salvo que se pida; no toques `main`.

---

## Qué se cambió (lo que hay que testear)
El alta del comercio pasó de **Datos → Fiscal → Pago → Listo** a **Datos → Listo**:
- **Se eliminó el paso Fiscal** (CUIT, razón social, condición fiscal, domicilio fiscal). No se pide NADA fiscal en el alta.
- **Se eliminó el paso "Pago"** (no se cobra). El plan "3 meses gratis · sin tarjeta" + el T&C quedaron en el paso **Datos**. Botón final: **"Crear mi comercio gratis"**.
- Se sacó el copy stale: *"factura C de la suscripción mensual"*.
- **Listo = empujón, no muro:** CTAs a **"Completá tu perfil (foto + horarios)"** (`/admin/comercio`) y **"Creá tu primer descuento"** (`/admin/cupones/nuevo`), + "Después lo hago — ir al panel" (`/admin`).
- Dashboard: la tarjeta de onboarding prioriza **completar el perfil**.
- Backend: `/merchant/auth/signup` **no requiere** fiscal (schema y modelo ya lo tenían opcional). El comercio nace `estado:'activo'`.

Archivos tocados: `apps/web/src/pages/admin/AdminSignupPage.tsx`, `apps/web/src/pages/admin/AdminDashboardPage.tsx`, `apps/api/src/routes/merchant-auth.ts`.

## Contexto técnico
- `apps/web` (panel comercio en `/admin`, design system **LIGHT** + primitivas ui; marca **naranja** `#ea580c`) · `apps/api` (Hono + Mongo, multi-tenant header **`X-Tenant-Slug: sanpedro`**).
- Correr: `pnpm dev:web` + `pnpm dev:api`. Puertos según consola (canónico web :5180 / api :3001; en este setup web :5191 / api :3002).
- **Auth comercio = OTP** (email → código; en dev el backend devuelve `_debugCode`). **NO tocar** ese login.
- Endpoint alta: `POST /api/v1/merchant/auth/signup`. **Rate-limit: 3 altas/hora por cliente** → espaciá o usá emails únicos; si lo pegás, esperá.
- Payload del alta (shape actual):
  ```json
  { "comercio": { "nombre":"…", "categoria":"gastronomia", "categoriaOtro?":"…",
                  "direccion":"…", "lat":-33.68, "lng":-59.66, "telefono":"…", "horarios?":"" },
    "admin": { "nombre":"…", "email":"…" }, "ref?":"CODE", "acceptedTc": true }
  ```

---

## 0) Automáticos
```bash
pnpm typecheck                                    # 6/6
pnpm --filter @misanpedro/web exec vitest run      # web verde
pnpm --filter @misanpedro/api exec vitest run      # api verde
```

## 1) 🎯 El alta, de punta a punta (UI, como comercio)
En `/#/admin/registro`:
1. **No hay nada fiscal en ningún lado:** ni CUIT, ni razón social, ni condición fiscal, ni domicilio fiscal. El **Stepper** dice **"1 Datos · 2 Listo"** (NO "Fiscal", NO "Pago").
2. **Copy honesto:** no aparece "factura C", ni un paso/título "Pago". El plan dice "3 meses gratis · sin tarjeta / sin MercadoPago".
3. **Completar el alta:** nombre, categoría, dirección, **marcar ubicación en el mapa**, teléfono, nombre + email del responsable, **tildar T&C** → el botón **"Crear mi comercio gratis"** se habilita (sin T&C está deshabilitado) → click.
4. **Cae en "Listo"** con: "¡{nombre} ya está dentro!" + **CTA perfil** (→ `/admin/comercio`) + **CTA primer descuento** (→ `/admin/cupones/nuevo`) + **"Después lo hago — ir al panel"** (→ `/admin`). Probá los 3 destinos: que naveguen bien y que **NO sea un muro** (se puede ir al panel directo).
5. **El comercio quedó logueado** tras el alta (sesión activa): `/admin`, `/admin/comercio`, `/admin/cupones/nuevo` abren sin volver a loguear.

## 2) Backend del alta (curl, camino real)
- ✅ **Alta SIN fiscal** → `ok:true`, `merchant.estado === 'activo'`, `slug` generado:
  ```bash
  curl -s -H "Content-Type: application/json" -H "X-Tenant-Slug: sanpedro" -X POST \
    "$API/merchant/auth/signup" -d '{"comercio":{"nombre":"Test NoFiscal","categoria":"gastronomia","direccion":"Mitre 1247","lat":-33.68,"lng":-59.66,"telefono":"3329400000"},"admin":{"nombre":"Owner Uno","email":"t1@x.test"},"acceptedTc":true}'
  ```
- ✅ **Alta con fiscal de más** (cuit/razonSocial/…): debe seguir aceptando (campos opcionales; no rompe).
- ✅ **Validaciones (400):** falta `nombre`/`categoria`/`direccion`/`telefono`/`admin.nombre`/`admin.email`, o `acceptedTc:false`.
- ✅ **Email duplicado → 409** (`email ya registrado`).
- ✅ **El comercio nuevo es VISIBLE para el vecino:** crea un cupón con su token y verificá que aparece en `GET /coupons` (tenant sanpedro). (Si no tiene cupón, confirmá al menos que el merchant existe/activo.)
- ✅ **Rate-limit:** la 4ª alta en una hora → 429 (no rompas el test por esto; anotalo).

## 3) Frontend — detalle
- **Persistencia del draft:** cargá datos a medias, **recargá** (F5) → se restauran (menos el T&C, que pide tildar de nuevo). El botón **"Empezar de cero"** limpia el draft.
- **Gating del T&C:** sin tildar, el botón está deshabilitado y no se puede crear.
- **Referido:** `/#/admin/registro?ref=ALGO` muestra el banner "Te invitó un comercio". (No hace falta validar el motor de referidos a fondo.)
- **Categoría "otro":** aparece el campo "¿Qué tipo de comercio?" y es obligatorio.
- **Dashboard (post-alta):** en `/admin`, la tarjeta de onboarding ("Empezá a recibir tus primeros canjes") tiene como primer paso **"Completá tu perfil (foto + horarios)"**, y las acciones priorizan **perfil + primer descuento** (NO datos fiscales).

## 4) Regresión — NO se debe haber roto
- 🔒 **Login OTP del comercio** intacto: `/#/admin/login` → email → código (`_debugCode` en dev) → entra al panel.
- 🔒 **Crear/editar cupón** funciona (el asesor de cupones del panel).
- 🔒 **Validar + confirmar canje** sigue andando.
- 🔒 **App del vecino** sin cambios (este cambio es solo del panel comercio).
- 🔒 **Owner** sin cambios.

## 5) Visual / UX / a11y
- Design system **LIGHT** + naranja, mobile-first (390) y desktop. Sin restos de violeta raro, sin campos fantasma.
- El paso "Listo" se ve como un **empujón amable** (no como un trámite pendiente).
- a11y: el Stepper es `progressbar` con `aria-valuenow`; inputs con label; foco visible; botón disabled comunica el motivo (T&C).

## Método
- `pnpm dev:web` + `pnpm dev:api`. Navegá el alta con browser (gstack `browse`) y/o device + **consola y red abiertas**. Hacé el happy path **y** los errores (sin T&C, email inválido, email repetido, sin ubicación). Screenshots mobile + desktop. Para el backend, curl directo.

## Salida — `REPORTE-TEST-ALTA-COMERCIO.md`
Tabla resumen por severidad + **veredicto "¿LISTO? Sí/No + bloqueantes"**. Cada hallazgo:

    ### [A-01] Título
    - Severidad: 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🔵 Bajo
    - Área: Alta UI · Backend signup · Dashboard · Regresión · Visual/a11y
    - Pasos para reproducir
    - Esperado vs Actual
    - Evidencia (screenshot / request / consola)
    - Fix sugerido + esfuerzo (S/M/L)

Severidad: 🔴 bloquea (el alta pide algo fiscal / no se puede completar / no crea comercio activo / rompió login OTP o cupones / crash) · 🟠 bug con workaround · 🟡 UX/copy/a11y · 🔵 cosmético.

## Criterios de aceptación (deben dar ✅)
- El alta **NO pide** CUIT, razón social, condición fiscal ni domicilio fiscal.
- Alta corta (**Datos → Listo**), sin copy stale ("Pago", "factura C mensual").
- Se completa **sin ningún dato fiscal** y el comercio queda **activo y visible** para el vecino.
- Al terminar, **empuja (sin obligar)** a completar perfil + crear primer descuento.
- Backend/schema **no rechazan** un alta sin fiscal.
- **Login OTP del comercio y el flujo de cupones siguen intactos.**
- `pnpm typecheck` verde.

## Reglas
- No arreglar / commitear / deployar salvo pedido. No inventar: reproducí o marcá "No verificado".
- En **dev** podés crear comercios de prueba (DB descartable). Ojo rate-limit 3/hora.
