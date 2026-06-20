export const meta = {
  name: 'auditoria-lanzamiento-micuidad',
  description: 'Repaso de lanzamiento multi-ciudad Mi Ciudad: crear ciudad, config, cupones, canje, pagos, hardcodeos, aislamiento por ciudad. GO/NO-GO.',
  phases: [
    { title: 'Auditar', detail: '14 secciones revisadas en paralelo' },
    { title: 'Verificar', detail: 'verificación adversarial por sección' },
    { title: 'Sintetizar', detail: 'reporte de listo-para-lanzar + GO/NO-GO' },
  ],
}

const ROOT = '/Users/alannaimtapia/dev/misanpedro'

const PRE = `Repo: monorepo pnpm en \`${ROOT}\`.
Apps: api (Hono + Mongoose + MongoDB), web (PWA vecino + panel del comercio en ruta \`/#/admin\` con HashRouter), owner (super-admin), landing, landing-vecino; packages/shared.
Plataforma MULTI-CIUDAD llamada "Mi Ciudad" (dominio micuidad.com). Cada ciudad = un documento \`App\` (tenant) con: slug, subdomain, nombre, ciudad, provincia, pais, moneda (ISO-4217 ej ARS/COP), locale (BCP-47 ej es-AR/es-CO), precioMensual, brand{primaryColor, accentColor}, status, plan. La PWA resuelve el tenant por subdominio: \`<ciudad>.micuidad.com\` → middleware/tenant.ts (backend) y lib/tenant.ts (frontend). Hoy existen San Pedro (AR/ARS, naranja) y Nariño (CO/COP).

OBJETIVO DEL REPASO: garantizar un LANZAMIENTO multi-ciudad. Lo crítico: (1) que crear una ciudad NUEVA funcione de punta a punta y quede usable; (2) que NADA quede atado a "San Pedro" — ni datos, ni copy, ni precio (50.000), ni color (verde/teal), ni moneda (ARS), ni email, ni URL (.misanpedro.app); (3) que una ciudad JAMÁS vea datos de otra. Es una revisión de CORRECTITUD y COMPLETITUD de producto (NO es una auditoría de seguridad ofensiva).

REGLAS: Leé los archivos REALES antes de afirmar nada. Citá \`file:line\` y pegá el fragmento exacto como evidencia. No inventes ni supongas. Si algo está correcto, listalo en worksAsIntended (breve). Severidades: "blocker" = impide lanzar una ciudad nueva, o muestra/usa datos de otra ciudad, o cobra/activa mal; "major" = funciona pero queda mal/confuso/atado a San Pedro para una ciudad nueva; "minor" = cosmético o edge poco probable; "nit" = mejora menor. Sé concreto en "fix" (qué cambiar y dónde).`

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    section: { type: 'string' },
    summary: { type: 'string', description: 'estado general de la sección en 1-3 frases' },
    worksAsIntended: { type: 'array', items: { type: 'string' } },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] },
          file: { type: 'string' },
          line: { type: 'string' },
          evidence: { type: 'string' },
          impact: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['title', 'severity', 'file', 'evidence', 'impact', 'fix'],
      },
    },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['section', 'summary', 'worksAsIntended', 'findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    section: { type: 'string' },
    summary: { type: 'string' },
    worksAsIntended: { type: 'array', items: { type: 'string' } },
    verifiedFindings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          verdict: { type: 'string', enum: ['confirmed', 'refuted', 'adjusted'] },
          finalSeverity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] },
          file: { type: 'string' },
          reasoning: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['title', 'verdict', 'finalSeverity', 'reasoning'],
      },
    },
  },
  required: ['section', 'verifiedFindings'],
}

const SECTIONS = [
  {
    key: 'crear-ciudad',
    title: 'Crear una ciudad nueva (owner → API → tenant)',
    prompt: `## Tu sección: CREAR UNA CIUDAD NUEVA
Recorré el flujo de alta de ciudad de punta a punta y verificá que una ciudad nueva quede creada, configurada y RESUELTA correctamente.
Archivos: apps/owner/src/pages/NewAppPage.tsx, apps/owner/src/pages/AppsPage.tsx, apps/api/src/routes/owner.ts (createApp / createAppSchema), apps/api/src/models/App.ts, apps/api/src/db/connection.ts (seedCityFromEnv, bootstrap), apps/api/src/middleware/tenant.ts (toAsciiLabel, findTenantByKey, RESERVED, default subdomain \`mi<slug>\`).
Verificá: validación completa (slug, subdomain, moneda, locale, precioMensual, brand, pais); rechazo de slugs/subdominios reservados (administracion, ciudades); soporte de ñ vía punycode (ej "minariño"); defaults de marca naranja (#ea580c/#c2410c) y NO verde; que precioMensual se pueda fijar al crear; manejo de duplicados (E11000 → 409); auto-fill país→moneda/locale en el form. ¿La ciudad recién creada resuelve sola (sin redeploy) al entrar a su subdominio? ¿Qué se crea exactamente (solo el App, o también merchants/usuarios demo)? Si hay seed automático de datos demo, es BLOCKER (una ciudad nueva debe nacer vacía).`,
  },
  {
    key: 'configurar-ciudad',
    title: 'Configurar / editar una ciudad y su propagación',
    prompt: `## Tu sección: CONFIGURAR / EDITAR CIUDAD
Archivos: apps/owner/src/pages/AppDetailPage.tsx, apps/owner/src/components/DnsSetupCard.tsx, apps/api/src/routes/owner.ts (updateApp / PATCH / GET /apps stats / GET /metrics), apps/api/src/routes/tenant.ts (GET /:slug/config, GET / lista pública), apps/web/src/lib/tenant.ts (TenantConfig, resolución de subdominio, applyBrandingToDom).
Verificá: que se puedan editar moneda/locale/precioMensual/brand/subdomain y que esos cambios PROPAGUEN a la PWA (config endpoint → applyBrandingToDom: color, título, theme). Que las stats del panel sean reales (countDocuments por appId, no cacheadas/mock). Que /metrics agrupe MRR por moneda (no sume ARS+COP). Que el endpoint config devuelva moneda/locale/precioMensual y tenga fallback razonable. Que la tarjeta "ciudad online" muestre URLs correctas (vecino raíz + comercio /#/admin/login) en micuidad.com (NO .misanpedro.app).`,
  },
  {
    key: 'hardcoded-sweep',
    title: 'Barrido de datos/textos hardcodeados de San Pedro',
    prompt: `## Tu sección: BARRIDO DE HARDCODEOS
Buscá TODO lo que quede atado a San Pedro y que se le mostraría/aplicaría a OTRA ciudad. Recorré apps/api/src, apps/web/src, apps/owner/src, apps/landing/src, apps/landing-vecino/src, packages/shared/src.
IMPORTANTE: el \`grep\` de este sistema es ugrep y maneja mal \`--include\` cuando va después de varios paths. Usá UN path por vez y --include ANTES del path, ej:
\`grep -rniE --include="*.ts" --include="*.tsx" "PATRON" apps/web/src\`
Patrones a barrer (case-insensitive): "misanpedro", "mi san pedro", "san pedro", "sanpedro" (fuera de slug legítimo), "50000|50\\.000|\\$50", "hola@|soporte@|info@.*misanpedro", "\\.misanpedro\\.app|app\\.misanpedro", "'ARS'|\"ARS\"|currency_id", colores verdes/teal hardcodeados ("#0d9488|#059669|#10b981|teal|emerald|green-" usados como color de marca y no como semántica de ahorro), "Nariño|narino" hardcodeado fuera de datos seed, "es-AR" hardcodeado como locale fijo, "\\$" como símbolo de moneda fijo.
Para CADA match real que afecte a una ciudad ≠ San Pedro, reportá un finding (severidad según si se muestra al usuario final / cambia el cobro / el color / la moneda). Distinguí lo legítimo (suffix de hosts, defaults con fallback correcto) de lo problemático. NO reportes los .test.ts.`,
  },
  {
    key: 'aislamiento-ciudades',
    title: 'Aislamiento de datos entre ciudades (appId en cada query)',
    prompt: `## Tu sección: AISLAMIENTO ENTRE CIUDADES (correctitud de datos)
Verificá que una ciudad NUNCA pueda leer ni escribir datos de otra. Esto es correctitud de datos multi-tenant, no seguridad ofensiva.
Archivos: apps/api/src/middleware/tenant.ts (getAppId, tenantContext), apps/api/src/middleware/auth.ts, y TODAS las rutas: coupons.ts, redemptions.ts, activations.ts, merchants.ts, merchant-auth.ts, user-auth.ts, admin.ts, referrals.ts, notifications.ts, push.ts, templates.ts, whatsapp.ts, tenant.ts, billing.ts. Modelos: revisá que cada modelo de datos tenga \`appId\` (App.ts, Coupon.ts, Merchant.ts, MerchantUser.ts, User.ts, Redemption.ts, Activation.ts, Referral.ts, CustomerNote.ts, PushSubscription.ts, Subscription.ts, Otp.ts, WaSend.ts).
Para cada endpoint que lee/escribe datos de negocio: confirmá que el filtro de Mongo incluye \`appId\` (de getAppId/tenant), no solo un id. Buscá findOne/find/updateOne/deleteOne/aggregate que filtren SOLO por _id o por un campo swithout appId → cada uno es un posible cruce de ciudades (blocker si permite leer/editar datos de otra ciudad). Revisá también que el JWT del comercio/vecino esté atado al appId correcto y que un token de una ciudad no sirva en otra.`,
  },
  {
    key: 'cupon-config',
    title: 'Configuración de un cupón (panel del comercio)',
    prompt: `## Tu sección: CONFIGURAR UN CUPÓN (comercio)
Archivos: apps/web/src/pages/admin/AdminCuponesPage.tsx, apps/web/src/pages/admin/AdminCuponEditPage.tsx, apps/api/src/routes/coupons.ts (+ coupons.test.ts solo como referencia de contrato), apps/api/src/models/Coupon.ts, packages/shared/src/schemas.ts, packages/shared/src/usageLimit.ts y apps/api/src/services/usageLimit.ts.
Verificá el alta/edición de cupón: campos disponibles, validación (front y back coherentes vía shared/schemas), límites de uso (por vecino / total / por día), categorías, vigencia/fechas, precioReferencia (para "armá tu plan"), descuento %/monto, estado activo/pausado. Que TODO se cree scopeado por appId. Que la copy sea tenant-aware (no diga "San Pedro"). Que la moneda mostrada en el cupón use la del tenant. ¿Puede el comercio crear algo inválido que rompa la vista del vecino? ¿El límite de uso se persiste y se respeta?`,
  },
  {
    key: 'cupon-uso',
    title: 'Uso de un cupón y canje (vecino + confirmación del comercio)',
    prompt: `## Tu sección: USO DEL CUPÓN Y CANJE
Recorré el ciclo completo: el vecino descubre → activa → canjea, y el comercio confirma.
Archivos vecino: apps/web/src/pages/DescuentosPage.tsx, CuponDetailPage.tsx, CuponActivoPage.tsx, MisCuponesPage.tsx, CanjeadosPage.tsx, MapaPage.tsx, MerchantDetailPage.tsx. Comercio: apps/web/src/pages/admin/AdminConfirmarCanjePage.tsx, AdminValidarPage.tsx. API: apps/api/src/routes/activations.ts, redemptions.ts; modelos Activation.ts, Redemption.ts; services/usageLimit.ts, expiry.service.ts.
Verificá: descubrimiento de cupones de ESA ciudad; activación; generación/validación del código o QR de canje; que el comercio confirme el canje correctamente; que NO se pueda canjear dos veces / fuera de vigencia / sobre el límite (correctitud, evitar doble-gasto); que el contador de usos se actualice; que todo esté scopeado por appId (un comercio no confirma canjes de otra ciudad). Que la copy/moneda sea tenant-aware. ¿Qué pasa si el cupón expiró o se pausó mientras estaba activo?`,
  },
  {
    key: 'comercio-auth-gating',
    title: 'Alta/login del comercio y bloqueo por suscripción',
    prompt: `## Tu sección: COMERCIO — ALTA, LOGIN Y GATING POR PAGO
Archivos: apps/api/src/routes/merchant-auth.ts, apps/web/src/pages/admin/AdminLoginPage.tsx, AdminSignupPage.tsx, apps/api/src/middleware/auth.ts (requireMerchantAuth), apps/api/src/routes/billing.ts (/me usado por la UI), apps/web/src/components o shell del comercio (MerchantShell), apps/web/src/pages/admin/AdminDashboardPage.tsx.
Verificá: signup del comercio (crea Merchant + MerchantUser con appId); login OTP-only (sin password); estados del comercio (pending_payment / activo / suspendido / cancelado) y SU GATING: ¿un comercio en pending_payment o suspendido queda efectivamente bloqueado de las funciones (crear cupones, ver clientes) o puede operar igual? ¿Dónde está el gate (front y/o back)? Confirmá que el login rechaza suspendido/cancelado. Que la copy no diga "Mi San Pedro" hardcodeado (debe mostrar el nombre del tenant). Verificá que se hayan quitado del login los bloques de Ley 25.326 y el de "$50.000 / Factura C" y que el header no quede amontonado.`,
  },
  {
    key: 'vecino-auth-exp',
    title: 'Alta/login del vecino y su experiencia',
    prompt: `## Tu sección: VECINO — ALTA, LOGIN Y EXPERIENCIA
Archivos: apps/api/src/routes/user-auth.ts, apps/web/src/pages/RegistroPage.tsx, PerfilPage.tsx, PlanPage.tsx, TenantSelectorPage.tsx, apps/api/src/models/User.ts, y componentes SavingsWallet / ClubCard / InstallPrompt (buscalos en apps/web/src/components).
Verificá: registro/login del vecino con appId correcto; que el "ahorro" (SavingsWallet) y la club card muestren el nombre/ciudad del tenant (no "San Pedro"); que el selector de ciudad y la pantalla de ciudad-no-encontrada (TenantNotFoundScreen en App.tsx) funcionen; que la moneda del ahorro use la del tenant. ¿Hay algún dato del vecino que se comparta entre ciudades? ¿La PWA (manifest, título, theme-color) refleja la ciudad correcta?`,
  },
  {
    key: 'billing-pagos',
    title: 'Cobro / suscripción del comercio (correctitud)',
    prompt: `## Tu sección: COBRO / SUSCRIPCIÓN (correctitud, no seguridad ofensiva)
Archivos: apps/api/src/routes/billing.ts, apps/api/src/services/mp.service.ts, apps/api/src/services/mp-signature.ts, apps/api/src/models/Subscription.ts, apps/api/src/env.ts.
Contexto ya verificado por mí: el circuito mock anda (preapproval→mock-confirm→activo) y mock-confirm devuelve 403 cuando hay MP_ACCESS_TOKEN. NO repitas eso; enfocate en CORRECTITUD para multi-ciudad y lanzamiento:
- precioMensual por ciudad: ¿el preapproval usa el precio del tenant (no 50.000 fijo)? ¿guarda la moneda del tenant en Subscription?
- multi-moneda: en mp.service.ts \`createPreapproval\` ¿el \`currency_id\` está hardcodeado en 'ARS'? Si sí, una ciudad en COP cobraría en la moneda equivocada → reportalo con severidad (para lanzamiento de la 1ª ciudad en ARS es menor, pero para Nariño es blocker).
- recibo/email tenant-aware (nombre, moneda, locale).
- webhook: que rechace firma inválida en producción (fail-closed) y que la activación sea idempotente.
- dependencias para cobrar de verdad: variables de entorno requeridas (MP_*, RESEND_API_KEY) y qué pasa si faltan.`,
  },
  {
    key: 'emails',
    title: 'Emails (OTP, bienvenida, recibo, avisos) tenant-aware',
    prompt: `## Tu sección: EMAILS
Archivos: apps/api/src/services/email.service.ts y TODOS sus llamadores (grepeá "sendMerchantOtp", "sendMerchantWelcome", "sendSubscriptionReceipt", "sendOwnerNewAppNotice", "send" en routes).
Verificá: que cada email (OTP del comercio, bienvenida, recibo de suscripción, aviso al owner de nueva app, OTP/recibos del vecino si existen) incluya el NOMBRE de la ciudad (appNombre) y no diga "Mi San Pedro" fijo; que el recibo use moneda/locale del tenant; que el email de soporte sea genérico (soporte@micuidad.com) y permita detectar de qué ciudad viene; que el remitente/footer no esté atado a San Pedro. Dependencia: ¿qué pasa si falta RESEND_API_KEY (el comercio no recibe OTP y no puede entrar)? Marcá si es blocker de lanzamiento.`,
  },
  {
    key: 'branding-colores',
    title: 'Branding y colores por ciudad',
    prompt: `## Tu sección: BRANDING Y COLORES POR CIUDAD
Archivos: apps/api/src/models/App.ts (brand defaults), apps/web/src/lib/tenant.ts (applyBrandingToDom, isHexColor), apps/web/index.html, apps/web/vite.config.ts, y componentes que usan color (CardImage, headers, botones; grepeá uso de --color-brand / primaryColor / accentColor). Revisá también brand.mjs si existe en la raíz.
Verificá: que el color de marca venga del tenant (single-knob --color-brand) y NO haya verde/teal hardcodeado como color de marca (el verde #059669 está RESERVADO solo para semántica de "ahorro", confirmá que no se use como brand). Que el default de una ciudad nueva sea naranja. Que applyBrandingToDom sanitice el color (isHexColor) y setee título y theme-color del tenant. Que el manifest/favicon/OG no queden fijos en "Mi San Pedro". Que CardImage tiñe por categoría con el color del tenant. ¿Una ciudad con brand mal seteado rompe algo?`,
  },
  {
    key: 'legal-compliance',
    title: 'Legales y cumplimiento por país',
    prompt: `## Tu sección: LEGALES / CUMPLIMIENTO POR PAÍS
Archivos: apps/web/src/pages/legal/ (listá y leé todo), apps/web/src/pages/admin/AdminLoginPage.tsx, y cualquier copy con "Ley 25.326", "Habeas Data", "Factura C", "monotributo", "arrepentimiento", "términos", "privacidad".
Verificá para multi-país (Argentina vs Colombia): que las páginas legales (términos, privacidad) no afirmen cosas SOLO de Argentina (Ley 25.326, Factura C, AFIP/monotributo) cuando la ciudad es de otro país (Colombia → Ley 1581 Habeas Data, sin Factura C). Que el período de arrepentimiento (10 días) y los textos de pago sean correctos o al menos genéricos. ¿Las páginas legales son tenant/país-aware o están fijas a AR? Para un lanzamiento de UNA ciudad AR es aceptable, pero para Nariño (CO) marcá lo que sería incorrecto/ilegal mostrar. Que el nombre de la empresa/responsable no quede como placeholder.`,
  },
  {
    key: 'i18n-moneda-locale',
    title: 'Formato de moneda/fecha/número por ciudad',
    prompt: `## Tu sección: MONEDA / LOCALE / FORMATO
Archivos: packages/shared/src/valor.ts (y valor.test.ts como referencia), apps/web/src (grepeá "formatMoney", "toLocaleString", "Intl.NumberFormat", "Intl.DateTimeFormat", "es-AR", "\\$"), apps/web/src/lib/tenant.ts.
Verificá: que el formateo de plata use la moneda y el locale del tenant (ARS con separador de miles AR; COP sin decimales, símbolo correcto) y no \`$\` fijo ni es-AR fijo. Que las fechas usen el locale del tenant. Que "Ahorrás $X" y los montos de cupón/suscripción se muestren en la moneda correcta de la ciudad. Buscá cualquier formateo que asuma pesos argentinos. ¿Hay redondeos o decimales que rompan en COP?`,
  },
  {
    key: 'deploy-infra',
    title: 'Deploy, infra wildcard y variables de entorno',
    prompt: `## Tu sección: DEPLOY / INFRA / ENV
Archivos: scripts/deploy-micuidad.mjs, infra/cloudflare-worker-micuidad.js (si existe), apps/web/vite.config.ts, apps/owner/vite.config.ts, apps/web/.env.production, apps/web/.env.local, apps/api/src/env.ts, y los SETUP*.md de la raíz (SETUP-MICUIDAD.md, SETUP-CLOUDFLARE.md, SETUP-OWNER.md).
Verificá (correctitud de despliegue): que los builds salgan con base=/ correcta para administracion (owner) y ciudades (PWA); que el deploy escriba el .htaccess de SPA fallback; que el guardrail anti-localhost exista (no hornear localhost en prod); que las VITE_* públicas (API URL, support email) apunten a micuidad.com y NO a misanpedro; que esté claro qué variables de entorno faltan para producción (MP_*, RESEND_API_KEY, OWNER_BOOTSTRAP_*) y que ningún secreto esté commiteado en .env versionados. ¿El worker wildcard cubre cualquier <ciudad>.micuidad.com? ¿Hay algo que impida que una ciudad nueva quede online sin tocar infra?`,
  },
]

// ───────────────────────────── Ejecución ─────────────────────────────
phase('Auditar')

const verified = await pipeline(
  SECTIONS,
  // Stage 1: finder (Sonnet, alto esfuerzo) — encuentra hallazgos en su sección.
  (s) =>
    agent(`${PRE}\n\n${s.prompt}\n\nDevolvé el resultado con el schema. section="${s.key}".`, {
      label: `find:${s.key}`,
      phase: 'Auditar',
      model: 'sonnet',
      effort: 'high',
      schema: FINDINGS_SCHEMA,
    }),
  // Stage 2: verificador adversarial (Sonnet) — reabre cada cita y confirma/refuta.
  (found, s) => {
    if (!found) return null
    return agent(
      `${PRE}\n\nSos un REVISOR ADVERSARIAL de la sección "${s.title}" (key=${s.key}).
Te paso el resultado del primer revisor (JSON). Para CADA finding: reabrí el archivo citado (file:line) en \`${ROOT}\` y verificá si la evidencia es REAL y si la severidad es correcta.
- "confirmed": evidencia real y severidad correcta.
- "adjusted": real pero la severidad estaba mal → poné finalSeverity correcta.
- "refuted": no pudiste reproducir la evidencia o el hallazgo es incorrecto. Sé escéptico: si dudás, refutá.
Además spot-chequeá 1-2 ítems de worksAsIntended; si alguno es FALSO (en realidad está roto), agregalo como finding nuevo con verdict "confirmed". Devolvé también section, summary y worksAsIntended (depurado).

RESULTADO DEL PRIMER REVISOR:
${JSON.stringify(found)}`,
      {
        label: `verify:${s.key}`,
        phase: 'Verificar',
        model: 'sonnet',
        effort: 'high',
        schema: VERDICT_SCHEMA,
      },
    )
  },
)

const clean = verified.filter(Boolean)

// ───────────────────────────── Síntesis ─────────────────────────────
phase('Sintetizar')

const report = await agent(
  `${PRE}\n\nSos el revisor SENIOR que decide si la plataforma está LISTA PARA LANZAR una ciudad nueva.
Te paso los hallazgos VERIFICADOS de las 14 secciones (JSON: cada una con verifiedFindings, summary, worksAsIntended).
Tareas:
1. Ignorá los findings con verdict "refuted".
2. Deduplicá hallazgos que aparezcan en varias secciones (ej hardcodeos que también salen en branding/i18n) — contalos una vez, citando todas las secciones.
3. Clasificá por finalSeverity. Definí un veredicto GO / NO-GO: NO-GO si hay ≥1 blocker real para lanzar la PRIMERA ciudad (San Pedro, AR/ARS). Aclará por separado qué bloquea además a la SEGUNDA ciudad (Nariño, CO/COP) aunque no bloquee a la primera.
4. Redactá un reporte en español (markdown) con esta estructura:
   # Auditoría de lanzamiento — Mi Ciudad (micuidad.com)
   ## Veredicto: GO / NO-GO (1ª ciudad AR) + nota sobre 2ª ciudad CO
   ## Bloqueantes (tabla: # | hallazgo | sección | archivo | impacto | fix)
   ## Mayores (misma tabla)
   ## Menores / nits (lista compacta)
   ## Estado por sección (tabla: sección | estado ✅/⚠️/❌ | resumen)
   ## Checklist de acciones priorizado para lanzar (orden de ejecución, separando "código nuestro" de "config tuya en Railway/Cloudflare/MP")
   ## Preguntas abiertas
Sé honesto y concreto; nada de relleno. Los "fix" deben decir qué archivo tocar y qué cambiar.

HALLAZGOS VERIFICADOS:
${JSON.stringify(clean)}`,
  {
    label: 'sintesis-go-no-go',
    phase: 'Sintetizar',
    effort: 'high',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        goNoGo: { type: 'string', enum: ['GO', 'NO-GO'] },
        veredictoNota: { type: 'string' },
        blockerCount: { type: 'number' },
        majorCount: { type: 'number' },
        minorCount: { type: 'number' },
        reportMarkdown: { type: 'string' },
      },
      required: ['goNoGo', 'veredictoNota', 'blockerCount', 'majorCount', 'minorCount', 'reportMarkdown'],
    },
  },
)

return { goNoGo: report?.goNoGo, veredictoNota: report?.veredictoNota, blockerCount: report?.blockerCount, majorCount: report?.majorCount, minorCount: report?.minorCount, reportMarkdown: report?.reportMarkdown, secciones: clean.length }
