# 01 · Pendientes (qué falta, en orden)

> ## ✅ Bug-hunt PM/UX 2026-06-29 + aterrizaje 2026-07-02 — SHIPPED a prod
> **Bug-hunt de otra sesión** (rama `fix/bug-hunt-26`, commits `2c979dd..a55f086`): ~20 bugs
> reales de producto fixeados en 5 grupos, con tests nuevos (API 128→130, web 110→138):
> - **G1**: % efectivo de `precio_fijo` derivado del ahorro real (helper `derivarPorcentaje`) ·
>   `isOpenNow` cruzando medianoche · plurales (`pluralize`).
> - **G2**: `localISODate()` — fechas de vigencia en día LOCAL, no UTC (de noche en AR saltaba
>   +1 día) · "Cupo total: 0" se normaliza a sin límite · copy honesto con margen <5%.
> - **G3 (el gordo)**: **snapshot del cupón en el canje** — `Redemption`/`Activation` guardan
>   `couponTitulo/Porcentaje` al canjear; cupón borrado/pausado ya no rompe historial, LTV,
>   ticket promedio ni "en N comercios" (el cupón es hard-delete sin cascada; decisión: snapshot).
> - **G4**: alertas — contador cuenta todos los vigentes, dedup por contenido, feed visible en
>   pausa, `markAllSeen` sin race del badge fantasma.
> - **G5**: polling del cupón activo con botón "Actualizar" al agotarse + re-check al foco ·
>   `ExpiryHint` legacy no miente "venció" · validación de teléfono en paso 2 del alta · badge
>   "PRECIO FIJO" · perfil re-espeja nombre/teléfono · búsqueda sin parpadeo.
>
> **Aterrizaje 02/07 (auditoría integral + esta sesión):** push de `main` (estaba 13 commits sin
> respaldo en GitHub) + push y merge ff de `fix/bug-hunt-26` → deploy a prod → esta pasada de doc.
> **typecheck 6/6 · check:tenant ✓ · 268 tests verdes (130 api + 138 web) · build OK.**

> ## ✅ Tanda lanzamiento 2026-06-26/27 — SHIPPED a prod
> La semana del lanzamiento. Todo en `main`, deployado y **verificado e2e/empíricamente en prod**.
> **typecheck 6/6 · check:tenant ✓ · 268 tests verdes (130 api + 138 web) · build OK.**
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

Dos grupos vivos: **(B) pasos manuales del usuario** (no son código) y **(C) backlog**.

---

## A. Ajustes de UI pedidos — ✅ TODOS RESUELTOS (verificado en código 02/07)

Los 4 pedidos del usuario quedaron hechos en la tanda del 23/06: A.1 login con header/chip/divisor ✅ ·
A.2 InstallPrompt rediseñado (pill + modal explicativo, solo superficie vecino) ✅ · A.3 alta del
comercio en **3 pasos** ✅ · A.4 mockup angosto ✅. *(Esta sección quedaba marcada "en progreso" por
error — la auditoría del 02/07 verificó el código real y está todo shipped.)*

---

## B. Pasos manuales del usuario (NO son código — los hace él)

> El asistente **no** puede: tocar la DB de prod (es interna), ingresar contraseñas/secretos,
> ni operar las cuentas (Railway/Cloudflare/Hostinger) para meter secretos. Esto es del usuario.

**Resueltos (verificado 02/07):** ~~SMTP_PASSWORD~~ (el OTP de prod responde 200 → SMTP **funciona**;
lo confirmó también la tanda 23/06) · ~~Nariño localidad/geoCenter~~ (geoCenter = Pasto cargado) ·
~~rotar password del owner~~ (obsoleto: el owner es **passwordless por OTP** desde el 25/06).

**Siguen pendientes:**
1. **Rotar la password del buzón `soporte@micuidad.com`** (Hostinger + actualizar `SMTP_PASSWORD`
   en Railway) — se pegó en un chat en sesiones previas; todo el login de la plataforma depende de
   ese transporte. 10 min, coordinar con un momento de poco tráfico de logins.
2. **Limpiar el catálogo de San Pedro**: confirmar qué comercios son reales y suspender los de
   prueba/demo desde el owner ("Café Prueba QA", "Tap", "TAP AI" + ~7 del seed demo tienen cupones
   activos visibles a vecinos reales; solo Butti parece claramente real). **Antes de difundir a vecinos.**
3. **Domicilio fiscal real de San Pedro** (para las legales): cargarlo en el owner (editar ciudad →
   Legales); hoy queda vacío y Términos/Privacidad lo omiten. Nariño tiene `legal:{}` vacío (puede
   esperar a que tenga comercios).
4. **Verificar claves VAPID en Railway** (Web Push puede estar en no-op silencioso: el log de
   arranque dice `[push] VAPID vacío` si faltan; la tanda 23/06 las dio por seteadas — confirmar).
5. **MercadoPago AR real + Colombia** — con **trigger explícito**: activar MP AR ~2 semanas antes
   de que venza el primer trial de 90 días (≈ fines de septiembre para las altas del 27/06). MP
   Colombia recién cuando Nariño tenga comercios. Ver doc 03 + `ESTRATEGIA-PAGOS.md`.

---

## C. Backlog (mejoras / Fase 2)

**Resueltos en la tanda 23/06 (quedaban acá por error):** ~~back_url/CTAs por-tenant~~ (`lib/urls.ts`
`tenantFrontUrl`) · ~~stockMaximo sin validar~~ (claim atómico + `agotado`) · ~~tiers de SavingsWallet
en ARS~~ (escalados por moneda) · ~~geoCenter default SP~~ (mitigado: requerido al crear ciudad).

**Vivo:**
- **WhatsApp inoperativo en Railway** — el código está bien integrado (sesión por comercio, anti-ban,
  tope 4 campañas/mes) pero `nixpacks.toml` setea `PUPPETEER_SKIP_DOWNLOAD=true` (sin Chromium) y las
  sesiones van a `/tmp` efímero. El comercio ve `/admin/whatsapp` cableado pero no puede levantar.
  **Decidir:** activarlo (nixPkgs chromium + `PUPPETEER_EXECUTABLE_PATH` + volumen persistente) o
  comunicar "requiere activación" en la UI. No dejar el limbo.
- **Modo soporte sin UI de cierre** — `POST /owner/merchants/:id/revoke-support` existe en el API pero
  el front del owner no lo usa; cerrar una sesión de soporte hoy es a mano. Botón "Cerrar sesiones de
  soporte" en la ficha del comercio + filtro `support.*` en la vista de auditoría (~1h).
- **Higiene git** — podar ~9 ramas 100% mergeadas (locales y remotas, cerrar PRs #1-#3); revisar y
  casi seguro borrar `feat/asesor-cupones` (WIP del 06/06, superado por `feat/valor-cupon` — NO
  mergear: pisa `AdminCuponEditPage` que el bug-hunt también tocó).
- Restos cosméticos: fechas `es-AR` fijas en algunos lugares del panel, copy legal AR inline fuera
  de `/legal`.
- **Fase 2 de pagos** ("Conectar MercadoPago/Stripe" por ciudad, OAuth tipo Stripe Connect):
  modelo `App.payment{provider, tokens encriptados, status}`, abstracción `PaymentProvider`,
  webhook ruteado por ciudad. NO se construye hasta que cobre la 2da ciudad. Detalle en
  `ESTRATEGIA-PAGOS.md`.
- **`NewAppPage`** todavía no tiene **todos** los campos legales (sí prefijo + geoCenter +
  localidad); los legales se cargan en `AppDetailPage` (editar) tras crear.
- **Refactors diferidos** (de la tanda 23/06, siguen diferidos a propósito): schemas owner/billing a
  `packages/shared` · apps extendiendo `tsconfig.base.json` · manifest PWA por-host (server-side).

---

## Definición de "listo para cobrar una ciudad nueva"
Crear la ciudad en el owner (nombre/localidad/país/precio/geoCenter), que resuelva su
subdominio (ya automático por el wildcard), email andando (ya funciona con el buzón global), y el
medio de pago del país (MP AR hoy; MP CO / Stripe = Fase 2).
