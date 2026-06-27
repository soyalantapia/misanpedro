# 01 · Pendientes (qué falta, en orden)

> ## ✅ Tanda lanzamiento 2026-06-26/27 — SHIPPED a prod
> La semana del lanzamiento. Todo en `main`, deployado y **verificado e2e/empíricamente en prod**.
> **typecheck 6/6 · check:tenant ✓ · 128 tests verdes · build OK.**
>
> - **Owner expandido (Fases 1-4)** — auth OTP passwordless · multi-admin con **RBAC**
>   (super/admin/finanzas/soporte/viewer) + sección Equipo · **auditoría** `OwnerAuditLog` ·
>   estadísticas en vivo + snapshot diario de MRR. Commits `df9f302`/`c53cbf5`/`23a7696`/`d928b2e`/`a6d373f`.
> - **Emails OTP rediseñados** (`b7f81fb`) — template único lindo/branded, logo + código copiable +
>   **login de un toque** (magic-link). Seteado `OWNER_APP_URL` en Railway.
> - **Onboarding del comercio** (`42472ca` + `1353188`) — login con email sin comercio → al alta
>   con flujo precargado. Bug-hunt: 18→2 bugs fixeados (email con espacios + draft multi-pestaña).
> - **Camino del dinero (canje)** (`664e2f1` + `4aa9606` + `cc47fb7`) — 13 tests de integración +
>   fix de consistencia del ahorro `precio_fijo` (preview cajero == backend) + cierre compensado.
> - **Aislamiento multi-tenant** (`51e4402`) — 5 tests de integración + auditoría 207 queries → 0 leaks.
> - **Hardening pre-launch** (`5c9cee2`) — 5 fixes del barrido final (regex escape, OTP atómico,
>   franja desde<hasta, tope 5MB imágenes, claim atómico referido). 0 blockers.
> - **Modo soporte** (`a9a68fb` + `5fb94f6` + `d56a2ec`) — impersonación owner→comercio con
>   auditoría de cada mutación + banner siempre visible. 2 bug-hunts: 2 bugs reales fixeados
>   (owner deshabilitado + banner del canje), auditoría-en-mutación verificada e2e en prod. Ver doc 03 §18-20.
>
> **Pasos del usuario que SIGUEN pendientes:** ver sección B abajo (SMTP_PASSWORD, Nariño localidad/geo,
> rotar password owner, MercadoPago Colombia, domicilio fiscal SP). **Nice-to-have del soporte:** botón
> "cerrar sesiones de soporte" en el owner (endpoint `revoke-support` ya existe) + vista de auditoría filtrada.

> ## ✅ Tanda pre-producción 2026-06-23 — SHIPPED a prod
> Commits en `main`: `db06da9` (hardening/owner/web) · `4f011ad` (ci.yml) · `c37d68d` (tests integración). Deployado (`railway up`), CI verde, QA de prod (browse) 0 bugs.
> **typecheck 6/6 · check:tenant ✓ · API 93/93 · web 104/104 · build OK.**
> **Config de infra (Railway, por el asistente):** VAPID seteadas (push operativo) · SMTP verificado (login comercio OK) · geoCenter Nariño = Pasto.
> **Diferidos con TIMING:** manifest PWA por-host = ANTES de onboardear usuarios de la 2da ciudad (no ahora: arriesgaría el instalable de SP que tiene usuarios) · SSOT a shared = cuando el owner tenga tests · token Google vencido → `/oauth-google` para confirmar entrega de email a inbox.
> **Resuelto en código:**
> - **Web Push revivido**: `pushRoutes` se monta en `index.ts` + `initWebPush()` en bootstrap; `PushSubscription` ahora scopea por `{appId,endpoint}` (índice único compuesto + `syncIndexes` dropea el `endpoint_1` viejo). Cierra el agujero cross-tenant de subscribe/unsubscribe.
> - **URLs por-tenant**: helper `apps/api/src/lib/urls.ts` (`tenantFrontUrl`); `back_url` de MP, init_point mock y CTAs de welcome emails ahora salen de `<subdomain>.micuidad.com`. Email de canje tenant-aware (moneda/locale/nombre) y "factura C" condicionada por país.
> - **`stockMaximo`**: validado en activación (409 agotado), claim atómico en canje (`$inc` condicional) + estado `agotado` + compensación en doble-tap; surfaceado en `/validate`.
> - **Owner backend**: rate-limit en `/auth/login`; audit log real (`recentActions` + `GET /me/audit`); acciones `PATCH /merchants/:id` (suspender/reactivar) y `PATCH /subscriptions/:id` (pausar/cancelar/reactivar); paginación en subscriptions; `byCurrency` en metrics.
> - **Owner front**: wizard de alta con **4º paso Legales** (+ `geoCenter` ahora REQUERIDO al crear); MRR multi-moneda; paginación "cargar más" + acciones en Merchants/Users/Subscriptions; audit log en Settings.
> - **Web vecino/comercio**: A.1 login (header con chip + divisor) ✅ · A.2 InstallPrompt rediseñado (pill + modal explicativo, **solo en superficie vecino**, no en `#/admin`) ✅ · A.3 alta del comercio en **3 pasos** (Comercio/Contacto/Cuenta) ✅ · tiers de `SavingsWallet` escalados por moneda ✅.
> - **Hardening**: `mock-confirm` ya gateado por `MP_ACCESS_TOKEN`; `JWT_REFRESH_SECRET` ahora opcional (no se usa); `.env.example` corregido; seed de SP sin datos fiscales hardcodeados; categoría `inmobiliaria` sincronizada en shared.
> - **CI**: `.github/workflows/ci.yml` (install+typecheck+check:tenant+tests api/web en push/PR) + task `test` en turbo + E2E parametrizado por tenant.
>
> **Diferido a propósito (no bloquea prod):** promover schemas owner/billing a `packages/shared` y hacer que las apps extiendan `tsconfig.base.json` (refactors con churn, validación no rota); manifest PWA por-host (forma segura = server-side, no blob runtime); fechas `es-AR` dispersas + copy legal AR inline en pantallas del comercio (cosmético); tests de integración de stock/push (requieren harness Hono+auth completo).
>
> **Sigue siendo paso del usuario:** `SMTP_HOST`+`SMTP_PASSWORD` (o `RESEND_API_KEY`) en Railway — sin esto el login OTP del comercio da 503 en prod; decidir 2FA del owner (quedó **OFF + rate-limit**); cuenta MercadoPago Colombia; rotar password del owner; geoCenter/localidad reales de Nariño; domicilio fiscal de SP.

Tres grupos: **(A) UI a medio hacer**, **(B) pasos manuales del usuario** (no son código),
**(C) backlog** (mejoras y Fase 2). Empezá por A.

---

## A. Ajustes de UI pedidos — EN PROGRESO (4 pedidos del usuario)

El usuario pidió 4 cosas sobre las pantallas del comercio. Estado:

### A.1 — Login: "el formulario queda muy blanco, metele bordes y demás" 🟡 PARCIAL
- Archivo: `apps/web/src/pages/admin/AdminLoginPage.tsx`.
- **Hecho:** fondo de la página tintado (`bg-surface-2`) para que la tarjeta blanca resalte (commit `fdd6b9b`).
- **Falta:** darle más estructura/bordes a la **tarjeta del form**: header con ícono (ej. `KeyRound` en un chip `bg-brand-soft`), un divisor (`border-t border-line`) bajo el header, borde más definido. Objetivo: que no sea una caja blanca plana.

### A.2 — Install prompt: rediseñarlo ❌ NO EMPEZADO
- Componente: `apps/web/src/components/InstallPrompt.tsx` (toast global "Instalá Mi Ciudad").
- Pedido: **NO** mostrarlo como toast flotante como hoy. Ponerlo como **algo discreto a un costado / en una barra**, y que al tocar "instalar" aparezca un **popup/modal** que **explique para qué sirve y cómo se usa** (instalar la PWA en el celu).
- Sugerencia: un botón/pill chico fijo (ej. esquina) → al click, modal con: qué es la app instalada, beneficios, y los pasos según navegador (Chrome Android: menú → "Agregar a pantalla de inicio"; iOS Safari: compartir → "Agregar a inicio"). Usar el evento `beforeinstallprompt` si está disponible para el install directo, y el modal explicativo como fallback/ayuda.
- Ojo: hoy el InstallPrompt aparece también en login/registro del comercio (PWA del vecino). Revisar en qué superficies conviene mostrarlo.

### A.3 — Registro del comercio: "hacelo en 3" (pasos) ❌ NO EMPEZADO
- Archivo: `apps/web/src/pages/admin/AdminSignupPage.tsx`. Hoy es **1 paso** de datos (`'datos'`) + `'listo'`. El `Stepper` ya existe pero con 2 ítems.
- Pedido: dividir el alta en **3 pasos**. Propuesta de corte:
  1. **Comercio** — nombre, categoría, dirección + mapa (`LocationPicker`).
  2. **Contacto** — teléfono (placeholder por país ya está), horarios.
  3. **Tu cuenta** — nombre del responsable, email, T&C + botón "Crear mi comercio".
  (+ paso final `'listo'`.) Mantener la persistencia del draft (localStorage) y validar por paso (`validateDatos` se parte en `validateStep(1|2|3)`). Actualizar el `Stepper` a 3 ítems.

### A.4 — Mockup del vecino: "parece de tablet" → más angosto ✅ HECHO
- `apps/web/src/components/VecinoAppMockup.tsx`: `max-w-[320px]` → `max-w-[260px]` (commit `fdd6b9b`). El mockup aparece SOLO en el banner del registro.

> **Estado de deploy:** A.1 (fondo) y A.4 (mockup) están commiteados/deployados (`fdd6b9b`).
> A.1 (bordes del form), A.2 y A.3 quedan por hacer. Verificar siempre con **hard refresh**
> (la PWA tiene service worker que cachea; ver doc 02 "Gotchas").

---

## B. Pasos manuales del usuario (NO son código — los hace él)

> El asistente **no** puede: tocar la DB de prod (es interna), ingresar contraseñas/secretos,
> ni operar las cuentas (Railway/Cloudflare/Hostinger) para meter secretos. Esto es del usuario.

1. **`SMTP_PASSWORD` en Railway** (servicio `api` → Variables) = contraseña del buzón
   `soporte@micuidad.com`. **Sin esto el login por OTP del comercio NO funciona** (en prod
   `/request-otp` devuelve 503). Las otras 5 SMTP_* ya están seteadas (host/port/secure/user/EMAIL_FROM).
   > ⚠️ La password del buzón se pegó en el chat en sesiones previas → conviene **rotarla** en
   > Hostinger y poner la nueva en Railway.
2. **Nariño: Localidad + posición del mapa.** En `administracion.micuidad.com → Mi Nariño →
   Editar`: poner **Localidad = `Nariño`** (hoy dice "Pasto") y **Centro del mapa = lat
   `1.2136` / lng `-77.2811`** (Pasto). Hoy Nariño tiene esos dos datos con valores viejos
   (localidad "Pasto", geoCenter = coords de San Pedro).
3. **Rotar la contraseña del owner** (`alannaimtapia@gmail.com`) — es débil y se eligió 2FA
   OFF (`OWNER_2FA_REQUIRED=false`) por decisión del usuario.
4. **MercadoPago Colombia** para que los comercios de Nariño puedan pagar (la cuenta MP de AR
   no cobra en CO). Hoy el billing es 1 cuenta MP global (= la de San Pedro). Ver doc 03 + `ESTRATEGIA-PAGOS.md`.
5. **Domicilio fiscal real de San Pedro** (para las legales): cargarlo en el owner (campo legal),
   hoy queda vacío y la página lo omite.

---

## C. Backlog (mejoras / "mayores" de la auditoría / Fase 2)

De `AUDITORIA-LANZAMIENTO-MICUIDAD.md` (mayores no tocados) + estrategia:

- **`back_url` de MercadoPago y CTAs de email son globales** (usan `APP_URL_FRONT`), no
  por-tenant → un comercio de Nariño post-pago/CTA cae a la PWA "principal". Construir la URL
  desde `tenant.subdomain` (`https://<sub>.micuidad.com/...`). (Audit M9/M10.)
- **`stockMaximo` del cupón no se valida** al activar/canjear (no bloquea ni marca "agotado").
  Ver `activations.ts` / `redemptions.ts`. (Audit M5.)
- **Tiers de `SavingsWallet`** hardcodeados en magnitudes ARS → en COP un vecino sube de nivel
  con ~USD 12. Parametrizar por moneda/tenant. (Audit M11.)
- **`geoCenter` por defecto = San Pedro** en el modelo/route → una ciudad sin geoCenter cae a
  SP. Idealmente: quitar el default, backfillear SP explícito, fallback neutro. (Audit M1; mitigado porque ahora se setea por ciudad en el owner.)
- Restos varios: fechas `es-AR` fijas en algunos lugares del panel, copy legal AR inline fuera de
  `/legal`, etc. (ver el reporte de auditoría).
- **Fase 2 de pagos** ("Conectar MercadoPago/Stripe" por ciudad, OAuth tipo Stripe Connect):
  modelo `App.payment{provider, tokens encriptados, status}`, abstracción `PaymentProvider`,
  webhook ruteado por ciudad. NO se construye hasta que cobre la 2da ciudad. Detalle en
  `ESTRATEGIA-PAGOS.md`.
- **`NewAppPage`** todavía no tiene **todos** los campos legales (sí prefijo + geoCenter +
  localidad); los legales se cargan en `AppDetailPage` (editar) tras crear.

---

## Definición de "listo para cobrar una ciudad nueva"
Crear la ciudad en el owner (nombre/localidad/país/precio/geoCenter), que resuelva su
subdominio (ya automático por el wildcard), email andando (SMTP_PASSWORD), y el medio de pago
del país (MP AR hoy; MP CO / Stripe = Fase 2).
