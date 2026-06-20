<!-- Generado por auditoría multi-agente (29 agentes) el 2026-06-20. Veredicto: NO-GO. Bloqueantes: 8 · Mayores: 14 · Menores: 15. -->

# Auditoría de lanzamiento — Mi Ciudad (micuidad.com)

Consolidación de 14 secciones verificadas. Se ignoraron los findings con verdict "refuted" (el único: la cita de `cn.ts` en hardcoded-sweep, ya corregida en su propio reasoning). Los hallazgos repetidos en varias secciones se cuentan una sola vez citando todas las secciones.

## Veredicto: NO-GO (1ª ciudad AR) + nota sobre 2ª ciudad CO

**1ª ciudad (San Pedro, AR/ARS): NO-GO.** Hay ≥1 bloqueante real para lanzar siquiera la primera ciudad — y son agnósticos de moneda/país:

- **Infra no desplegada** (deploy-infra): el Cloudflare Worker `*.micuidad.com` está en estado `⏳` y el script `deploy:micuidad` no tiene alias en `package.json`. Sin esto, **ningún subdominio resuelve online**, ni siquiera `sanpedro.micuidad.com`.
- **RESEND_API_KEY ausente = login imposible** (emails): el login de comercio es OTP-only y `sendEmail` devuelve `{ ok: true, id: 'stub' }` en silencio si falta la key. Si el deploy de prod no tiene la key, el comercio nunca recibe el OTP y nadie entra. Es config, pero el código no falla ruidosamente → bloqueante operativo.
- **Páginas legales con placeholder en prod** (legal-compliance): `[PENDIENTE_DOMICILIO_FISCAL]` se renderiza literal y visible al usuario en Términos y Privacidad. No se puede lanzar un servicio de pago mostrando eso. Además el CUIT personal y el domicilio están hardcodeados en el fuente.

**2ª ciudad (Nariño, CO/COP): bloqueantes adicionales** (no afectan a la 1ª por ser AR/ARS, pero impiden la 2ª):

- **MercadoPago `currency_id: 'ARS'` hardcodeado** (configurar-ciudad, billing-pagos, i18n-moneda-locale, hardcoded-sweep, deploy-infra): una suscripción en COP se enviaría a MP como ARS → cobro erróneo o rechazo. La moneda del tenant ya está en scope pero nunca llega al payload.
- **Todo el aparato legal es argentino** (vecino-auth-exp, legal-compliance, branding-colores, i18n, hardcoded-sweep): Términos y Privacidad citan Ley 24.240, Ley 25.326, AFIP, Monotributo, factura C, AAIP y "Tribunales de San Pedro". Inaplicable y engañoso para un vecino/comercio colombiano.
- **EMAIL_FROM = 'Mi San Pedro'** y branding "Mi San Pedro" disperso: una ciudad colombiana recibiría emails firmados por una ciudad argentina.

## Bloqueantes

| # | Hallazgo | Sección(es) | Archivo | Impacto | Fix |
|---|----------|-------------|---------|---------|-----|
| B1 | Cloudflare Worker `*.micuidad.com` sin desplegar + Hostinger/nameservers pendientes | deploy-infra | `SETUP-CLOUDFLARE.md:25-26` | Ningún `<ciudad>.micuidad.com` resuelve. Bloquea AR y CO. | Ejecutar pasos A-B-C de SETUP-CLOUDFLARE.md: crear `ciudades.micuidad.com` en Hostinger con SSL, cambiar nameservers a brynne/norm.ns.cloudflare.com, crear Worker con `infra/cloudflare-worker-micuidad.js` y ruta `*.micuidad.com/*`. |
| B2 | `deploy:micuidad` no existe en package.json; queda `deploy:hostinger` (script viejo) | deploy-infra | `package.json:17-18` | Operador despliega con script obsoleto a paths/hosts equivocados. | Agregar `"deploy:micuidad": "node scripts/deploy-micuidad.mjs"`. Eliminar o renombrar `deploy:hostinger`. |
| B3 | RESEND_API_KEY ausente = éxito silencioso (200) y el OTP nunca llega | emails | `apps/api/src/services/email.service.ts:25-33` | Login es OTP-only; sin la key en prod nadie puede entrar y no hay error visible. | Guard en prod: `if (!env.RESEND_API_KEY && isProd) return { ok:false, error:'email not configured' }`; la ruta devuelve 503 para que el comercio vea un error real. |
| B4 | `currency_id: 'ARS'` hardcodeado en el preapproval de MercadoPago | configurar-ciudad, billing-pagos, i18n-moneda-locale, hardcoded-sweep, deploy-infra | `apps/api/src/services/mp.service.ts:49` | Suscripción COP se cobra/valida como ARS → cobro errado o rechazo de MP. Bloquea CO. | Agregar `currency` a `PreapprovalReq`, usar `currency_id: input.currency`, renombrar `amountARS`→`amount`. En `billing.ts:165` pasar `currency: tenant.moneda ?? 'ARS'`. Nota: MP Colombia usa cuenta/token distintos de MP Argentina — puede requerir token por país. |
| B5 | Páginas legales (Términos + Privacidad) 100% hardcodeadas a San Pedro/Argentina | legal-compliance, vecino-auth-exp, i18n, branding-colores, hardcoded-sweep | `apps/web/src/pages/legal/TerminosPage.tsx:25-179`, `PrivacidadPage.tsx:25-122` | Sin `useTenant()`: nombre, ciudad, precio $50.000 ARS, Ley 24.240/25.326, AFIP, Monotributo, factura C, AAIP, jurisdicción San Pedro. Vinculante para el usuario. Bloquea CO; el placeholder bloquea también AR. | Convertir ambas a `useTenant()` para nombre/ciudad/precio/moneda. Condicionar leyes/organismos/jurisdicción por `tenant.config?.pais` (AR: Ley 24.240/25.326; CO: Ley 1581, SIC) o texto neutro. |
| B6 | `[PENDIENTE_DOMICILIO_FISCAL]` visible en producción + CUIT personal hardcodeado | legal-compliance | `TerminosPage.tsx:44`, `PrivacidadPage.tsx:31-40` | Placeholder literal y datos fiscales personales (Alan Naim Tapia, 20-43316638-9) en el fuente, visibles a cualquier usuario. Bloquea AR. | Completar el domicilio fiscal real antes de lanzar. Externalizar responsable/CUIT/condición fiscal a config por tenant o `VITE_OPERATOR_*`. |
| B7 | `EMAIL_FROM` default `'Mi San Pedro <onboarding@resend.dev>'` | env/emails, configurar-ciudad, hardcoded-sweep, comercio-auth-gating, billing-pagos, deploy-infra | `apps/api/src/env.ts:19` (+ `.env.example:80`) | Todo email transaccional de cualquier ciudad sale firmado "Mi San Pedro". Bloquea CO (identidad de otra ciudad/país). | Cambiar default a `'Mi Ciudad <noreply@micuidad.com>'`; ideal: construir el FROM por tenant pasando `tenant.nombre` a `sendEmail`. Alinear `.env.example`. |
| B8 | `ensureSanpedroApp()` corre en cada boot y crea el tenant `sanpedro` en deploys de otras ciudades | crear-ciudad | `apps/api/src/services/seed.service.ts:263-270` | En un deploy dedicado a Nariño (sin `SEED_DEMO_DATA=true`) el server crea un tenant fantasma `sanpedro` en la DB de esa ciudad. Viola "nada atado a San Pedro". Bloquea el modelo de deploy independiente por ciudad. | Gatear con `SEED_SANPEDRO=true`; el boot no debe crear ningún tenant implícito. Bootstrap vía `SEED_CITY_JSON` ya existente. |

> Nota: si el modelo de despliegue es **una sola API multi-tenant** (no un deploy por ciudad), B8 baja a major. Confirmar esto es una pregunta abierta clave.

## Mayores

| # | Hallazgo | Sección(es) | Archivo | Impacto | Fix |
|---|----------|-------------|---------|---------|-----|
| M1 | `geoCenter` default a coords de San Pedro (-33.6797, -59.6669) en modelo y fallbacks FE/BE | crear-ciudad, hardcoded-sweep, branding-colores, comercio-auth-gating | `apps/api/src/models/App.ts:99-101`, `tenant.ts:52`, `AdminSignupPage.tsx:26`, `AdminComercioPage.tsx:74`, `merchant-auth.ts:69` | Ciudad nueva sin geoCenter nace con mapa y coords de signup en San Pedro, BA. | Quitar defaults del schema; hacer geoCenter requerido en NewAppPage del owner. FE: pasar `null` al picker y usar geolocalización del browser. |
| M2 | Defaults `provincia='Buenos Aires'` y `pais='Argentina'` en modelo y schema | crear-ciudad, configurar-ciudad, branding-colores | `App.ts:34-35`, `owner.ts:401-402`, `NewAppPage.tsx:17` | Un POST sin esos campos persiste ciudad colombiana como Buenos Aires/Argentina. | Quitar defaults (string vacío / opcional) y validar requerido en el endpoint de creación. |
| M3 | Owner panel muestra "Mi San Pedro" en sidebar, login y subtitle del dashboard | configurar-ciudad, hardcoded-sweep, branding-colores, deploy-infra | `owner/.../ShellLayout.tsx:54`, `AuthLayout.tsx:13`, `DashboardPage.tsx:72` | Panel cross-tenant de plataforma se presenta como una ciudad. | Reemplazar por "Mi Ciudad" (o `VITE_PLATFORM_NAME`) en los tres lugares. |
| M4 | Fallback `'Mi San Pedro'` en `appName()` + ~12 inlines `?? 'Mi San Pedro'` | configurar-ciudad, cupon-uso, comercio-auth-gating, vecino-auth-exp | `apps/web/src/lib/tenant.ts:144` (+ AdminLoginPage, AppShell, InstallPrompt, PerfilPage, RegistroPage, AdminComercioPage, etc.) | En carga/error de config, una ciudad nueva muestra "Mi San Pedro" (incluido el CTA de instalar PWA). | Cambiar fallback a `'Mi Ciudad'` y centralizar en `appName()` con replace_all. |
| M5 | `stockMaximo` nunca se valida al activar ni bloquea el canje | cupon-config, cupon-uso | `apps/api/src/routes/activations.ts:77-98`, `redemptions.ts:204` | Cupones con stock máximo se pueden activar/canjear sin límite; estado 'agotado' nunca se asigna. | En activations POST: 409 si `stockUsado >= stockMaximo`. En redemptions: setear `estado='agotado'` tras incrementar. |
| M6 | Email de canje (`sendUserRedemption`) hardcodea `'$'`, `'es-AR'` y fecha es-AR | cupon-config, cupon-uso, emails, comercio-auth-gating | `apps/api/src/services/email.service.ts:173`, `redemptions.ts:220` | Vecino colombiano recibe monto con '$' sin moneda y fecha argentina. | Agregar `locale`/`moneda`/`appNombre` a la firma; usar `Intl.NumberFormat(locale,{currency:moneda})`; pasar `tenant.locale/moneda` desde redemptions. |
| M7 | `MoneyInput` del wizard de cupón hardcodea '$' y labels "pesos" | cupon-config | `apps/web/src/pages/admin/AdminCuponEditPage.tsx:1135,55,857,872` | UX rota para COP/CLP; muestra '$' y "pesos" literal. | Usar `formatMoneyParts()` (lib/format.ts) para el símbolo; cambiar "pesos" a texto neutro/moneda del tenant. |
| M8 | `AdminConfirmarCanjePage` cap ARS (10M) + 8 dígitos + símbolo '$' | cupon-uso, i18n | `AdminConfirmarCanjePage.tsx:91-97,186,193` | Tickets COP legítimos >99.999.999 quedan bloqueados; '$' literal. | Derivar cap/dígitos de la moneda (COP: 12 dígitos / 1.000M); usar símbolo del tenant. |
| M9 | `back_url` de MP usa `APP_URL_FRONT` global, no la URL del tenant | billing-pagos, emails, deploy-infra | `apps/api/src/routes/billing.ts:170` | Comercio de Nariño tras pagar es redirigido al panel de San Pedro. | Construir `https://${tenant.subdomain}.micuidad.com` (o customDomain) desde el tenant en scope. |
| M10 | CTAs de welcome emails usan `APP_URL_FRONT` global | emails | `email.service.ts:103,198` | Links de bienvenida apuntan a la PWA de San Pedro para cualquier ciudad. | Pasar `appUrl` derivada de `tenant.subdomain` a `sendUserWelcome`/`sendMerchantWelcome`. |
| M11 | Umbrales de tier de SavingsWallet hardcodeados en magnitudes ARS | vecino-auth-exp, i18n | `apps/web/src/components/features/SavingsWallet.tsx:8-13` | En COP un vecino llega a "Leyenda del barrio" con ~USD 12; el sistema de niveles pierde sentido. | Parametrizar `tierThresholds` por tenant/moneda; default ARS `[2000,8000,20000,50000]`. |
| M12 | Múltiples `toLocaleDateString/toLocaleString('es-AR')` en panel + `owner/format.ts` con locale fijo | i18n, comercio-auth-gating, hardcoded-sweep, cupon-config | `ClubCard.tsx:32`, `usoLimite.ts:65`, `AdminReferidosPage.tsx:24`, `AdminWhatsappPage.tsx:44`, `AdminComercioPage.tsx:1406`, `billing.ts:257`, `owner/src/lib/format.ts:3-8,24` | Fechas/monedas con formato argentino en ciudades de otro locale. | Crear `getActiveLocale()` (exportar `_money.locale`) y reemplazar literales; en owner pasar `locale` por moneda (mapa LOCALE_BY_CURRENCY). |
| M13 | Copy legal argentino visible al vecino/comercio fuera de páginas legales | legal-compliance, vecino-auth-exp, comercio-auth-gating | `RegistroPage.tsx:179`, `PerfilPage.tsx:142`, `AdminClienteDetailPage.tsx:324`, `AdminComercioPage.tsx:1415`, condicionFiscalLabel `1280-1284` | "Ley 25.326", "Ley 24.240", labels Monotributo/Responsable Inscripto en cualquier ciudad. | Condicionar por `tenant.config?.pais` o texto neutro; etiquetar CUIT/NIT por país. |
| M14 | "factura C" + SUPPORT_WHATSAPP default San Pedro sin guard en emails | emails | `email.service.ts:280,203`, `env.ts:36` | Recibo cita concepto fiscal AR; link wa.me con número de San Pedro o link roto si está vacío. | Texto genérico para comprobante; default `SUPPORT_WHATSAPP=''` y render condicional del bloque WhatsApp. |

> Majors de reporting (no bloquean lanzar pero dan números erróneos): `admin.ts:40` calcula MRR como `activeSubs * PLAN_AMOUNT_ARS` mezclando monedas (hardcoded-sweep, billing-pagos, i18n); MRR del owner dashboard muestra solo `mrrARS` ignorando `byCurrency` (configurar-ciudad, crear-ciudad, billing-pagos). `GET /redemptions/clientes/*` sin `requireMerchantActive` permite a un comercio cancelado leer su base de clientes (comercio-auth-gating). Estos suman al conteo de majors.

## Menores / nits

- **`detectInitialSlug` fallback `return 'sanpedro'`** (tenant.ts:227) — solo afecta GH Pages/localhost sin subdominio; en prod por subdominio nunca se alcanza. Cambiar a `null` para mostrar el selector. (crear-ciudad, configurar-ciudad, vecino-auth-exp, cupon-uso)
- **Tokens y localStorage sin namespace por tenant** (`api.ts:14-16`, `stores.ts:13`, `couponsStore.ts:5`, `merchantStore.ts:5`, `geo.ts:12`, `InstallPrompt.tsx:10`) — la API ya bloquea con appId/JWT (403 tenant mismatch), así que es UX-only (flash de sesión vieja al cambiar de ciudad en el mismo browser). En subdominios distintos el origin ya aísla. Limpiar stores al cambiar slug. (hardcoded-sweep ajustó a minor; vecino-auth-exp lo marcó blocker pero el consenso verificado es UX-only)
- **`amountARS` / `PLAN_AMOUNT_ARS` mal nombrados** — el dato es correcto (`currency` es canónico y se guarda bien); solo nomenclatura. Renombrar a `amount`/`PLAN_AMOUNT_DEFAULT` con migración. (múltiples secciones, ajustado a minor)
- **`fmtMoney` owner hardcodea 'es-AR'** (owner/format.ts) — cosmético en panel interno.
- **E11000 de subdomain duplicado → HTTP 500 en `createApp`** (owner.ts:446) — edge improbable; copiar el try/catch del PATCH.
- **subdomain no editable** desde el panel ni el schema (AppDetailPage / updateAppSchema) — edge infrecuente.
- **`provincia` default "Buenos Aires"** en form + subtitle "Pasto · Argentina" cuando falta provincia (AppDetailPage:178) — UX.
- **Defensa en profundidad faltante**: `requireMerchantActive` (auth.ts:111), `push/unsubscribe` (push.ts:52) y `revokeAllForSubject` (jwt.service.ts) sin filtro appId — no explotable (sameTenant + _id único), pero conviene agregar appId. (aislamiento-ciudades)
- **`admin.ts` (super-admin legacy) sin filtro appId** en queries de merchants — solo accesible con SUPER_ADMIN_TOKEN; deprecar a favor de `/owner/*`. (aislamiento-ciudades)
- **`html lang="es-AR"`** fijo en index.html, no se actualiza con el locale (a11y/TTS). One-liner en `applyBrandingToDom`. (vecino-auth-exp)
- **RegistroPage placeholder de teléfono "3329 555444"** (cód. área San Pedro) — usar ejemplo neutro.
- **landing `applyBrandingToDom` sin `isHexColor`** (a diferencia de la PWA) — validar antes de setProperty. (branding-colores)
- **`tipoOferta='dos_por_uno'` y `condiciones` sin input en wizard**; `ahorroPreview` asume porcentaje (no precio_fijo). (cupon-config, cupon-uso)
- **Webhook MP fail-open sin `dataId`** — sin ruta de mutación; agregar guard explícito 400. (billing-pagos, ajustado a minor)
- **`deploy-micuidad.mjs` guardrail** atado a `api-production-43c52` (warn, no exit) y **PLAN_AMOUNT_ARS** inconsistente env.ts(50k)/.env.example(25k). (deploy-infra)
- **`.env.example` / `SETUP-OWNER.md` stale**: apuntan a misanpedro.com/owner, deploy:hostinger, SUPPORT_EMAIL=misanpedro.app, APP_URL_FRONT gh-pages. (deploy-infra)
- **Comentarios JSDoc "(ARS)"** en Coupon.ts, schemas.ts, api.ts, types.ts; **STORAGE_KEY prefijo 'misanpedro.\*'**; **subject de owner notice sin subdomain**; **funciones email muertas** (sendUserWelcome/sendOtpCode). (varias, nits)

## Estado por sección

| Sección | Estado | Resumen |
|---------|--------|---------|
| crear-ciudad | ⚠️ | Creación sólida (slug/moneda/locale validados, aislamiento OK), pero `ensureSanpedroApp()` en boot (B8) y defaults geoCenter/provincia/pais atados a San Pedro. |
| configurar-ciudad | ❌ | PATCH persiste todo bien, pero MP currency ARS (B4) bloquea CO; branding owner "Mi San Pedro" y fallbacks slug/appName. |
| hardcoded-sweep | ❌ | EMAIL_FROM, landings, logo, SUPPORT_EMAIL/APP_URL, MP currency, legal — varios blockers de hardcodeo a San Pedro. |
| aislamiento-ciudades | ✅ | Aislamiento por appId correcto en el núcleo; solo deuda de defensa en profundidad (admin legacy, push unsub) sin riesgo de fuga. |
| cupon-config | ⚠️ | Scope por appId y privacidad OK; MoneyInput '$', email es-AR y stockMaximo no chequeado. |
| cupon-uso | ⚠️ | Isolación validate/confirm correcta; email canje (blocker en esta sección), cap ARS y ahorroPreview. |
| comercio-auth-gating | ⚠️ | OTP/gating bien; EMAIL_FROM blocker, `/clientes/*` sin requireMerchantActive, fechas es-AR, leyes AR. |
| vecino-auth-exp | ❌ | Aislamiento por appId OK; legal pages (B5) y tiers/locale ARS; tokens/stores sin namespace (UX-only). |
| billing-pagos | ❌ | Precio y moneda por tenant guardados bien; MP currency ARS (B4) y back_url global bloquean CO. |
| emails | ❌ | Plantillas tenant-aware en recibos; EMAIL_FROM, RESEND silencioso (B3), $/es-AR, factura C, WhatsApp default. |
| branding-colores | ❌ | CSS single-knob correcto; push-sw.js, legal, ambos index.html de landings y geoCenter hardcodeados a San Pedro. |
| legal-compliance | ❌ | Términos/Privacidad totalmente AR (B5), [PENDIENTE_DOMICILIO_FISCAL] (B6) y CUIT personal en fuente. |
| i18n-moneda-locale | ❌ | Núcleo formatMoney/setMoneyLocale correcto; MP currency, legal, tiers, caps y fechas es-AR pendientes. |
| deploy-infra | ❌ | Worker sin desplegar (B1) + deploy:micuidad sin alias (B2) + MP currency + EMAIL_FROM + docs stale. |

## Checklist de acciones priorizado para lanzar

### Config tuya (Railway / Cloudflare / Hostinger / MercadoPago) — hacer primero
1. **Desplegar Cloudflare Worker** `*.micuidad.com` y cambiar nameservers a brynne/norm (SETUP-CLOUDFLARE.md A-B-C). [B1]
2. **Setear `RESEND_API_KEY` en Railway** para el deploy de prod (sin esto nadie loguea). [B3]
3. **Setear `EMAIL_FROM`, `APP_URL_FRONT`, `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP`** por ciudad en Railway (no confiar en defaults). [B7, M10, M14]
4. **Completar el domicilio fiscal real** y datos del responsable (config/env), no dejar el placeholder. [B6]
5. **MercadoPago Colombia**: confirmar si requiere cuenta/access_token propio distinto de MP Argentina antes de habilitar cobros en COP. [B4]
6. **Setear `precioMensual`, `moneda`, `locale`, `geoCenter`, `provincia`, `pais`** explícitos al crear cada ciudad desde el Owner Panel. [M1, M2]

### Código nuestro — bloqueantes
7. `package.json`: agregar `"deploy:micuidad"`. [B2]
8. `email.service.ts`: guard de prod cuando falta RESEND_API_KEY (devolver error, no stub). [B3]
9. `mp.service.ts` + `billing.ts`: pasar `currency` del tenant al preapproval. [B4]
10. `TerminosPage.tsx` / `PrivacidadPage.tsx`: hacerlas tenant-aware + condicionar leyes por país + quitar placeholder y CUIT del fuente. [B5, B6]
11. `env.ts`: default `EMAIL_FROM = 'Mi Ciudad <noreply@micuidad.com>'`; alinear `.env.example`. [B7]
12. `seed.service.ts`: gatear `ensureSanpedroApp()` con `SEED_SANPEDRO=true` (si el modelo es deploy-por-ciudad). [B8]

### Código nuestro — mayores (antes de la 2ª ciudad o en sprint inmediato)
13. Quitar defaults geoCenter/provincia/pais del modelo y fallbacks San Pedro en FE/BE. [M1, M2]
14. `mp`/`billing` back_url y welcome CTAs por subdominio del tenant. [M9, M10]
15. Validar `stockMaximo` en activación y canje. [M5]
16. Tenant-aware en email de canje, MoneyInput, cap de monto, tiers de SavingsWallet, fechas es-AR (FE+BE+owner). [M6, M7, M8, M11, M12]
17. Branding "Mi San Pedro" → "Mi Ciudad" en owner panel y fallbacks appName; copy legal inline condicionado por país. [M3, M4, M13]
18. `landing/index.html`, `landing-vecino/index.html`, `Logo.tsx`, `cn.ts` (SUPPORT_EMAIL/APP_URL), `push-sw.js` → genéricos/tenant-aware. [hardcoded-sweep, branding]
19. `/redemptions/clientes/*` agregar `requireMerchantActive`; `admin.ts` MRR real por moneda o deprecar. [comercio-auth-gating, billing]

### Código nuestro — menores/nits (post-lanzamiento)
20. Fallback slug `null`, namespacing de stores/tokens al cambiar tenant, rename `amountARS`→`amount` con migración, `html lang` dinámico, validación isHexColor en landings, docs stale, JSDoc "(ARS)".

## Preguntas abiertas

1. **¿El modelo de despliegue es una sola API multi-tenant o un deploy de API por ciudad?** Define la severidad real de B8 (`ensureSanpedroApp`): blocker en deploy-por-ciudad, major en API única compartida.
2. **¿MercadoPago opera Colombia con la misma cuenta/access_token que Argentina?** Si no, B4 no se resuelve solo con pasar `currency` — hace falta token por país o un gateway alternativo para CO.
3. **¿La 1ª ciudad (San Pedro) se lanzará por `sanpedro.micuidad.com` o sigue en el deploy histórico de GH Pages/misanpedro?** Si sigue en el deploy single-tenant con `VITE_TENANT_SLUG=sanpedro`, varios "fallback sanpedro" pierden urgencia para AR pero los blockers de infra (B1/B2) y RESEND (B3) siguen aplicando.
4. **¿Quién es la entidad legal/fiscal operadora de cada ciudad?** Define si el domicilio/CUIT-NIT van por env global, por documento App, o por país — necesario para resolver B6 y M13 de forma correcta y no solo cosmética.
5. **¿Hay un dominio neutro de plataforma definido** para el Owner (`administracion.micuidad.com`) y para emails (`noreply@micuidad.com`)? Las docs (SETUP-OWNER.md) y `.env.example` aún apuntan a misanpedro.
