# Cazabug Mi San Pedro — catálogo de hallazgos (loop 1)

Barrido: 14 sectores · 181 candidatos → **169 confirmados** (adversarial) · 8 refutados.
Distribución: **P0:2 · P1:14 · P2:51 · P3:102**

## Resueltos en el loop 1 (rama `cazabug/loop1-iso`)

| commit | findings | qué |
|---|---|---|
| ccfd334 | S2-01(P0),S3-01,S4-02,S2-02,S4-01,S3-04 | sesión de soporte: gate de rol + revalidación del owner |
| 741fa2b | S1-04,S3-02 | OTP fuera de los logs de prod |
| 71b5edf | S14-02 | el boot local no muta la base de prod |
| 6053db5 | S10-01 | historial de notificaciones aislado por comercio |
| fcfc011 | S11-01 | suscripción vencida → suspende al comercio |
| ca1573f | S9-07 | WhatsApp: reponer el país (todos los envíos fallaban) |
| 17fd654 | S9-01 | campaña async 202 + SSE (no bloquea el HTTP) |
| ac62958 | S1-02 | identidad: normalizar según el país del tenant |
| 3d9794b | S2-03 | revelar el OTP deja de depender de NODE_ENV |
| (este plan) | S1-01(P0) | login del vecino por email — se cierra el account takeover |

Gate: API 169 tests · Web 143 · check:tenant ✓ · typecheck 6/6 — todo verde.

**Estado: los 14 P1 y los 2 P0 están cerrados.** Quedan 51 P2 y 102 P3.

---


# P0 (2)

### [S1-01] ✅ FIXEADO — Account takeover total del vecino vía POST /auth/claim: cualquiera con el número de teléfono obtiene un bearer de 10 años, PII y borrado de la cuenta ajena
- **Sector:** S1 · lentes 2, 4, 9, 14
- **Causa raíz:** Por qué toma la cuenta: findOne({appId,telefono}) recupera la cuenta y firma un token para ella. → Por qué sin verificar: el diseño 'sin fricción' delega la verificación al cajero presencial ('el cajero confirma en persona', user-auth.ts:15-16). → Por qué eso no protege: el endpoint es una API pública que mintea un bearer server-side ANTES de cualquier acto presencial; el control humano nunca toca la API. → Por qué es grave: la identidad del vecino es ÚNICAMENTE el teléfono (User.ts:10-12) y no 
- **Evidencia:** `apps/api/src/routes/user-auth.ts:45`, `apps/api/src/routes/user-auth.ts:64`, `apps/api/src/routes/user-auth.ts:20`, `apps/api/src/routes/user-auth.ts:100`
- **Fix sugerido:** El teléfono no puede ser credencial por sí solo. Mínimo: verificar posesión (OTP por SMS/WhatsApp al número, o confirmación del cajero que emita el token en el POS con auth de comercio) antes de emitir un token de larga vida sobre una cuenta EXISTENTE; para cuentas nuevas está OK crear liviano. Alternativa de bajo cambio: /claim solo CREA (nunca 'recupera' una cuenta existente devolviendo su token

### [S2-01] ✅ FIXEADO — support-session sin gate de rol: un owner 'viewer' (solo-lectura) obtiene una sesión de comercio con permisos de ESCRITURA (escalada de privilegios)
- **Sector:** S2 · lentes 5, 4
- **Causa raíz:** ¿Por qué un viewer puede escribir en un comercio? Porque support-session no chequea rol. ¿Por qué? Porque el comentario del handler dice 'Cualquier owner puede (decisión de producto)' y se aplicó literal a TODOS los roles. ¿Por qué eso es un bug? Porque 'modo soporte' se pensó para el rol 'soporte', pero el gate se puso a nivel de autenticación, no de autorización. ¿Por qué no se detectó? Porque el poder real (mutar el comercio) se materializa recién en otro servicio (support-exchange en merchan
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/owner.ts:884`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/models/Owner.ts:46`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/models/Owner.ts:52`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:427`


# P1 (14)

### [S1-02] ✅ FIXEADO — normalizeTelefono está hardcodeado a reglas de Argentina y rompe la identidad (recuperar el ahorro en otro celular) para las ciudades no-argentinas del pivote Mi Ciudad
- **Sector:** S1 · lentes 7, 8, 2, 3
- **Causa raíz:** Por qué fragmenta: normalizeTelefono asume convención AR. → Por qué importa: Mi San Pedro pivoteó a Mi[Ciudad] multi-país (TenantConfig.pais/moneda/locale, país Colombia en memoria). → Por qué no se adaptó: la función vive en packages/shared sin conocer el tenant/país del request. → Causa terminal: una regla de normalización específica de un país se aplica a un modelo multi-país, y como el teléfono ES la clave de identidad, cualquier discrepancia parte o fusiona cuentas.
- **Evidencia:** `packages/shared/src/schemas.ts:96`, `apps/api/src/models/User.ts:30`, `apps/web/src/lib/tenant.ts:87`
- **Fix sugerido:** Normalizar en función del país del tenant (libphonenumber-js con la región del App), o guardar el E.164 completo como identidad y no intentar 'adivinar' prefijos. Como mínimo, pasar phonePrefix/pais del tenant a normalizeTelefono y ramificar por país.

### [S1-04] ✅ FIXEADO — Códigos OTP en texto plano en los logs de PRODUCCIÓN (comercio y owner) — bearer-equivalente de 5 min visible a cualquiera con acceso a logs
- **Sector:** S1 · lentes 14, 12
- **Causa raíz:** Por qué se filtra: se dejó un console.log de debug del código sin condicionar a !isProd. → Por qué pasó: se copió el patrón de dev donde ver el código en consola es cómodo. → Por qué es peligroso: el OTP es credencial temporal de acceso y los logs de prod no son secretos con ese nivel de protección. → Causa terminal: se trata un secreto (OTP) como dato de diagnóstico rutinario.
- **Evidencia:** `apps/api/src/routes/merchant-auth.ts:239`, `apps/api/src/routes/owner.ts:116`

### [S2-02] ✅ FIXEADO — La sesión de soporte (impersonation) del comercio no expira nunca y su /refresh nunca revalida al owner (enabled/rol): un owner deshabilitado o degradado conserva acceso total al panel del comercio de forma indefinida
- **Sector:** S2 · lentes 4, 5, 9
- **Causa raíz:** ¿Por qué persiste el acceso? Porque el refresh de impersonation no revalida al owner. ¿Por qué? Porque el handler de /refresh se escribió para la sesión REAL del comercio (chequea estado del comercio) y el caso soporte se agregó como bypass del gate, sin sumar la contraparte (revalidar al impersonador). ¿Por qué no se copió el patrón del owner? Porque el sub del token es el MerchantUser, no el Owner, y 'quién soy' quedó desacoplado de 'quién me autoriza'. ¿Por qué el token no vence y fuerza rech
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:381`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:377`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/services/jwt.service.ts:109`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/owner.ts:219`

### [S2-03] ✅ FIXEADO — request-otp filtra el código OTP en la respuesta HTTP (_debugCode) en todo entorno que no sea NODE_ENV='production'; el guard tiene default inseguro ('development') sobre la MISMA DB de prod → toma de cuenta de cualquier comercio
- **Sector:** S2 · lentes 1, 12
- **Causa raíz:** ¿Por qué se expone el OTP? Porque la rama de debug se gatilla en todo lo no-'production'. ¿Por qué eso es riesgoso? Porque NODE_ENV tiene default 'development' (env.ts) y nada obliga a setearlo en prod. ¿Por qué llega a la DB real? Porque connection.ts hardcodea dbName:'misanpedro', el mismo de prod, y el .env local apunta al mismo cluster. ¿Por qué convive un canal de debug con datos reales? Porque la costura demo/dev vs prod se decide por una sola variable con default inseguro, sin fail-safe. 
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:279`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:254`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/env.ts:4`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/db/connection.ts:16`
- **Fix sugerido:** No devolver el código NUNCA por HTTP; usar el log del stub de email para dev. Si se conserva, gatear por isProd (env validado) y además por una flag explícita ALLOW_DEBUG_OTP que sea false por defecto y prohibida cuando MONGODB_URI apunte a prod. Considerar fail-closed: si NODE_ENV no está seteado explícitamente, comportarse como prod.

### [S3-01] ✅ FIXEADO — support-session no tiene gate de rol: un 'viewer' (solo lectura) puede impersonar al admin de CUALQUIER comercio y escribir
- **Sector:** S3 · lentes 5, 4
- **Causa raíz:** ¿Por qué un viewer puede escribir? Porque support-session no valida rol. ¿Por qué? El comentario (owner.ts:880-882) declara 'Cualquier owner puede (decisión de producto)'. ¿Por qué se asumió inocuo? Porque se pensó como 'entrar a mirar', pero el código canjeado mintea una sesión merchant_user de rol 'admin' con WRITE (merchant-auth.ts:427-433), sin degradar a lectura. ¿Por qué eso rompe RBAC? Porque el contrato del rol viewer ('Solo lectura', rbac.ts:15) es una garantía de seguridad y este surfa
- **Evidencia:** `apps/api/src/routes/owner.ts:884`, `apps/api/src/routes/merchant-auth.ts:427`, `apps/owner/src/lib/rbac.ts:15`

### [S3-02] ✅ FIXEADO — El código OTP del owner se escribe en texto plano en los logs del servidor SIEMPRE (también en producción)
- **Sector:** S3 · lentes 1, 14
- **Causa raíz:** ¿Por qué el OTP está en logs de prod? Porque el console.log corre antes del `if (NODE_ENV==='production')`. ¿Por qué se dejó? Era un helper de debug local (ver el código sin mail). ¿Por qué no se gateó? Se gateó la RESPUESTA HTTP (_debugCode solo en dev) pero se olvidó el log del servidor. Causa terminal: se protegió el canal de salida al cliente pero no el canal de logs, que en un SaaS con logs centralizados es igual de sensible.
- **Evidencia:** `apps/api/src/routes/owner.ts:116`

### [S3-04] ✅ FIXEADO — requireOwnerAuth nunca verifica Owner.enabled: deshabilitar (o eliminar) un owner NO corta su acceso durante ≤1h; puede re-habilitarse solo
- **Sector:** S3 · lentes 5, 9
- **Causa raíz:** ¿Por qué un owner deshabilitado sigue operando? Porque el access no se valida contra estado en cada request. ¿Por qué? Se optó por no pegarle a la DB por request (perf) y confiar en refresh (≤1h) para propagar cambios. ¿Por qué es insuficiente? Porque el access es un bearer autónomo: revocar refresh no lo mata, y endpoints de alto poder (/admins) no re-leen enabled ni rol de DB. Solo refresh (220), support-session (889) y revoke-support (939) re-chequean enabled. Causa terminal: no hay lista de 
- **Evidencia:** `apps/api/src/middleware/auth.ts:75`, `apps/api/src/routes/owner.ts:356`, `apps/api/src/services/jwt.service.ts:196`

### [S4-01] ✅ FIXEADO — Deshabilitar/eliminar a un owner NO corta sus sesiones de soporte vivas → acceso de escritura eterno al comercio
- **Sector:** S4 · lentes 4, 9, 6
- **Causa raíz:** ¿Por qué sigue vivo? Porque revokeAllForSubject filtra por subjectId. ¿Por qué no matchea? Porque los refresh de soporte tienen subjectId=merchantUserId e impersonatedBy=ownerId (campo separado), no subjectId=ownerId. ¿Por qué al disable se llama revokeAllForSubject(ownerId)? Porque la revocación del owner asume que sus sesiones están keadas por su propio id. ¿Por qué el /refresh no lo frena? Porque re-mintea impersonatedBy sin re-validar Owner.enabled (solo re-chequea el estado del MERCHANT). ¿
- **Evidencia:** `apps/api/src/services/jwt.service.ts:197`, `apps/api/src/routes/owner.ts:356`, `apps/api/src/routes/merchant-auth.ts:394`, `apps/api/src/services/jwt.service.ts:109`

### [S4-02] ✅ FIXEADO — Cualquier rol de owner (incl. viewer/finanzas read-only) puede impersonar un comercio con escritura total
- **Sector:** S4 · lentes 5, 4
- **Causa raíz:** ¿Por qué un viewer puede escribir? Porque support-session no tiene requireOwnerRole. ¿Por qué no lo tiene? Por la decisión de producto 'cualquier owner puede' documentada en el código. ¿Por qué es escalada? Porque esa decisión no se reconcilió con la matriz de roles donde viewer=solo lectura y finanzas no opera comercios. ¿Causa terminal? La impersonación se gateó solo por autenticación (requireOwnerAuth), no por autorización, pese a otorgar la credencial más poderosa del sistema (write full sob
- **Evidencia:** `apps/api/src/routes/owner.ts:884`, `apps/api/src/routes/owner.ts:858`, `apps/owner/src/pages/MerchantsPage.tsx:220`

### [S9-01] ✅ FIXEADO — POST /wa/campaign bloquea el HTTP durante TODA la campaña (hasta ~29 min) → timeout, error falso en UI mientras el server sigue, y reintento = doble envío + doble cupo
- **Sector:** S9 · lentes 6,9,10
- **Causa raíz:** sendCampaign() itera secuencialmente con sleep(2000+rand*3000) y el handler hace `await wa.sendCampaign(...)` antes de responder → el tiempo de respuesta HTTP == duración total del envío. Por qué: se ató la respuesta a la finalización. Por qué: se reusó el patrón request/response en vez de disparar async y reportar sólo por SSE. Por qué: el SSE (que ya existe para progreso/done) no se usó como canal terminal; el POST se quedó como fuente de verdad. Causa terminal: acoplamiento respuesta-HTTP↔tra
- **Evidencia:** `apps/api/src/routes/whatsapp.ts:189`, `apps/api/src/services/whatsapp.service.ts:341`, `apps/web/src/pages/admin/AdminWhatsappPage.tsx:453`, `apps/web/src/lib/api.ts:145`
- **Fix sugerido:** Convertir /campaign en 202-async: crear el campaignId, responder de inmediato con {campaignId, total} y reportar progreso/fin SOLO por SSE (campaign.progress/done). El front debe cerrar la fase con el evento campaign.done, no con el resolve del POST. Agregar idempotency-key para bloquear reintentos del mismo lote.

### [S9-07] ✅ FIXEADO — toChatId no normaliza a formato internacional (E.164): números guardados en formato local fallan todos los envíos
- **Sector:** S9 · lentes 8
- **Causa raíz:** Se asumió que el número almacenado ya viene en formato WA. Por qué: el onboarding valida sólo min(10) dígitos (shared schema) sin normalizar país. Causa terminal: no hay una capa única de normalización E.164 entre el dato de contacto y toChatId.
- **Evidencia:** `apps/api/src/services/whatsapp.service.ts:234`, `apps/web/src/pages/admin/AdminWhatsappPage.tsx:441`, `packages/shared/src/schemas.ts:70`
- **Fix sugerido:** Centralizar normalización a E.164 (asumir país AR por tenant/config, agregar 549 a móviles) y validar antes de enviar; reportar los no-normalizables como skipped, no como enviados.

### [S10-01] ✅ FIXEADO — Historial de notificaciones del comercio en localStorage NO está scopeado por comercio/tenant → fuga de PII entre cuentas en dispositivo compartido
- **Sector:** S10 · lentes 2, 3, 4, 6
- **Causa raíz:** ¿Por qué B ve datos de A? Porque loadStored() lee una clave de localStorage compartida. ¿Por qué compartida? Porque STORAGE_KEY es la constante 'misanpedro.merchant.notif.v1' (useMerchantNotifications.ts:30), sin slug de tenant ni merchantId — a diferencia de lib/alerts.ts que sí scopea por slug (msp.alerts.v2.${slug}). ¿Por qué no se limpia en logout? Porque merchantStore.logout() solo hace tokens.clear('merchant') (borra access/refresh) y no toca la clave de notif. ¿Por qué nadie la limpia? No
- **Evidencia:** `apps/web/src/lib/useMerchantNotifications.ts:30`, `apps/web/src/lib/useMerchantNotifications.ts:57`, `apps/web/src/lib/merchantStore.ts:222`

### [S11-01] ✅ FIXEADO — Suscripción cancelada/pausada/impaga deja al comercio 'activo' para siempre (no hay reconciliación estado suscripción → estado comercio)
- **Sector:** S11 · lentes 9, 6, 2
- **Causa raíz:** ¿Por qué mantiene acceso? Porque merchant.estado nunca cambia al cancelar. ¿Por qué? billing.ts /cancel solo setea sub.status='cancelled'. ¿Por qué no baja el estado al fin de período? No hay reconciliador que lea Subscription.status/nextBillingAt y actualice Merchant.estado. ¿Por qué? expiry.service.ts solo barre cupones; el webhook (billing.ts:110-115) SOLO hace la transición pending_payment→activo (nunca la inversa). Causa terminal: el ciclo de vida de la suscripción y el de acceso del comerc
- **Evidencia:** `apps/api/src/routes/billing.ts:243`, `apps/api/src/routes/billing.ts:259`, `apps/api/src/routes/billing.ts:110`, `apps/api/src/middleware/auth.ts:143`

### [S14-02] ✅ FIXEADO — dbName hardcodeado 'misanpedro' + escrituras en el boot → arrancar el API local muta la MISMA base de prod (incluye drop de índices)
- **Sector:** S14 · lentes 1,2,9
- **Causa raíz:** 1) ¿Por qué escribe en prod al bootear localmente? Porque connectDB ignora la base del URI y usa 'misanpedro'. 2) ¿Por qué el URI local llega a Atlas? Porque el .env de dev comparte la connection string con prod. 3) ¿Por qué el boot escribe? Porque el arranque acopla side-effects mutativos (seed/index-sync/loops) al connect. 4) ¿Por qué es peligroso? Porque no hay separación de base ni guard read-only por entorno. 5) Causa terminal: un único cluster/base para dev y prod sin aislamiento ni gate d
- **Evidencia:** `apps/api/src/db/connection.ts:16`, `apps/api/src/db/connection.ts:26`, `apps/api/src/index.ts:377`


# P2 (51)

### [S1-03] ⬜ pendiente — Rate limiting bypasseable: el key confía en el X-Forwarded-For MÁS A LA IZQUIERDA (spoofeable) → anula todos los limiters y habilita brute-force del OTP de comercio y de OWNER
- **Sector:** S1 · lentes 9, 12, 14
- **Causa raíz:** Por qué es spoofeable: se toma el primer elemento del XFF como fuente de verdad de la IP. → Por qué el primero es del atacante: los proxies (Railway/Render) APPENDEAN la IP real a la derecha; el cliente puede prefijar cualquier cosa. → Por qué nadie lo detecta: el limiter es in-memory y 'parece' funcionar en tests locales sin proxy (ahí usa el User-Agent). → Causa terminal: se confió en un header controlable por el cliente para la clave de rate-limit, patrón clásico de bypass.
- **Evidencia:** `apps/api/src/middleware/security.ts:75`, `apps/api/src/routes/merchant-auth.ts:206`, `apps/api/src/routes/owner.ts:89`
- **Fix sugerido:** No confiar en el XFF izquierdo: derivar la IP del cliente como el elemento a la derecha según la cantidad de hops de confianza del proxy (o usar el connection remote address que setea la plataforma). Además mover el rate-limit de OTP a una clave por email/cuenta (no sólo por IP) y persistirlo fuera de memoria si hay múltiples instancias.

### [S1-05] ⬜ pendiente — Sesión zombie / skeleton infinito del vecino con token de otra ciudad: /auth/me responde 403 (tenant mismatch) pero el front sólo limpia en 401 → el token nunca se limpia ni hay 'Salir'
- **Sector:** S1 · lentes 6, 4, 2
- **Causa raíz:** Por qué queda zombie: el limpiado de sesión del vecino sólo se dispara con status===401. → Por qué el back manda 403: sameTenant devuelve 'tenant mismatch' (403), no 401, cuando el appId del token != appId del request. → Por qué el token cruza de ciudad: se persiste por origen y no por tenant, y el selector permite varias ciudades en un mismo origen. → Causa terminal: desalineación entre el código de error del backend (403 para mismatch de tenant) y la única condición de limpieza del frontend (4
- **Evidencia:** `apps/web/src/components/ApiSync.tsx:80`, `apps/api/src/middleware/auth.ts:57`, `apps/web/src/pages/PerfilPage.tsx:30`, `apps/web/src/pages/PerfilPage.tsx:107`
- **Fix sugerido:** En ApiSync/request tratar 403 'tenant mismatch' del vecino igual que un 401 (limpiar token + signOut) o, mejor, scopear el storage de tokens del vecino por tenant (msp.tok.user.<slug>.*) para que cambiar de ciudad no arrastre un token ajeno. Ofrecer además un 'Salir' explícito en Perfil.

### [S1-06] ⬜ pendiente — _debugCode del OTP se devuelve en la respuesta HTTP cuando NODE_ENV != production, y la DB es la MISMA que prod (dbName hardcodeado) → una instancia local puede loguear cuentas reales de prod
- **Sector:** S1 · lentes 1, 12, 14
- **Causa raíz:** Por qué se expone: el gate es NODE_ENV, no el aislamiento de datos. → Por qué alcanza prod: connection.ts:16 fuerza dbName 'misanpedro' y el entorno local comparte cluster con prod (gotcha conocido). → Por qué es explotable: el código en la respuesta + la misma DB colapsan la frontera dev/prod. → Causa terminal: un ayudante de debug (código en la respuesta) se combina con una costura de datos (base compartida) para volverse un bypass de auth de prod.
- **Evidencia:** `apps/api/src/routes/merchant-auth.ts:279`, `apps/api/src/routes/owner.ts:145`, `apps/api/src/db/connection.ts:16`
- **Fix sugerido:** Nunca devolver el código en la respuesta; para tests usar un hook/inyección controlada. Y separar la base local de la de prod (no hardcodear dbName; derivarlo del URI por entorno).

### [S2-04] ⬜ pendiente — Carrera en /signup: chequeo de email no atómico y Merchant.create ANTES de MerchantUser.create → comercio 'activo' HUÉRFANO (sin usuario) y 500 al request perdedor
- **Sector:** S2 · lentes 9, 2
- **Causa raíz:** ¿Por qué queda un comercio huérfano? Porque el Merchant se persiste antes que el usuario y la unicidad solo se garantiza en el usuario. ¿Por qué? Porque no hay transacción ni upsert atómico que abarque ambos documentos. ¿Por qué se confió en el exists previo? Porque se asumió serialización de requests, sin considerar doble-submit/carrera. ¿Por qué el dup-key no se maneja? Porque no hay try/catch específico que limpie el Merchant creado ni traduzca a 409. Causa terminal: una invariante de negocio
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:60`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:83`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:115`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/models/MerchantUser.ts:21`
- **Fix sugerido:** Crear el MerchantUser (o al menos reservar la unicidad de email) ANTES del Merchant, o envolver ambos en una transacción Mongo (sesión) con abort/cleanup. Capturar E11000 y devolver 409 'email ya registrado'. Para slug: en colisión de índice, reintentar con sufijo incremental en lugar de 500.

### [S2-05] ⬜ pendiente — Rate-limit bypass: clientKey usa el PRIMER IP de X-Forwarded-For (spoofeable) y en dev usa User-Agent; buckets in-memory por proceso — afecta signup, request-otp y verify-otp
- **Sector:** S2 · lentes 9, 12
- **Causa raíz:** ¿Por qué se evade el límite? Porque la identidad del cliente se toma de un header controlable por el cliente. ¿Por qué se eligió [0]? Porque se asumió que el IP más a la izquierda es el 'cliente real', válido solo si el borde REEMPLAZA el header, no si lo append-ea. ¿Por qué no se usa el IP del socket / el índice desde la derecha según nº de proxies confiables? Porque no se modeló la topología de proxy. ¿Por qué el fallback es UA? Porque en dev no hay proxy y se buscó 'algo mejor que nada', pero
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/api/src/middleware/security.ts:76`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/middleware/security.ts:80`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/middleware/security.ts:63`
- **Fix sugerido:** Derivar el IP de forma confiable: usar el IP del socket o parsear XFF desde la derecha descartando el nº de hops confiables conocidos del proxy. En dev, keyear por IP de socket, no por UA. Para producción real, mover el rate-limit a un store compartido (Redis) para que sea consistente entre instancias.

### [S2-06] ⬜ pendiente — El refresh del comercio no rota y no expira nunca: un refresh token filtrado da acceso permanente y la detección de reuso no aplica al sujeto merchant
- **Sector:** S2 · lentes 4
- **Causa raíz:** ¿Por qué el token filtrado sirve para siempre? Porque no rota ni vence. ¿Por qué se decidió así? Para que la sesión de caja no se cierre por respuestas de red perdidas (la rotación arriesgaba logout por falso-reuso). ¿Por qué eso desactiva la anti-robo? Porque la detección de reuso depende de la rotación. Causa terminal: se priorizó la continuidad de sesión sobre la contención de credenciales, sin un mecanismo alternativo (binding a dispositivo, expiración larga con re-auth, revocación proactiva
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:362`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/services/jwt.service.ts:110`
- **Fix sugerido:** Aun manteniendo sesión persistente, poner un vencimiento largo (p.ej. 90 días con renovación silenciosa) y/o binding del refresh a un fingerprint de dispositivo; ofrecer al comercio 'cerrar sesión en todos los dispositivos' visible; registrar y alertar refresh desde IP/UA nuevos.

### [S3-03] ⬜ pendiente — Magic-link del owner mete email+OTP como query string REAL (BrowserRouter) → queda en historial, barra de direcciones y logs de proxy; la URL nunca se limpia
- **Sector:** S3 · lentes 12, 15
- **Causa raíz:** ¿Por qué el código viaja en la URL al server? Porque el owner es BrowserRouter y el helper de magic-link se diseñó/comentó para HashRouter (vecino/comercio). ¿Por qué no se distinguió? El mismo buildOtpMagicLink se reusa para los 3 sujetos sin considerar que el owner NO usa hash. ¿Por qué agrava? LoginPage no scrubbea la query tras usarla. Causa terminal: suposición de router incorrecta para el owner + falta de limpieza de URL, exponiendo la credencial en superficies de logging/historial que el 
- **Evidencia:** `apps/api/src/services/email.service.ts:273`, `apps/owner/src/App.tsx:19`, `apps/owner/src/pages/LoginPage.tsx:43`
- **Fix sugerido:** Para el owner, poner el magic-link tras el hash (…/#/login?…) o usar un token opaco de un solo uso en el path en vez del OTP; y en LoginPage hacer window.history.replaceState para borrar email/code de la URL apenas se consumen.

### [S3-05] ⬜ pendiente — Guard 'último super' con carrera TOCTOU (countDocuments + save no atómico): dos requests concurrentes pueden dejar la plataforma sin ningún super
- **Sector:** S3 · lentes 9
- **Causa raíz:** ¿Por qué se llega a 0 supers si hay un guard? Porque el check (count) y la mutación (save) no son una transacción atómica. ¿Por qué? Se implementó como lectura-luego-escritura sin condición en el update. ¿Por qué falla bajo concurrencia? Clásico TOCTOU: cada request ve el mundo previo a la escritura del otro. Causa terminal: falta de atomicidad/condición (p.ej. update condicional o transacción) sobre el invariante 'al menos 1 super habilitado'.
- **Evidencia:** `apps/api/src/routes/owner.ts:344`, `apps/api/src/routes/owner.ts:353`
- **Fix sugerido:** Hacer la operación atómica: findOneAndUpdate con filtro que garantice el invariante, o correr count+update en una transacción Mongo (session), o un unique/guard a nivel de invariante. Como mínimo, re-contar dentro de la misma transacción tras el update y abortar si quedaría 0.

### [S3-06] ⬜ pendiente — GET /owner/metrics expone MRR/facturación a TODOS los roles, incluido 'soporte' que explícitamente no debe ver pagos
- **Sector:** S3 · lentes 5, 3
- **Causa raíz:** ¿Por qué soporte ve MRR? Porque /metrics no aplica gate de rol ni ramifica por rol como sí hace /stats. ¿Por qué la inconsistencia? El manejo 'soporte no ve pagos' se implementó ad-hoc en /stats (509) y en el gate de mrr-trend (518), pero /metrics —endpoint anterior/paralelo— quedó sin la misma regla. Causa terminal: la política 'soporte no ve pagos' no está centralizada; cada endpoint la reimplementa (o la olvida), y /metrics la omite.
- **Evidencia:** `apps/api/src/routes/owner.ts:467`, `apps/api/src/routes/owner.ts:495`, `apps/api/src/routes/owner.ts:508`
- **Fix sugerido:** Aplicar el mismo criterio que /stats: quitar/enmascarar revenue cuando auth.rol==='soporte' en /metrics, o gatearlo con requireOwnerRole('super','admin','finanzas','viewer'). Idealmente centralizar la política 've pagos' en un helper único.

### [S3-08] ⬜ pendiente — PATCH /admins/:id permite auto-deshabilitarse / auto-degradarse (DELETE sí bloquea el auto-borrado): foot-gun de lockout asimétrico
- **Sector:** S3 · lentes 5, 9
- **Causa raíz:** ¿Por qué PATCH deja auto-deshabilitarse? Porque solo tiene el guard 'último super', no un guard 'no sobre sí mismo'. ¿Por qué DELETE sí lo tiene y PATCH no? Se agregó la protección de auto-acción solo en el path de borrado (382), no se replicó en el de edición. Causa terminal: reglas de auto-protección implementadas de forma inconsistente entre endpoints equivalentes.
- **Evidencia:** `apps/api/src/routes/owner.ts:382`, `apps/api/src/routes/owner.ts:352`
- **Fix sugerido:** Replicar en PATCH la guarda de auto-acción: prohibir que un owner se deshabilite/degrade a sí mismo (o al menos advertir/confirmar), igual que ya hace DELETE.

### [S4-03] ⬜ pendiente — Las LECTURAS de PII durante impersonación no quedan auditadas
- **Sector:** S4 · lentes 14, 5
- **Causa raíz:** ¿Por qué no se audita? Porque el middleware retorna temprano si el método no está en MUTATING. ¿Por qué solo mutaciones? Porque se consideró que 'acción sobre el comercio' = cambio de estado. ¿Por qué es problema? Porque en impersonación la lectura de PII de terceros (clientes del comercio) es en sí una acción sensible que exige trazabilidad. ¿Causa terminal? El modelo de auditoría equipara 'acción' con 'mutación' e ignora que la impersonación expone lectura de datos personales de clientes.
- **Evidencia:** `apps/api/src/middleware/auditImpersonation.ts:4`, `apps/api/src/middleware/auditImpersonation.ts:19`, `apps/api/src/routes/redemptions.ts:395`
- **Fix sugerido:** Auditar también GETs sensibles bajo impersonación (al menos /redemptions/clientes*, exports y stats), o registrar la apertura de sesión de soporte con un scope y loggear un resumen de accesos. Alternativa mínima: marcar en OwnerAuditLog la sesión y su ventana de actividad.

### [S4-04] ⬜ pendiente — La auditoría de mutaciones impersonadas es fire-and-forget con error tragado (pérdida silenciosa de rastro)
- **Sector:** S4 · lentes 14, 9
- **Causa raíz:** ¿Por qué se pierde? Porque el create es best-effort y su error se descarta. ¿Por qué best-effort? Por el objetivo explícito 'la auditoría nunca debe romper la request'. ¿Por qué eso rompe la garantía? Porque no hay durabilidad (retry, cola, dead-letter) ni siquiera log del fallo. ¿Causa terminal? Se priorizó no agregar latencia/errores por sobre la integridad del audit trail, dejando la auditoría de impersonación sin ninguna garantía de escritura.
- **Evidencia:** `apps/api/src/middleware/auditImpersonation.ts:27`, `apps/api/src/middleware/auditImpersonation.ts:36`
- **Fix sugerido:** Como mínimo console.error/captureException del fallo de auditoría (para detectarlo) en vez de .catch(()=>{}). Para acciones impersonadas (alto poder) evaluar escritura sincrónica o cola con reintento; si la auditoría es requisito de compliance, considerar bloquear la mutación cuando el audit no puede persistir.

### [S4-05] ⬜ pendiente — requireMerchantActive contradice el soporte a comercios suspendidos/cancelados ('entrar a arreglarlo')
- **Sector:** S4 · lentes 3, 6
- **Causa raíz:** ¿Por qué falla la promesa? Porque hay dos capas con políticas opuestas: exchange/refresh permiten impersonación en suspendido; requireMerchantActive la niega. ¿Por qué requireMerchantActive la niega? Porque chequea Merchant.estado sin excepción para impersonatedBy. ¿Por qué existe la excepción en refresh y no acá? Porque el bypass se agregó solo en la capa de sesión, no en la de autorización operativa. ¿Causa terminal? La condición 'impersonatedBy relaja el gate de estado' se implementó en un lu
- **Evidencia:** `apps/api/src/routes/merchant-auth.ts:381`, `apps/api/src/middleware/auth.ts:136`, `apps/api/src/routes/redemptions.ts:130`
- **Fix sugerido:** En requireMerchantActive, permitir pasar cuando auth.impersonatedBy está presente (coherente con exchange/refresh), o documentar/limitar explícitamente qué puede hacer soporte en un comercio suspendido. Definir UNA política de estado y aplicarla en un solo lugar.

### [S4-06] ⬜ pendiente — La sesión de soporte no vence nunca (sin time-box absoluto): credencial de escritura total permanente
- **Sector:** S4 · lentes 9, 4
- **Causa raíz:** ¿Por qué no vence? Porque hereda el modelo 'sesión persistente del comercio' (refresh 2099, no rota). ¿Por qué lo hereda? Porque support-exchange llama issueRefreshToken con subjectType:'merchant_user' sin neverExpires:false. ¿Por qué es riesgoso? Porque una sesión de impersonación de alto privilegio debería estar acotada en el tiempo, no ser permanente. ¿Causa terminal? Se reutilizó el token de sesión larga del panel para la impersonación en vez de un token de soporte de vida corta con renovaci
- **Evidencia:** `apps/api/src/services/jwt.service.ts:18`, `apps/api/src/services/jwt.service.ts:110`, `apps/api/src/routes/merchant-auth.ts:434`
- **Fix sugerido:** Emitir el refresh de soporte con neverExpires:false y un TTL corto (ej. 30-60 min) acorde a una sesión de soporte; renovar exige re-generar código desde el owner. Esto también acota S4-01 y S4-07.

### [S4-07] ⬜ pendiente — 'Salir' del banner de soporte no espera la revocación antes de cerrar la pestaña → el refresh (eterno) puede sobrevivir en el server
- **Sector:** S4 · lentes 9, 14
- **Causa raíz:** ¿Por qué sobrevive el token? Porque el POST /logout se aborta al cerrar la pestaña. ¿Por qué se aborta? Porque salir() no hace await de logout() antes de window.close(). ¿Por qué importa acá y no en un logout normal? Porque la sesión de soporte no expira sola (S4-06): si el /logout no corre, no hay red de contención. ¿Causa terminal? Cierre de pestaña compitiendo con un logout asíncrono no esperado, sobre un tipo de sesión sin expiración de respaldo.
- **Evidencia:** `apps/web/src/components/SupportBanner.tsx:19`, `apps/web/src/lib/merchantStore.ts:223`, `apps/web/src/lib/api.ts:347`
- **Fix sugerido:** Hacer salir() async y await merchantAuth.logout() (o usar navigator.sendBeacon para el logout) ANTES de window.close()/navigate. Combinar con S4-06 (TTL corto) como respaldo.

### [S5-02] ⬜ pendiente — Segunda superficie cross-tenant (routes/admin.ts) además del owner, con token estático compartido, sin RBAC ni auditoría
- **Sector:** S5 · lentes 2, 4, 5
- **Causa raíz:** ¿Por qué hay dos cross-tenant? Porque admin.ts es el super-admin legacy previo al Owner Panel con RBAC. ¿Por qué sigue montado? Porque nunca se removió al construir owner.ts. ¿Por qué es riesgoso? Porque duplica capacidades del owner con auth mucho más débil (bearer estático global vs OTP+RBAC+audit). ¿Por qué no se ve? Porque ningún front lo llama, así que pasa desapercibido en pruebas manuales. Causa terminal: deuda de una superficie de administración vieja no desmantelada, que rompe el invari
- **Evidencia:** `apps/api/src/index.ts:134`, `apps/api/src/routes/admin.ts:23`, `apps/api/src/routes/admin.ts:94`, `apps/api/src/routes/admin.ts:154`
- **Fix sugerido:** Desmontar adminRoutes (borrar la línea de index.ts) y migrar cualquier uso a /owner con RBAC. Si se quiere conservar como break-glass, gatear detrás de un flag explícito + IP allowlist + escribir en OwnerAuditLog, y NUNCA con el default '' que silenciosamente lo deja 503 (falsa sensación de que está apagado cuando basta setear la env para revivirlo sin controles).

### [S5-03] ⬜ pendiente — Link de referido no es tenant-aware: usa env.APP_URL_FRONT global en vez de tenantFrontUrl(tenant) -> referidos rotos entre ciudades
- **Sector:** S5 · lentes 3, 2
- **Causa raíz:** ¿Por qué el link va a la ciudad equivocada? Porque usa la constante global APP_URL_FRONT. ¿Por qué no usa tenantFrontUrl? Porque referrals.ts no se migró cuando se introdujo lib/urls.ts:tenantFrontUrl (billing.ts sí). ¿Por qué se rompe el crédito? Porque el referralCode es único POR TENANT (índice {appId, referralCode}) y el signup resuelve tenant por X-Tenant-Slug del host de destino, que en el link global no es la ciudad del referidor. Causa terminal: migración incompleta a URLs por-tenant; un
- **Evidencia:** `apps/api/src/routes/referrals.ts:47`, `apps/api/src/routes/billing.ts:175`, `apps/api/src/lib/urls.ts:20`, `apps/api/src/routes/merchant-auth.ts:129`
- **Fix sugerido:** Reemplazar env.APP_URL_FRONT por tenantFrontUrl(c.get('tenant')) en referrals.ts:47, igual que billing.ts. Revisar cualquier otro CTA outward-facing que arme URLs con APP_URL_FRONT y no sea single-tenant.

### [S6-01] ⬜ pendiente — GET /merchants/:slug usa un serializeCoupon STALE (subset): en la ficha del comercio los cupones pierden precio/valor y límite de uso
- **Sector:** S6 · lentes 3 (contrato FE/BE roto), 6
- **Causa raíz:** ¿Por qué el valor sale mal? Porque el coupon que recibe MerchantDetailPage viene de /merchants/:slug. ¿Por qué le faltan campos? Porque ese endpoint usa un serializeCoupon LOCAL (merchants.ts:280) que es un subset viejo: no incluye precioReferencia/precioFijo/tipoOferta/alcance/mostrarAhorroVecino/productoGancho/franja*/usoMaxPorPersona/usoVentana. ¿Por qué existe un subset? Porque hay DOS serializers divergentes para el mismo ApiCoupon y solo el de coupons.ts:13 se mantuvo canónico. ¿Por qué no
- **Evidencia:** `apps/api/src/routes/merchants.ts:280`, `apps/api/src/routes/merchants.ts:276`, `apps/web/src/lib/apiCoupon.ts:26`, `apps/web/src/pages/MerchantDetailPage.tsx:85`
- **Fix sugerido:** Reutilizar el serializeCoupon canónico de coupons.ts (exportado) en merchants.ts:276 (con includePrivate:false), y borrar el serializeCoupon local (merchants.ts:280) y el apiCouponToLocal duplicado de MapaPage.tsx:32. Así /coupons, /merchants/:slug y el mapa comparten el mismo contrato.

### [S6-02] ⬜ pendiente — MisCuponesPage: cupón activo cuyo comercio se suspende (o cupón pausado/vencido/borrado) queda como skeleton gris PERMANENTE en 'Mis cupones'
- **Sector:** S6 · lentes 6 (estado no manejado / skeleton infinito), 1 (costura demo/prod), 3
- **Causa raíz:** ¿Por qué queda skeleton? Porque MisCuponesPage resuelve el cupón con getCoupon(couponMap) y el comercio con getMerchantBySlug, y si falta cualquiera retorna <skeleton>. ¿Por qué falta? Porque couponMap se arma SOLO desde el catálogo público activo (/coupons) y en PROD el mock local se saltea (línea 37); un cupón pausado o de comercio suspendido no está en ese listado. ¿Por qué no usa el snapshot? Porque, a diferencia de CanjeadosPage (c?.titulo ?? r.couponTitulo), MisCuponesPage ignora los campo
- **Evidencia:** `apps/web/src/pages/MisCuponesPage.tsx:214`, `apps/web/src/pages/MisCuponesPage.tsx:37`, `apps/web/src/lib/syncActivations.ts:35`, `apps/web/src/pages/CanjeadosPage.tsx:168`
- **Fix sugerido:** En MisCuponesPage usar el fallback al snapshot igual que CanjeadosPage: titulo = c?.titulo ?? a.couponTitulo, porcentaje = c?.porcentaje ?? a.couponPorcentaje, merchant = m ?? {nombre:a.merchantNombre, categoria:a.merchantCategoria}. Solo mostrar skeleton mientras isLoading; si ya cargó y no hay ni catálogo ni snapshot, degradar a una card mínima, no a un pulse eterno.

### [S6-03] ⬜ pendiente — GET /coupons/:id no filtra estado del cupón ni del comercio: expone cupones pausado/agotado/vencido y comercios suspendido/cancelado por id directo
- **Sector:** S6 · lentes 2/5 (regla de visibilidad inconsistente), 6
- **Causa raíz:** ¿Por qué se expone? Porque /coupons/:id hace findOne({_id,appId}) sin estado y el merchant con findOne({_id,appId}) sin estado. ¿Por qué se escribió así? Porque se pensó como 'detalle público' asumiendo que solo se linkea desde el listado (que ya filtra), sin considerar acceso directo por id. ¿Por qué no explotó aún? Porque api.catalog.getCoupon existe pero NINGUNA página del FE lo llama (CuponDetailPage usa el listado /coupons) → es latente. Causa terminal: la regla de visibilidad (estado activ
- **Evidencia:** `apps/api/src/routes/coupons.ts:92`, `apps/api/src/routes/coupons.ts:74`, `apps/api/src/routes/merchants.ts:263`
- **Fix sugerido:** En /coupons/:id agregar estado:'activo' y vigenciaHasta:{$gte:new Date()} al findOne del cupón, y estado:'activo' al findOne del merchant (404 si el comercio no está activo). Idealmente extraer un helper couponVisibleFilter(appId) reutilizado por /coupons, /coupons/:id y /merchants/:slug.

### [S7-01] ⬜ pendiente — Endpoints /clientes y /clientes/notes (leer PII + crear/borrar notas) NO usan requireMerchantActive, contra la política documentada
- **Sector:** S7 · lentes 5 (RBAC solo front / gating por endpoint), 4 (estado de sujeto)
- **Causa raíz:** Por qué el suspendido accede → los handlers solo montan requireMerchantAuth. Por qué solo ese middleware → al agregar /confirm y /validate se puso requireMerchantActive ahí pero NO se replicó a /recent, /clientes ni /clientes/notes. Por qué no se replicó → no hay un test que verifique el gating por estado en esos endpoints, y el JSDoc de auth.ts (que sí los enumera) quedó como intención no implementada. Causa terminal: la política de 'endpoints operativos requieren estado activo' vive en un come
- **Evidencia:** `apps/api/src/routes/redemptions.ts:475`, `apps/api/src/routes/redemptions.ts:514`, `apps/api/src/routes/redemptions.ts:395`, `apps/api/src/middleware/auth.ts:121`
- **Fix sugerido:** Agregar requireMerchantActive a /clientes, /clientes/:userId/notes (GET), /clientes/notes (POST) y /clientes/notes/:id (DELETE), y decidir explícitamente si /recent debe gatear. Idealmente un test de integración que mande estado 'suspendido' y espere 403 en cada endpoint operativo. Nota mitigante: hoy el alta nace 'activo' (3 meses gratis), así que la exposición activa es baja, pero el estado 'sus

### [S7-02] ⬜ pendiente — Reintento de /confirm tras corte de red post-escritura muestra 'ya canjeado' como error (no como éxito): el cajero queda trabado en el money path
- **Sector:** S7 · lentes 9 (idempotencia/carreras), 14 (feedback), 6 (estados)
- **Causa raíz:** Por qué el cajero ve error en un canje exitoso → el 409 'ya canjeado' se trata igual que cualquier fallo. Por qué se trata igual → el catch no distingue el status 409 del backend. Por qué no distingue → el diseño idempotente vive en el backend (índice único) pero el front no cierra el loop: no interpreta 'ya canjeado' como 'éxito idempotente'. Causa terminal: falta de reconciliación cliente↔servidor en el reintento del money path.
- **Evidencia:** `apps/web/src/pages/admin/AdminConfirmarCanjePage.tsx:119`, `apps/web/src/pages/admin/AdminConfirmarCanjePage.tsx:117`, `apps/api/src/routes/redemptions.ts:235`
- **Fix sugerido:** En el catch de handleConfirm, si err instanceof ApiError && err.status === 409 (y/o error==='ya canjeado'), tratarlo como éxito idempotente: toast.success, clearCachedValidation(view.id) y navigate('/admin'). El backend podría además devolver el redemption existente en el 409 para confirmarlo sin ambigüedad.

### [S7-03] ⬜ pendiente — Cuando el cajero no tipea monto, se guarda precioReferencia (precio de lista) como montoTicket real → el vecino ve un 'Pagaste' fabricado y las métricas de ingresos del comercio/owner se inflan
- **Sector:** S7 · lentes 8 (plata), 3 (contrato/semántica), 1 (estimación vs dato real)
- **Causa raíz:** Por qué el vecino ve un ticket que no ingresó → el back reusa precioReferencia como fallback de ahorro Y lo persiste en el mismo campo montoTicket. Por qué en el mismo campo → no se separa 'monto real informado' de 'monto estimado para calcular ahorro'. Por qué no se separa → la decisión PM-elite T1 ('monto opcional, estimar ahorro con lista') se implementó guardando el estimado como si fuera el ticket. Causa terminal: colisión semántica entre 'estimación de ahorro' y 'registro de transacción'.
- **Evidencia:** `apps/api/src/routes/redemptions.ts:200`, `apps/api/src/routes/redemptions.ts:219`, `apps/web/src/pages/CanjeadosPage.tsx:179`, `apps/api/src/routes/admin.ts:50`
- **Fix sugerido:** Separar los conceptos: guardar montoTicket SOLO cuando el cajero lo informó (real), y usar precioReferencia únicamente para calcular ahorroEstimado sin persistirlo como ticket. En el vecino, no renderizar 'Ticket/Pagaste' si el montoTicket no fue informado (o rotularlo 'estimado'). En admin.ts/merchants.ts, sumar ingresos solo de canjes con ticket real, o etiquetar el agregado como estimado igual 

### [S8-01] ⬜ pendiente — Detalle de cliente pide /recent limit=500 pero el backend capa a 200 → LTV, ticket promedio e historial truncados
- **Sector:** S8 · lentes 10, 6, 3
- **Causa raíz:** 1) El header usa c.canjes (agregado sin límite de /clientes). 2) El historial/LTV usan apiRedemptions.data.filter(userId). 3) apiRedemptions viene de useApiRecentRedemptions(500). 4) /redemptions/recent hace Math.min(limitRaw,200) → devuelve máximo 200. 5) Causa terminal: se reusó el endpoint 'recent' (pensado para el feed reciente, capado) como si fuera la fuente completa de canjes de un cliente; falta un endpoint por-cliente sin cap.
- **Evidencia:** `apps/web/src/pages/admin/AdminClienteDetailPage.tsx:44`, `apps/web/src/pages/admin/AdminClienteDetailPage.tsx:152`, `apps/api/src/routes/redemptions.ts:355`
- **Fix sugerido:** Agregar un endpoint GET /redemptions/clientes/:userId (scoped appId+merchantId+userId, sin cap) que devuelva TODOS los canjes del cliente y usarlo en el detalle, en vez de filtrar el feed /recent capado.

### [S8-02] ⬜ pendiente — apiMerchant.estado se fija en el login y nunca se refresca → tras pagar MP el Dashboard/banner siguen mostrando 'pending_payment'
- **Sector:** S8 · lentes 1, 6
- **Causa raíz:** 1) El estado se guarda en apiMerchant al verifyOtp/signup/support. 2) ApiSync llama api.merchantApi.me() pero descarta la respuesta ('si /me funciona no hacemos nada'). 3) Ningún flujo actualiza apiMerchant.estado en la sesión viva. 4) Dashboard y MerchantShell leen apiMerchant.estado del store. 5) Causa terminal: el estado del comercio es un dato mutable server-side (pago, suspensión) pero se cachea como inmutable en localStorage sin re-hidratación.
- **Evidencia:** `apps/web/src/components/ApiSync.tsx:98`, `apps/web/src/pages/admin/AdminDashboardPage.tsx:32`, `apps/web/src/layouts/MerchantShell.tsx:288`
- **Fix sugerido:** En ApiSync, usar la respuesta de merchantApi.me() para actualizar apiMerchant en el store (incluido estado), o que Dashboard/MerchantShell lean el estado de useApiMerchantProfile() en vez del snapshot de localStorage.

### [S8-03] ⬜ pendiente — Export CSV de clientes vulnerable a inyección de fórmulas (CSV/formula injection) con PII controlada por el vecino
- **Sector:** S8 · lentes 8, 14 (seguridad)
- **Causa raíz:** 1) doExport arma cada celda como '"'+valor+'"' escapando solo comillas. 2) No se prefija con apóstrofo/espacio los valores que empiezan con = + - @. 3) El nombre lo controla el vecino. 4) userClaimSchema/userRegisterSchema validan largo pero NO bloquean = + - @ (a diferencia de los campos de cupón que sí bloquean < >). 5) Causa terminal: se confía en PII de terceros como texto inerte al generar un formato ejecutable por hoja de cálculo.
- **Evidencia:** `apps/web/src/pages/admin/AdminClientesPage.tsx:130`, `packages/shared/src/schemas.ts:106`, `packages/shared/src/schemas.ts:68`
- **Fix sugerido:** Al generar la celda CSV, si el valor empieza con = + - @ (o tab/CR), prefijar con apóstrofo o espacio antes del quoting; alternativamente sanear estos caracteres en el nombre del vecino en el schema.

### [S8-05] ⬜ pendiente — El Dashboard no tiene estado de carga → flash de onboarding/'0 canjes' para comercios con datos reales en cada visita
- **Sector:** S8 · lentes 6, 1
- **Causa raíz:** 1) redemptions = apiRecent.data ? map : localRedemptions; durante la carga apiRecent.data es null → cae a localRedemptions (vacío para un comercio de API real). 2) hasRedemptions=redemptions.length>0 → false → renderiza onboarding. 3) clientesUnicos/KPIs se computan de esa lista vacía → 0. 4) A diferencia de AdminCuponesPage/AdminClientesPage/AdminEstadisticasPage, el Dashboard no tiene skeleton ni gate de loading. 5) Causa terminal: se trata 'sin datos aún' (loading) como 'sin datos' (empty).
- **Evidencia:** `apps/web/src/pages/admin/AdminDashboardPage.tsx:39`, `apps/web/src/pages/admin/AdminDashboardPage.tsx:86`, `apps/web/src/pages/admin/AdminDashboardPage.tsx:157`
- **Fix sugerido:** En el Dashboard, mientras apiStats.loading/apiRecent.loading y no hay datos, renderizar un skeleton en vez de calcular KPIs/onboarding sobre la lista local vacía.

### [S8-06] ⬜ pendiente — Crédito de semanas al referidor es un read-modify-write no atómico → se pierde un crédito con confirmaciones concurrentes
- **Sector:** S8 · lentes 9
- **Causa raíz:** 1) El claim de 'primer cupón' del referido SÍ es atómico (findOneAndUpdate firstCouponAt:null). 2) Pero el crédito al referidor es Merchant.findById + set + save (lee weeksEarned, chequea <CAP, incrementa, guarda). 3) Dos requests leen el mismo valor base → last-write-wins → un incremento se pierde. 4) Causa terminal: la sección del referidor no usa una operación atómica ($inc condicional / findOneAndUpdate) equivalente a la del referido.
- **Evidencia:** `apps/api/src/routes/coupons.ts:174`, `apps/api/src/routes/coupons.ts:179`, `apps/api/src/routes/coupons.ts:148`
- **Fix sugerido:** Acreditar al referidor con una actualización atómica condicionada al tope, p.ej. Merchant.findOneAndUpdate({_id, referralWeeksEarned:{$lt:CAP}}, {$inc:{referralWeeksEarned:1}}) y recién ahí calcular los días, o serializar el crédito.

### [S9-02] ⬜ pendiente — Cupo mensual (4 campañas) es check-then-act NO atómico → carrera permite superar el límite
- **Sector:** S9 · lentes 9,11
- **Causa raíz:** El conteo (WaSend.distinct campaignId del mes) y la creación de filas están separados y sin lock ni transacción. Por qué: se contó a partir de filas que recién se crean DURANTE el envío largo. Por qué: no hay un registro de 'Campaign' con unique/contador atómico. Causa terminal: falta de reserva atómica del cupo (findOneAndUpdate con $inc o índice único por (appId,merchantId,mes)).
- **Evidencia:** `apps/api/src/routes/whatsapp.ts:172`, `apps/api/src/routes/whatsapp.ts:24`
- **Fix sugerido:** Reservar el cupo atómicamente antes de enviar: un doc Campaign con índice único o un contador mensual con findOneAndUpdate($inc) gateado por {used < MAX}; si no reserva, 429. Contar campañas por ese doc, no por WaSend.

### [S9-03] ⬜ pendiente — No hay cancelación de campaña; 'Desconectar' a mitad NO frena el loop: sigue ~29 min fallando destinatario por destinatario y consume el cupo igual
- **Sector:** S9 · lentes 6,9
- **Causa raíz:** sendCampaign hace `const s = sessions.get(merchantId)` una sola vez y no revalida s.status ni un flag de cancelación dentro del for. Por qué: no hay señal de cancelación (AbortController/registro de campaña cancelable). Causa terminal: el trabajo largo no es interrumpible ni observa el estado de la sesión que puede cambiar mientras corre.
- **Evidencia:** `apps/api/src/services/whatsapp.service.ts:319`, `apps/api/src/services/whatsapp.service.ts:221`
- **Fix sugerido:** Registrar cada campaña con un flag cancelable (Map<campaignId, {canceled}>) y chequearlo + s.status==='ready' al inicio de cada iteración; exponer POST /wa/campaign/:id/cancel. En cancelación, NO consumir cupo si no se envió casi nada.

### [S9-04] ⬜ pendiente — ConnectionScreen no maneja status='error': muestra 'Generando QR…' infinito y traga wa.lastError (es el estado REAL de prod hoy)
- **Sector:** S9 · lentes 6,14
- **Causa raíz:** El render depende sólo de `!wa.qr || qr===STUB` vs canvas; wa.status y wa.lastError se ignoran. Por qué: se diseñó el happy-path (pending→qr→ready) sin estado de error. Causa terminal: falta de máquina de estados completa (loading/qr/error/offline) en la pantalla de conexión.
- **Evidencia:** `apps/web/src/pages/admin/AdminWhatsappPage.tsx:228`, `apps/api/src/services/whatsapp.service.ts:203`
- **Fix sugerido:** Agregar rama de error en ConnectionScreen: si wa.status==='error' mostrar wa.lastError + botón 'Reintentar' que reejecute /wa/start; y un timeout de 'Generando QR…' que caiga a error si no llega qr en ~30s.

### [S9-05] ⬜ pendiente — Config de Puppeteer en prod garantiza que WA nunca conecta (skip Chromium + sin executablePath), y el fallback a stub NUNCA dispara porque el import sí carga
- **Sector:** S9 · lentes 1,6
- **Causa raíz:** El seam demo/real se decidió por `!WAClient` (import), pero la falla real es en el LAUNCH, no en el import. Por qué: se asumió que 'sin whatsapp-web.js' == 'no disponible', cuando la lib importa aunque el navegador no exista. Causa terminal: no hay un feature-flag explícito de WA ni verificación de que el runtime de Puppeteer esté disponible antes de instanciar el Client.
- **Evidencia:** `nixpacks.toml:50`, `apps/api/src/services/whatsapp.service.ts:67`, `apps/api/src/services/whatsapp.service.ts:146`
- **Fix sugerido:** Introducir WHATSAPP_ENABLED flag explícito. Si está off, no instanciar Client y responder estado claro ('en activación'). Si está on, exigir PUPPETEER_EXECUTABLE_PATH/chromium presentes y fallar el arranque con mensaje claro si faltan, en vez de errorear por-merchant en runtime.

### [S9-06] ⬜ pendiente — El stream SSE sigue aceptando ?token= (access token del comercio en la URL) → token válido 1h para TODA la API queda en logs de proxy
- **Sector:** S9 · lentes 12
- **Causa raíz:** Se dejó el path legacy 'por compat con bundles cacheados por SW'. Por qué: el SW cachea el bundle viejo (gotcha PWA) y se priorizó no romperlo. Causa terminal: no hay expiración/kill-switch del path legacy ni scope reducido del token cuando viaja por URL.
- **Evidencia:** `apps/api/src/routes/whatsapp.ts:49`, `apps/api/src/services/jwt.service.ts:80`
- **Fix sugerido:** Poner fecha de corte al path ?token= (ya hay tickets desplegados). Mientras exista, loguear/alertar su uso y, si se acepta, tratarlo como scope 'sse' únicamente. Forzar update del SW (skipWaiting) para retirar bundles viejos.

### [S9-08] ⬜ pendiente — Sesiones WA y pub/sub son in-memory + LocalAuth en /tmp efímero + single-process: se pierden en cada deploy y no escalan a múltiples réplicas (contradice el comentario 'restaura sin re-escanear QR')
- **Sector:** S9 · lentes 1,6
- **Causa raíz:** Estado de sesión y canal de eventos son locales al proceso y el storage por defecto es /tmp. Por qué: MVP single-instance sin Redis/volumen persistente. Causa terminal: no hay pub/sub distribuido (Redis) ni volumen persistente para LocalAuth ni sticky-sessions.
- **Evidencia:** `apps/api/src/services/whatsapp.service.ts:15`, `apps/api/src/env.ts:57`, `apps/api/src/services/whatsapp.service.ts:51`
- **Fix sugerido:** Montar un volumen persistente Railway para WHATSAPP_SESSIONS_DIR, fijar réplicas=1 (o sticky) hasta migrar el pub/sub a Redis, y corregir el comentario de persistencia.

### [S10-02] ⬜ pendiente — syncPushCategories() es código muerto → las categorías de la suscripción push nunca se actualizan tras suscribirse (y suscribirse sin alertas = recibir TODO)
- **Sector:** S10 · lentes 1, 3, 14
- **Causa raíz:** ¿Por qué no se actualizan las categorías? Porque la función que lo haría, syncPushCategories(), no se invoca en ningún lado (grep: única aparición es su propia definición). ¿Por qué se creó y no se cableó? Se diseñó para re-enviar categorías 'si ya hay suscripción (sin pedir permiso)' pero ningún efecto/handler de cambio de alertas la llama. ¿Por qué el caso [] = todas es tan agresivo? pushCategories() devuelve [] cuando no hay alertas activas o alguna es 'todas', y el backend interpreta categor
- **Evidencia:** `apps/web/src/lib/push.ts:83`, `apps/web/src/lib/alerts.ts:286`, `apps/api/src/services/push.service.ts:38`
- **Fix sugerido:** Llamar a syncPushCategories(pushCategories()) desde un efecto que observe cambios en las alertas activas (o dentro de addAlert/removeAlert/toggleAlert cuando pushEnabled), para reflejar en el backend la unión de categorías vigente. Considerar no interpretar [] como 'todas' cuando el vecino sí tiene alertas específicas.

### [S10-03] ⬜ pendiente — El push del backend ignora minDescuento y merchantSlug de las alertas → sobre-notificación respecto del feed in-app
- **Sector:** S10 · lentes 3, 11
- **Causa raíz:** ¿Por qué llega push de algo que no matchea la alerta? Porque la suscripción push solo persiste `categories` (push.ts subscribe body), no el % ni el comercio. ¿Por qué solo categorías? Porque el modelo PushSubscription y el schema de /push/subscribe solo modelan categories[]. ¿Por qué no se replicó la lógica de matchesAlert? Porque el matching de push vive en el backend (push.service.ts) desacoplado de la lógica de alertas del front (alerts.ts) y solo se pensó el filtro por rubro. Causa terminal:
- **Evidencia:** `apps/api/src/services/push.service.ts:36`, `apps/web/src/lib/alerts.ts:121`
- **Fix sugerido:** Persistir en PushSubscription el criterio completo (o un snapshot de las alertas: min% y merchantSlug) y aplicar el equivalente de matchesAlert en sendCouponPush; o documentar explícitamente que el push es 'por rubro' y ajustar el copy para no prometer paridad con las alertas.

### [S10-04] ⬜ pendiente — Reactivar/publicar un cupón vía PATCH (pausado→activo) nunca dispara Web Push; solo el POST de creación notifica
- **Sector:** S10 · lentes 1, 11
- **Causa raíz:** ¿Por qué no notifica al reactivar? Porque sendCouponPush solo se invoca en el handler POST '/', gateado por coupon.estado === 'activo'. ¿Por qué el PATCH no lo hace? El handler patch actualiza coupon.estado y guarda, pero no tiene ninguna rama que dispare push ante transición a 'activo'. ¿Por qué se omitió? Se asumió el flujo 'crear ya activo'; el estado enum ['activo','pausado'] permite crear pausado o pausar/reactivar, casos no contemplados. Causa terminal: la notificación push está acoplada a
- **Evidencia:** `apps/api/src/routes/coupons.ts:130`, `apps/api/src/routes/coupons.ts:229`, `packages/shared/src/schemas.ts:300`
- **Fix sugerido:** En el PATCH, si estado cambió a 'activo' (y antes no lo era), disparar sendCouponPush(appId, ...) igual que en el POST. Idealmente centralizar 'notificar cupón activo' y guardarse un flag (ej. pushSentAt) para no duplicar si se re-activa varias veces.

### [S10-05] ⬜ pendiente — El service worker de push no maneja 'pushsubscriptionchange' → cuando el browser rota la suscripción, el vecino deja de recibir push silenciosamente y el UI sigue diciendo 'activado'
- **Sector:** S10 · lentes 1, 6, 14
- **Causa raíz:** ¿Por qué se pierde el push? Porque push-sw.js solo escucha 'push' y 'notificationclick', no 'pushsubscriptionchange'. ¿Por qué importa? Porque ante rotación, el único que puede re-registrar el endpoint nuevo es el SW (la app puede estar cerrada). ¿Por qué el UI no lo detecta? getPushState solo comprueba existencia de sub local, no que el backend la conozca. Causa terminal: falta el handler de re-suscripción en el SW y una reconciliación cliente↔servidor del endpoint.
- **Evidencia:** `apps/web/public/push-sw.js:7`, `apps/web/public/push-sw.js:25`, `apps/web/src/lib/push.ts:45`
- **Fix sugerido:** Agregar en push-sw.js un handler 'pushsubscriptionchange' que re-suscriba con la applicationServerKey y haga POST /push/subscribe con el nuevo endpoint (guardando la key VAPID/categorías en IndexedDB o Cache para el SW). En el cliente, reconciliar periódicamente el endpoint local con el backend (re-POST /subscribe).

### [S11-02] ⬜ pendiente — verifyMpSignature compara ts (segundos de MP) contra Date.now() (ms) en el anti-replay → rechaza TODOS los webhooks reales cuando MP esté vivo
- **Sector:** S11 · lentes 7, 9, 1
- **Causa raíz:** ¿Por qué se rechaza? La ventana usa unidades distintas. ¿Por qué? La variable 'tsMs' asume ms pero MP manda segundos. ¿Por qué no se detectó? El test mp-signature.test.ts construye ts con NOW en ms y compara con now en ms — impl y test comparten la suposición equivocada. Causa terminal: se testeó el algoritmo con el mismo modelo mental erróneo (ms) en vez de con el formato real de MP (segundos), sin normalizar unidades antes de comparar.
- **Evidencia:** `apps/api/src/services/mp-signature.ts:48`, `apps/api/src/services/mp-signature.test.ts:6`, `apps/api/src/routes/billing.ts:80`
- **Fix sugerido:** Normalizar unidades: detectar segundos vs ms (p.ej. tsMs = ts < 1e12 ? ts*1000 : ts) antes de Math.abs(now - tsMs). Agregar un test con ts en segundos (10 dígitos) que reproduzca el formato real de MP.

### [S11-04] ⬜ pendiente — Owner 'Cancelar/Pausar/Reactivar' es cosmético: no cambia acceso del comercio ni cancela el preapproval en MP (sigue cobrando la tarjeta)
- **Sector:** S11 · lentes 5, 3, 8
- **Causa raíz:** ¿Por qué no corta acceso ni cobro? Porque el endpoint solo muta el status local. ¿Por qué? Nunca propaga a Merchant.estado ni a la API de MP. ¿Por qué? Se implementó como update de un campo sin efectos secundarios. Causa terminal: el 'cancel' del owner no está modelado como una acción con consecuencias (acceso + proveedor de pago), solo como edición de un enum.
- **Evidencia:** `apps/api/src/routes/owner.ts:1037`, `apps/owner/src/pages/SubscriptionsPage.tsx:223`, `apps/api/src/services/mp.service.ts:85`
- **Fix sugerido:** En el PATCH del owner y en /billing/cancel: llamar a MP para cancelar/pausar el preapproval (PUT /preapproval/:id {status}) y propagar el efecto a Merchant.estado. Ajustar el copy si la acción no es inmediata.

### [S11-05] ⬜ pendiente — /billing/mock-confirm queda ABIERTO en prod cuando MP_ACCESS_TOKEN está vacío (MP bypasseado): cualquier comercio se auto-marca pagado, emite receipt y infla el MRR
- **Sector:** S11 · lentes 1, 5, 9
- **Causa raíz:** ¿Por qué es explotable en prod? Porque el gate es la presencia del token, no el entorno. ¿Por qué? Se asumió 'sin token = solo dev', pero el bypass de MP dejó prod sin token. ¿Por qué genera daño? Emite comprobante fiscal falso e infla métricas de negocio. Causa terminal: una afordancia de desarrollo se gateó con una señal ambigua (token) en lugar de un flag explícito (NODE_ENV!=='production' o MOCK_BILLING=1).
- **Evidencia:** `apps/api/src/routes/billing.ts:271`, `apps/api/src/routes/billing.ts:282`, `apps/api/src/routes/owner.ts:478`
- **Fix sugerido:** Gatear mock-confirm con NODE_ENV!=='production' (o un flag MOCK_BILLING explícito) en vez de la ausencia de MP_ACCESS_TOKEN. En prod nunca debe existir un endpoint que marque 'authorized' sin pago verificado.

### [S11-06] ⬜ pendiente — Owner SubscriptionsPage muestra todos los montos como ARS ignorando la moneda del tenant (COP/CLP se ven como pesos argentinos)
- **Sector:** S11 · lentes 8, 3
- **Causa raíz:** ¿Por qué se ve como ARS? fmtMoney se llama sin currency y cae al default ARS. ¿Por qué? La fila tiene s.currency pero no se usa. ¿Por qué se ignora? El nombre 'amountARS' hace asumir ARS siempre. Causa terminal: mezcla de monedas sin currency-awareness en la vista, agravada por un nombre de campo mentiroso (amountARS almacena la moneda del tenant).
- **Evidencia:** `apps/owner/src/pages/SubscriptionsPage.tsx:181`, `apps/owner/src/lib/format.ts:3`, `apps/api/src/models/Subscription.ts:18`
- **Fix sugerido:** Pasar la moneda de la fila: fmtMoney(s.amountARS, s.currency ?? 'ARS'). Considerar renombrar amountARS→amount en el modelo/contrato para eliminar la suposición ARS.

### [S11-07] ⬜ pendiente — rawLast almacena el payload completo de MP (email del pagador, last4) y owner/subscriptions lo devuelve sin proyección a roles incluido 'viewer'
- **Sector:** S11 · lentes 2, 3
- **Causa raíz:** ¿Por qué se filtra PII? Porque se persiste el payload crudo y se devuelve sin proyectar. ¿Por qué se persiste crudo? rawLast es Mixed 'último payload'. ¿Por qué se devuelve? El listado no excluye rawLast. Causa terminal: se aplicó el scrubbing de PII a los logs (O4) pero no al almacenamiento ni a la serialización del mismo payload.
- **Evidencia:** `apps/api/src/routes/billing.ts:105`, `apps/api/src/routes/owner.ts:1016`, `apps/api/src/models/Subscription.ts:23`
- **Fix sugerido:** No devolver rawLast en el listado (proyección .select('-rawLast')) y/o guardar solo campos no-PII del payload. Restringir rawLast a rol finanzas/super si se necesita.

### [S12-01] ⬜ pendiente — GET /owner/metrics filtra MRR/revenue al rol 'soporte' (sin gate de rol) y el Dashboard lo pinta sin canSeeMrr
- **Sector:** S12 · lentes 5 (RBAC solo en front) + 4
- **Causa raíz:** ¿Por qué ve MRR? Porque /metrics no tiene requireOwnerRole. ¿Por qué? El gate de pagos se implementó puntual en /stats (línea 508) y en /subscriptions (1004), pero /metrics quedó con solo requireOwnerAuth. ¿Por qué el front tampoco protege? DashboardPage no importa canSeeMrr (a diferencia de StatsPage). Causa terminal: la regla 'soporte no ve pagos' se aplicó por-endpoint/por-página en vez de en una capa única (matriz RBAC del back), así que cada superficie nueva nace abierta por defecto.
- **Evidencia:** `apps/api/src/routes/owner.ts:467`, `apps/api/src/routes/owner.ts:495`, `apps/api/src/routes/owner.ts:508`, `apps/owner/src/pages/DashboardPage.tsx:142`
- **Fix sugerido:** Agregar requireOwnerRole('super','admin','finanzas','viewer') a /metrics y strippear revenue para 'soporte' igual que /stats; en DashboardPage envolver la card MRR con canSeeMrr(auth.owner?.rol).

### [S12-02] ⬜ pendiente — Impersonación de comercio (support-session) sin gate de rol: un owner 'viewer'/'finanzas' (read-only) obtiene sesión con WRITE sobre cualquier comercio
- **Sector:** S12 · lentes 5 + 4 (auth cruzada owner→merchant_user)
- **Causa raíz:** ¿Por qué un viewer puede impersonar? Porque support-session no valida rol. ¿Por qué se decidió 'cualquier owner'? Se pensó como acción de soporte de bajo riesgo y se confió en el audit log como control. ¿Por qué es un problema? El audit trail es detectivo, no preventivo, y no distingue read-only. Causa terminal: se confundió 'trazable' con 'autorizado' — la impersonación es la operación de mayor privilegio del panel (write cross-tenant) y quedó accesible al rol de menor privilegio, rompiendo el 
- **Evidencia:** `apps/api/src/routes/owner.ts:884`, `apps/api/src/routes/owner.ts:935`, `apps/api/src/routes/merchant-auth.ts:427`, `apps/api/src/models/Owner.ts:47`
- **Fix sugerido:** Restringir support-session/revoke-support a requireOwnerRole('super','admin','soporte') y ocultar el botón en el front para roles read-only; si 'cualquier owner' es intencional, excluir explícitamente 'viewer'.

### [S12-03] ⬜ pendiente — StatsPage reporta MRR y su tendencia SOLO en ARS: para ciudades COP/MXN/USD el KPI y el gráfico muestran $0 pese a haber facturación
- **Sector:** S12 · lentes 8 (plata, moneda mezclada) + 3
- **Causa raíz:** ¿Por qué muestra 0? Hardcodea la clave 'ARS'. ¿Por qué? La UI se escribió para el MVP mono-moneda (San Pedro) y el soporte multi-país se agregó en el modelo/compute pero no se propagó a StatsPage (DashboardPage sí lo maneja con byCurrency). Causa terminal: 'ARS' quedó como constante implícita en la capa de presentación en lugar de derivarse de los datos, y no hay test que ejercite una ciudad no-AR.
- **Evidencia:** `apps/owner/src/pages/StatsPage.tsx:86`, `apps/owner/src/pages/StatsPage.tsx:92`, `apps/owner/src/pages/StatsPage.tsx:102`
- **Fix sugerido:** En StatsPage sumar/desglosar todas las monedas de byCurrency (como DashboardPage) y para la tendencia elegir la moneda dominante o desglosar por moneda; no hardcodear 'ARS'.

### [S12-04] ⬜ pendiente — Página Pagos muestra TODOS los montos como ARS ignorando subscription.currency (COP/USD rotulados $ con formato es-AR)
- **Sector:** S12 · lentes 8 (plata/moneda) + 3
- **Causa raíz:** ¿Por qué ARS? fmtMoney(amount) omite el 2º parámetro y el default es 'ARS'. ¿Por qué se omitió? El campo se llama 'amountARS' (nombre legacy mono-moneda) e indujo a asumir ARS; el objeto sub trae 'currency' pero no se usa. Causa terminal: naming engañoso del campo (amountARS almacena monto-en-moneda-del-tenant) sin un value object {amount,currency}, y la moneda real no se pasa al formateador.
- **Evidencia:** `apps/owner/src/pages/SubscriptionsPage.tsx:181`, `apps/owner/src/lib/format.ts:3`, `apps/api/src/models/Subscription.ts:23`
- **Fix sugerido:** fmtMoney(s.amountARS, s.currency ?? 'ARS') en la columna Monto (y en cualquier total de la fila).

### [S12-05] ⬜ pendiente — Paginación de /audit (offset = entries.length) con inserciones en la cabeza duplica/saltea filas y colisiona keys de React
- **Sector:** S12 · lentes 10 (paginación) + 9 + 14
- **Causa raíz:** ¿Por qué duplica? offset numérico sobre un conjunto cuyo head crece entre requests. ¿Por qué se eligió offset? Es el patrón por defecto skip/limit. Causa terminal: paginación por offset sobre un stream append-only ordenado desc es intrínsecamente inestable; falta cursor/keyset (paginar por at < últimoAt visto) o dedupe por _id.
- **Evidencia:** `apps/owner/src/pages/AuditPage.tsx:70`, `apps/api/src/routes/owner.ts:430`, `apps/owner/src/pages/AuditPage.tsx:71`
- **Fix sugerido:** Paginar por keyset (?before=<at ISO del último visto> con at < before) o, mínimo, deduplicar por _id al concatenar y capturar/mostrar el error del loadMore.

### [S14-03] ⬜ pendiente — Códigos OTP (owner super-admin y comercio) logueados en texto plano a stdout de producción
- **Sector:** S14 · lentes 14,4,9
- **Causa raíz:** 1) ¿Por qué está el OTP en los logs? Porque hay un console.log de debug antes del gate de entorno. 2) ¿Por qué antes del gate? Porque se pensó como ayuda de dev y quedó incondicional. 3) ¿Por qué no se filtró en prod? Porque el gate sólo cubre el _debugCode de la respuesta, no el log. 4) ¿Por qué importa? Porque los logs de una PaaS son legibles por operadores/integraciones y persisten. 5) Causa terminal: logging de credenciales sin política de redacción por entorno.
- **Evidencia:** `apps/api/src/routes/owner.ts:116`, `apps/api/src/routes/merchant-auth.ts:239`
- **Fix sugerido:** Nunca loguear el código. Envolver estos console.log en `if (!isProd)` o eliminarlos; en prod loguear a lo sumo un id de request y el email hasheado/enmascarado.

### [S14-04] ⬜ pendiente — Rate limiter clave por X-Forwarded-For izquierdo (spoofeable) e in-memory por proceso → bypass de límites de OTP/login/signup
- **Sector:** S14 · lentes 9,12
- **Causa raíz:** 1) ¿Por qué se puede saltear el límite? Porque la clave es una IP que el cliente controla. 2) ¿Por qué se toma el primer valor? Porque asume que el XFF izquierdo es el cliente real. 3) ¿Por qué es falso? Porque los proxies confiables appendean su IP a la derecha; el izquierdo es no confiable. 4) ¿Por qué no se corrige con hops? Porque no hay noción de 'trusted proxy count' ni store compartido. 5) Causa terminal: parseo ingenuo del XFF + rate-limit sin backend compartido.
- **Evidencia:** `apps/api/src/middleware/security.ts:76`, `apps/api/src/middleware/security.ts:63`
- **Fix sugerido:** Usar el IP confiable (rightmost tras N hops del proxy conocido) o la IP de conexión del socket; considerar el header de IP que provee Railway. Para límites reales cross-instancia, mover los buckets a un store compartido (Mongo con TTL o Redis).

### [S14-05] ⬜ pendiente — /api/v1/admin/* es una segunda superficie super-admin cross-tenant con auth más débil que el owner (token estático, compare no-constante, sin rate-limit ni RBAC ni auditoría)
- **Sector:** S14 · lentes 5,4,2
- **Causa raíz:** 1) ¿Por qué hay dos super-admins? Porque el admin.ts legacy quedó tras introducir el owner. 2) ¿Por qué es más débil? Porque usa secreto estático y compare directa. 3) ¿Por qué cross-tenant sin gate? Porque es super-admin por diseño, pero sin RBAC/audit del owner. 4) ¿Por qué persiste? Porque no se deprecó al migrar. 5) Causa terminal: dos rutas de privilegio máximo con controles divergentes; la más débil no se retiró.
- **Evidencia:** `apps/api/src/routes/admin.ts:23`, `apps/api/src/routes/admin.ts:129`, `apps/api/src/services/mp-signature.ts:57`
- **Fix sugerido:** Deprecar admin.ts o migrar sus operaciones al owner (RBAC+audit). Mientras exista: comparar el token con crypto.timingSafeEqual (longitudes iguales), agregar rate-limit y registrar cada mutación en OwnerAuditLog.


# P3 (102)

### [S1-07] ⬜ pendiente — El cliente HTTP referencia /auth/refresh para el subject 'user', endpoint que NO existe en el backend (landmine latente); loggedIn chequea un refresh que el vecino nunca tiene
- **Sector:** S1 · lentes 3, 6
- **Causa raíz:** Por qué apunta a algo inexistente: el cliente asume simetría con el comercio (que sí tiene /merchant/auth/refresh). → Por qué no explota: el vecino jamás tiene refresh token, así que la rama muere antes del fetch. → Causa terminal: contrato FE/BE desalineado (el front modela un flujo de refresh que el back del vecino no implementa).
- **Evidencia:** `apps/web/src/lib/api.ts:77`, `apps/web/src/pages/PerfilPage.tsx:30`
- **Fix sugerido:** Hacer que doRefresh sea no-op explícito para subject 'user' (el vecino no tiene refresh) y quitar el chequeo de .refresh en loggedIn, para que el contrato refleje que el vecino usa sólo access.

### [S1-08] ⬜ pendiente — Incremento de intentos del OTP no atómico (read-modify-write) — lost update bajo verificaciones concurrentes debilita el lockout de 5 intentos
- **Sector:** S1 · lentes 9
- **Causa raíz:** Por qué subcuenta: el incremento es read-modify-write en dos pasos, no un $inc atómico. → Por qué importa: el único freno duro por-OTP es ese contador. → Causa terminal: mutación no atómica de un contador de seguridad sujeto a concurrencia.
- **Evidencia:** `apps/api/src/routes/merchant-auth.ts:294`, `apps/api/src/routes/owner.ts:158`
- **Fix sugerido:** Usar Otp.findOneAndUpdate({_id, consumedAt:null}, {$inc:{attempts:1}}, {new:true}) y decidir el 429 sobre el valor devuelto, en una sola operación atómica.

### [S1-09] ⬜ pendiente — Mismatch de validación de teléfono front (>=8 dígitos crudos) vs back (>=8 dígitos DESPUÉS de normalizar) → un número corto válido en el front da un error genérico opaco
- **Sector:** S1 · lentes 3, 6, 15
- **Causa raíz:** Por qué difiere: el front cuenta dígitos crudos y el back cuenta post-normalización. → Por qué confunde: el error del back no se mapea al campo teléfono, cae al toast genérico. → Causa terminal: dos definiciones de 'teléfono válido' (cruda vs canónica) sin una fuente única compartida en el form.
- **Evidencia:** `apps/web/src/pages/RegistroPage.tsx:34`, `packages/shared/src/schemas.ts:110`
- **Fix sugerido:** Validar en el front con el mismo userClaimSchema (normalizeTelefono + regex) de packages/shared, y mapear issues del back al campo correspondiente en vez del toast genérico.

### [S1-10] ⬜ pendiente — CORS refleja cualquier subdominio *.micuidad.com con credentials:true y cachea el preflight 24h — superficie ampliada y gotcha de deploy
- **Sector:** S1 · lentes 12, 4
- **Causa raíz:** Por qué es amplio: el match por sufijo permite subdominios no enumerados a propósito (comodín de plataforma). → Por qué el riesgo es acotado hoy: no se usan cookies, así que credentials:true aporta poco. → Causa terminal: allowlist por sufijo + credentials + cache larga, aceptable sólo mientras la auth sea 100% Bearer sin cookies.
- **Evidencia:** `apps/api/src/index.ts:73`, `apps/api/src/index.ts:86`
- **Fix sugerido:** Si no se usan cookies, poner credentials:false (los Bearer no lo requieren). Mantener el comodín por sufijo sólo para hosts servidos por la plataforma y bajar maxAge al reconfigurar CORS.

### [S1-11] ⬜ pendiente — El perfil del vecino muestra el teléfono normalizado (sólo dígitos, sin formato) en vez de lo que tipeó
- **Sector:** S1 · lentes 15, 7
- **Causa raíz:** Por qué se ve pelado: se guarda el canónico normalizado como valor único del teléfono y no se conserva el formato original. → Causa terminal: la normalización para identidad se reutiliza como valor de display sin reformatear.
- **Evidencia:** `apps/api/src/routes/user-auth.ts:26`, `apps/web/src/pages/PerfilPage.tsx:128`
- **Fix sugerido:** Formatear el teléfono para display (por país del tenant) al renderizarlo, manteniendo el canónico sólo como identidad.

### [S2-07] ⬜ pendiente — Código y contrato stale de auth email+password: merchantLoginSchema, passwordHash, modelo PasswordReset y sendPasswordResetLink están muertos, y auth.ts documenta endpoints 'forgot/reset password' inexistentes
- **Sector:** S2 · lentes 1, 3
- **Causa raíz:** ¿Por qué hay reset de password sin login de password? Porque se removió el login por contraseña sin borrar la infraestructura acompañante ni la documentación. ¿Por qué persiste? Porque el borrado de código muerto no fue parte del cambio de OTP-only. Causa terminal: una migración de mecanismo de auth se hizo aditiva (se agregó OTP) sin barrer el mecanismo viejo, dejando contrato y comentarios que mienten sobre la superficie real.
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/packages/shared/src/schemas.ts:116`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/models/MerchantUser.ts:13`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/services/email.service.ts:538`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/middleware/auth.ts:113`
- **Fix sugerido:** Eliminar merchantLoginSchema/passwordHash/PasswordReset/sendPasswordResetLink si no se reactivará el login por contraseña, o documentarlos explícitamente como reservados. Corregir el comentario de auth.ts para reflejar la superficie real (request-otp/verify-otp/support-exchange/refresh/logout/me).

### [S2-08] ⬜ pendiente — verify-otp: el contador de intentos se actualiza con read-modify-write no atómico (otp.attempts += 1; save) → dos intentos concurrentes pueden perder un incremento
- **Sector:** S2 · lentes 9
- **Causa raíz:** ¿Por qué se pierden incrementos? Porque es un patrón lee-modifica-escribe sin operador atómico. ¿Por qué no se usó $inc? Porque el consumo del código sí se cuidó con findOneAndUpdate, pero el path de error se dejó con save() del documento en memoria. Causa terminal: dos controles de la misma entidad (consumo vs. conteo de intentos) recibieron distinto rigor de atomicidad.
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:294`
- **Fix sugerido:** Incrementar con Otp.findOneAndUpdate({_id}, { $inc: { attempts: 1 } }, { new:true }) y evaluar el valor devuelto, o mover el tope de intentos a un findOneAndUpdate condicional atómico.

### [S2-09] ⬜ pendiente — Paso fiscal del signup: el bug 'exige CUIT pese a decir Opcional' YA NO es reproducible (el paso fiscal fue removido del alta); queda una trampa latente: razonSocial/direccionFiscal opcionales con .min() rechazan string vacío
- **Sector:** S2 · lentes 3, 1
- **Causa raíz:** ¿Por qué el bug reportado no aparece? Porque el paso fiscal se removió al pasar a alta sin fricción. ¿Por qué persiste el riesgo latente? Porque el patrón .min() sobre .optional() trata '' como valor inválido en vez de ausencia. Causa terminal: en Zod, un opcional con longitud mínima obliga a mandar undefined (no ''), y el front que envía '' cae en un error genérico que se lee como 'campo requerido'.
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/packages/shared/src/schemas.ts:202`, `/Users/alannaimtapia/dev/misanpedro/packages/shared/src/schemas.ts:203`, `/Users/alannaimtapia/dev/misanpedro/packages/shared/src/schemas.ts:207`, `/Users/alannaimtapia/dev/misanpedro/apps/web/src/pages/admin/AdminSignupPage.tsx:48`
- **Fix sugerido:** Si vuelve a haber inputs fiscales, normalizar '' → undefined antes de validar (o usar z.preprocess) para que 'opcional' sea realmente opcional. Documentar que el bug histórico del CUIT quedó resuelto por remoción del paso.

### [S2-10] ⬜ pendiente — Self-referral evade el dedupe por teléfono sin normalizar: referrer.telefono === comercio.telefono compara strings crudos (mismo dueño con distinto formato cobra premio)
- **Sector:** S2 · lentes 9, 8
- **Causa raíz:** ¿Por qué se cuela el auto-referido? Porque el match de identidad usa igualdad exacta de teléfono. ¿Por qué? Porque no se reutilizó normalizeTelefono (que sí normaliza la identidad del vecino). Causa terminal: la 'identidad' del comercio para el antifraude se definió sin canonicalizar los identificadores, permitiendo variantes triviales.
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:134`, `/Users/alannaimtapia/dev/misanpedro/packages/shared/src/schemas.ts:95`
- **Fix sugerido:** Normalizar ambos teléfonos con normalizeTelefono antes de comparar; idealmente aplicar el mismo criterio de canonicalización a cuit (solo dígitos) y email (ya lowercased) para el chequeo isSelf.

### [S2-11] ⬜ pendiente — Errores tragados en el bloque de referido del signup: el alta responde 201 aunque merchant.save()/Referral.create fallen, perdiendo el referido en silencio
- **Sector:** S2 · lentes 14
- **Causa raíz:** ¿Por qué se pierde el referido? Porque el error se traga y no interrumpe ni encola reintento. ¿Por qué se tragó? Para no romper el alta por algo 'best-effort'. Causa terminal: 'best-effort' se implementó como 'silencioso', sin outbox/reintento ni telemetría accionable, así que la pérdida es invisible.
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:149`
- **Fix sugerido:** Registrar el vínculo de referido de forma idempotente y con reintento (outbox/job) o al menos reportar a Sentry con contexto; considerar resolver el referido fuera del path crítico del alta pero con garantía de entrega.

### [S2-12] ⬜ pendiente — El draft del signup persiste PII (email/teléfono/dirección/nombre) en localStorage en texto plano → queda en dispositivos compartidos
- **Sector:** S2 · lentes 15
- **Causa raíz:** ¿Por qué queda PII expuesta? Porque el draft se persiste completo y sin TTL. ¿Por qué? Porque la feature apuntó a no perder datos al recargar, sin considerar el ciclo de vida/limpieza de PII. Causa terminal: la conveniencia de persistencia se implementó sin política de retención ni scoping de sensibilidad.
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/web/src/pages/admin/AdminSignupPage.tsx:121`, `/Users/alannaimtapia/dev/misanpedro/apps/web/src/pages/admin/AdminSignupPage.tsx:87`
- **Fix sugerido:** Ponerle TTL al draft (limpiar >24-48h), limpiarlo al enviar/entrar al panel, y/o excluir campos más sensibles. Considerar sessionStorage si el objetivo es solo sobrevivir un F5 dentro de la sesión.

### [S2-13] ⬜ pendiente — Front: al refrescar, un 403 de comercio suspendido/cancelado NO limpia la sesión → el panel queda en un loop de 401 confusos en vez de un logout limpio con mensaje
- **Sector:** S2 · lentes 6, 14
- **Causa raíz:** ¿Por qué no se comunica la suspensión? Porque el manejo de refresh solo distingue 401 (limpiar) vs resto (mantener). ¿Por qué? Porque se optimizó para no desloguear ante 5xx transitorios, y el 403 de estado terminal cayó en el mismo balde de 'no limpiar'. Causa terminal: la política de limpieza de sesión mapea por código HTTP genérico y no contempla el 403 semántico de 'estado terminal del comercio'.
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/web/src/lib/api.ts:97`, `/Users/alannaimtapia/dev/misanpedro/apps/api/src/routes/merchant-auth.ts:386`
- **Fix sugerido:** En doRefresh, tratar el 403 con payload.estado suspendido/cancelado como sesión terminada: tokens.clear(subject) y emitir un evento que muestre 'cuenta suspendida/cancelada — contactá soporte' y redirija al login, en vez de reintentar.

### [S2-14] ⬜ pendiente — Magic-link OTP: el código de 6 dígitos viaja en la URL del email y queda en el historial del navegador (mitigado por single-use + TTL 5min)
- **Sector:** S2 · lentes 4, 12
- **Causa raíz:** ¿Por qué el código queda en el historial? Porque se transporta en la URL para la comodidad del 'un toque'. ¿Por qué es aceptable-pero-no-ideal? Porque el single-use + TTL 5min acotan la ventana. Causa terminal: se cambió comodidad por exposición de una credencial de corta vida en un canal (URL/historial) más amplio de lo necesario.
- **Evidencia:** `/Users/alannaimtapia/dev/misanpedro/apps/api/src/services/email.service.ts:285`, `/Users/alannaimtapia/dev/misanpedro/apps/web/src/pages/admin/AdminLoginPage.tsx:44`
- **Fix sugerido:** Aceptable por el single-use+TTL; para endurecer, limpiar los query params de la URL apenas se consume (history.replaceState) y/o usar un token opaco de un solo uso distinto del OTP tipeable.

### [S3-07] ⬜ pendiente — OwnerAuditLog.ownerEmail (desnormalizado para 'sobrevivir si el owner se borra') NUNCA se escribe → siempre vacío; el fallback del audit es código muerto
- **Sector:** S3 · lentes 3, 14
- **Causa raíz:** ¿Por qué ownerEmail está vacío? Porque el productor (logOwnerAction) no lo setea. ¿Por qué? Al escribir el helper se pasó ownerId/action/recurso/detail/ip pero se omitió el email desnormalizado. ¿Por qué nadie lo notó? Hoy los owners se soft-borran (enabled:false, nunca deleteOne), así que populate('ownerId') siempre resuelve y el fallback jamás se ejerce → el bug queda latente. Causa terminal: el contrato del modelo (campo desnormalizado) no se cumple en el punto de escritura; funciona por acci
- **Evidencia:** `apps/api/src/routes/owner.ts:72`, `apps/api/src/models/OwnerAuditLog.ts:12`, `apps/api/src/routes/owner.ts:442`
- **Fix sugerido:** En logOwnerAction, resolver el email del owner (o recibirlo del caller que ya tiene ownerDoc en varios sitios) y pasarlo a OwnerAuditLog.create({ ..., ownerEmail }). Así la atribución sobrevive a un eventual hard-delete.

### [S3-09] ⬜ pendiente — Invitar admin: findOne({email}) sin filtrar enabled bloquea re-invitar a un admin deshabilitado; y el create sin catch de E11000 tira 500 en carrera de duplicados
- **Sector:** S3 · lentes 9, 6
- **Causa raíz:** ¿Por qué no se puede re-invitar a un deshabilitado? Porque el chequeo de duplicado no distingue enabled y el flujo de invitación no contempla 'reactivar'. ¿Por qué el 500 en carrera? Porque la unicidad se valida en app (findOne) pero la garantía real está en el índice unique, y el create no captura E11000. Causa terminal: validación de unicidad no atómica + ausencia de manejo del error de índice (patrón que sí existe en PATCH /apps pero no se reusó aquí).
- **Evidencia:** `apps/api/src/routes/owner.ts:306`, `apps/api/src/routes/owner.ts:309`
- **Fix sugerido:** Envolver Owner.create en try/catch y traducir E11000 a 409. Para el caso deshabilitado, ofrecer reactivar (o si existing && !existing.enabled, permitir re-habilitar con el rol nuevo en vez de 409 ciego).

### [S3-10] ⬜ pendiente — verify-otp consume el OTP ANTES de validar que el owner sigue existiendo/habilitado; además el 404 vs 401 es un oráculo de enumeración menor
- **Sector:** S3 · lentes 9, 4
- **Causa raíz:** ¿Por qué se consume antes de validar al owner? El orden prioriza anti-replay (consumir ya) sobre validar el sujeto. ¿Por qué importa? Normalmente el OTP solo existe si el owner existía al pedirlo (request-otp:104 filtra enabled), así que el 404 es un borde estrecho; pero cuando ocurre, quema el código y filtra estado. Causa terminal: orden consumir→validar-sujeto en vez de validar-sujeto→consumir, y códigos de error diferenciados que crean un oráculo.
- **Evidencia:** `apps/api/src/routes/owner.ts:164`, `apps/api/src/routes/owner.ts:171`
- **Fix sugerido:** Validar owner (existe+enabled) ANTES de consumir el OTP, o al menos unificar la respuesta a 401 genérico para no diferenciar 'owner ausente' de 'código inválido'.

### [S3-11] ⬜ pendiente — Paginación cross-tenant sin guarda de NaN en /merchants, /users, /subscriptions: ?limit=abc rompe el tope de 200 (mongoose ignora limit NaN → devuelve todo)
- **Sector:** S3 · lentes 10, 6
- **Causa raíz:** ¿Por qué NaN llega a .limit()? Porque parseInt no se protege contra no-numérico. ¿Por qué inconsistente? /audit usa el patrón robusto (Number||default + Math.min/max) pero /merchants|/users|/subscriptions usan parseInt crudo. Causa terminal: parsing de paginación duplicado y divergente entre endpoints; el robusto existe pero no se reusó.
- **Evidencia:** `apps/api/src/routes/owner.ts:836`, `apps/api/src/routes/owner.ts:976`, `apps/api/src/routes/owner.ts:1008`
- **Fix sugerido:** Usar el mismo helper que /audit: Math.min(Math.max(Number(q)||default,1),200) para limit y Math.max(Number(q)||0,0) para offset, en los tres listados (idealmente extraer una función común).

### [S3-12] ⬜ pendiente — Rate-limit del OTP owner confía en el X-Forwarded-For del cliente (leftmost): spoofeando XFF se evaden los limitadores (email-bombing de OTP, spam de support-codes)
- **Sector:** S3 · lentes 12, 9
- **Causa raíz:** ¿Por qué se evade el límite? Porque la 'identidad' del cliente es un header que el cliente controla. ¿Por qué se toma el leftmost? Se asume que el leftmost es el cliente real, pero un cliente puede prependear entradas falsas. Causa terminal: confianza en XFF sin validar la cadena de proxies (no se toma el hop confiable/derecho ni la IP real del socket), así que el keying del rate-limit es spoofeable.
- **Evidencia:** `apps/api/src/middleware/security.ts:75`, `apps/api/src/routes/owner.ts:88`
- **Fix sugerido:** Tomar la IP confiable según la topología (p.ej. el hop de la derecha añadido por el proxy propio, o la IP del socket cuando el proxy es conocido), no el leftmost arbitrario. En Railway/Cloudflare, usar el header que setea el edge de confianza.

### [S3-13] ⬜ pendiente — Documentación de seguridad stale en el middleware y en el payload del JWT (describe password+TOTP y un solo rol) — desalinea el modelo de auth real (OTP passwordless + 5 roles)
- **Sector:** S3 · lentes 3, 14
- **Causa raíz:** ¿Por qué el comentario describe password+TOTP? Es de una versión previa (auth con contraseña+2FA) que se migró a OTP-only sin actualizar los comentarios. Causa terminal: deriva de documentación tras un cambio de modelo de auth; los comentarios de seguridad no se versionaron con el código.
- **Evidencia:** `apps/api/src/middleware/auth.ts:70`, `apps/api/src/services/jwt.service.ts:27`, `apps/api/src/models/Owner.ts:37`
- **Fix sugerido:** Actualizar los comentarios a 'OTP por email (passwordless)', reflejar los 5 roles en el tipo, y limpiar referencias a password/TOTP/2FA en connection.ts. Considerar eliminar los campos deprecados de Owner si nada los lee.

### [S4-08] ⬜ pendiente — revoke-support (y el disable del owner) dejan el access token válido hasta 1h
- **Sector:** S4 · lentes 4, 9
- **Causa raíz:** ¿Por qué sigue funcionando? Porque el access es un JWT sin lista de revocación; la revocación solo actúa en el /refresh. ¿Por qué se acepta? Está documentado ('muere en el próximo /refresh ≤1h'). ¿Por qué es relevante en soporte? Porque es una credencial de alto privilegio y 1h es una ventana amplia post-revocación. ¿Causa terminal? Access tokens stateless sin denylist para el caso de impersonación.
- **Evidencia:** `apps/api/src/routes/owner.ts:950`, `apps/api/src/services/jwt.service.ts:14`
- **Fix sugerido:** Para cortes inmediatos de impersonación, considerar una denylist/versión de token consultada por requireMerchantAuth cuando hay impersonatedBy, o access tokens de soporte de vida más corta (ej. 5-15 min).

### [S4-09] ⬜ pendiente — El audit de impersonación no dice QUÉ recurso se tocó (baja utilidad forense)
- **Sector:** S4 · lentes 14
- **Causa raíz:** ¿Por qué falta el detalle? Porque el middleware es genérico y no conoce la semántica de cada ruta. ¿Por qué genérico? Para cubrir todas las mutaciones con un solo wrapper. ¿Por qué limita? Porque para impersonación (alto riesgo) el 'qué' importa tanto como el 'quién'. ¿Causa terminal? Auditoría transversal sin enriquecimiento por-ruta ni captura de diffs.
- **Evidencia:** `apps/api/src/middleware/auditImpersonation.ts:32`
- **Fix sugerido:** Enriquecer con el/los ids de path (c.req.param) y, si aplica, un resumen del body en rutas sensibles; o emitir audit específico dentro de los handlers críticos (confirm canje, cancel billing, delete cupón) cuando impersonatedBy esté presente.

### [S4-10] ⬜ pendiente — Una sesión de soporte puede ejecutar logout-all y desloguear al propietario real
- **Sector:** S4 · lentes 5, 4
- **Causa raíz:** ¿Por qué puede? Porque la sesión de soporte tiene exactamente la misma superficie de capacidades que el merchant real (mismo sub/type), sin reducción de scope. ¿Por qué sin reducción? Porque impersonar = actuar como el propietario, sin lista de acciones vedadas. ¿Causa terminal? No existe un modo de scope reducido para soporte; hereda todo lo que puede el admin del comercio.
- **Evidencia:** `apps/api/src/routes/merchant-auth.ts:469`, `apps/api/src/middleware/auditImpersonation.ts:6`
- **Fix sugerido:** Definir un scope de soporte que vede acciones peligrosas de gestión de sesión/identidad (logout-all, cambios de credenciales) cuando impersonatedBy esté presente, o al menos exigir confirmación/rol para ellas.

### [S5-04] ⬜ pendiente — sameTenant() es fail-open: el binding token<->tenant se saltea cuando la ruta no aplicó tenantContext o el token no trae appId
- **Sector:** S5 · lentes 4, 2
- **Causa raíz:** ¿Por qué se saltea el binding? Porque el guard hace 'if (!reqAppId || !payload.appId) return true'. ¿Por qué fail-open? Para no romper rutas que legítimamente no usan tenantContext. ¿Por qué es peligroso? Porque acopla la corrección del aislamiento a que CADA ruta recuerde montar tenantContext; un olvido no falla ruidosamente sino que abre el binding. Causa terminal: un control de seguridad diseñado permisivo-por-defecto; debería fallar cerrado y exigir que el llamador declare explícitamente las
- **Evidencia:** `apps/api/src/middleware/auth.ts:45`, `apps/api/src/routes/notifications.ts:13`, `apps/api/src/routes/whatsapp.ts:91`
- **Fix sugerido:** Invertir a fail-closed: si payload trae appId, exigir reqAppId presente y ==; las rutas verdaderamente cross-tenant deben marcarse explícitamente (allowlist) en vez de depender de ausencia de appId. Alternativamente, garantizar que TODA ruta con requireMerchantAuth/requireUserAuth monte tenantContext antes (test que lo verifique).

### [S5-05] ⬜ pendiente — Fallback de tenant hardcodeado a 'sanpedro' en el front; el guard check:tenant no lo detecta
- **Sector:** S5 · lentes 1, 2, 15
- **Causa raíz:** ¿Por qué default 'sanpedro'? Compatibilidad con el deploy single-tenant original (GH Pages). ¿Por qué sobrevive en multi-ciudad? Porque el fallback nunca se generalizó a 'sin tenant -> selector'. ¿Por qué no lo caza el guard? Porque el guard fue diseñado angosto (solo la marca visible) para no chocar con datos legítimos, dejando fuera el slug. Causa terminal: acoplamiento de compatibilidad single-tenant embebido como constante de ciudad en código multi-tenant, con un guard que da falsa sensación
- **Evidencia:** `apps/web/src/lib/tenant.ts:240`, `scripts/check-no-hardcoded-tenant.mjs:37`
- **Fix sugerido:** Cambiar el fallback final a null (mostrar TenantSelectorPage) salvo que VITE_TENANT_SLUG esté explícitamente seteado para el deploy single-tenant. Opcional: extender check:tenant para prohibir el literal 'sanpedro' fuera de tests/seed.

### [S5-06] ⬜ pendiente — Lecturas por-id sin appId en handlers tenant-facing (rompen el invariante de scoping defensivo del codebase)
- **Sector:** S5 · lentes 2
- **Causa raíz:** ¿Por qué sin appId? Porque el autor confió en la unicidad global del ObjectId. ¿Por qué es un problema? Porque el aislamiento del sistema NO debe depender de que un id nunca provenga de input; la disciplina es scopear siempre. ¿Por qué es inconsistente? Porque el mismo archivo/vecinos sí scopean. Causa terminal: falta de un helper obligatorio (existe withTenant() en middleware/tenant.ts pero casi no se usa) que fuerce appId en toda lectura, dejando a criterio de cada handler.
- **Evidencia:** `apps/api/src/routes/coupons.ts:174`, `apps/api/src/middleware/auth.ts:130`, `apps/api/src/middleware/tenant.ts:158`
- **Fix sugerido:** Normalizar a {_id, appId} (o usar withTenant) en toda lectura tenant-facing por consistencia y defensa en profundidad, aunque el id sea único. Considerar un plugin Mongoose o lint que exija appId en find/findOne de modelos con appId, salvo en owner/admin explícitos.

### [S5-07] ⬜ pendiente — tenantContext resuelve por Host->customDomain ANTES del header X-Tenant-Slug y lo ignora silenciosamente en hosts con customDomain
- **Sector:** S5 · lentes 12, 2
- **Causa raíz:** ¿Por qué customDomain gana sobre el header? Para servir ciudades con dominio propio sin que el front tenga que setear el header. ¿Por qué es un smell? Porque el orden documentado (1: header, 2: subdomain, 3: customDomain) no coincide con la implementación (customDomain primero, silencioso). ¿Por qué importa? Porque un header explícito que se ignora sin señal es fuente de bugs difíciles de diagnosticar. Causa terminal: divergencia entre el contrato documentado del middleware y su implementación r
- **Evidencia:** `apps/api/src/middleware/tenant.ts:63`, `apps/api/src/middleware/tenant.ts:66`
- **Fix sugerido:** Cuando venga X-Tenant-Slug explícito y el host matchee un customDomain de OTRO tenant, decidir explícitamente (rechazar 409 por conflicto, o priorizar el header) en vez de ignorar silenciosamente. Como mínimo, alinear el docblock con el comportamiento real y loguear cuando header y host-derived tenant difieren.

### [S6-04] ⬜ pendiente — Cupón 'zombie': bajar stockMaximo por debajo de stockUsado deja el cupón listado y activable, pero el canje/activación falla con 'agotado'
- **Sector:** S6 · lentes 11 (límites/stock N-1/N/N+1), 9
- **Causa raíz:** ¿Por qué se ve disponible? Porque el listado filtra solo estado:'activo'+vigencia, no stock (coupons.ts:74). ¿Por qué sigue 'activo' con stock excedido? Porque el PATCH solo asigna stockMaximo y difiere la re-evaluación de estado 'al próximo canje' (coupons.ts:246), pero ese 'próximo canje' rechaza en vez de flipear proactivamente. ¿Por qué el vecino igual llega a tocar Canjear? Porque CuponDetailPage no deshabilita el botón por estado/stock (solo por límite de uso). Causa terminal: el estado 'a
- **Evidencia:** `apps/api/src/routes/coupons.ts:246`, `apps/api/src/routes/coupons.ts:74`, `apps/api/src/routes/activations.ts:103`, `apps/web/src/pages/CuponDetailPage.tsx:272`
- **Fix sugerido:** En el PATCH, si stockMaximo!=null y stockUsado>=stockMaximo, setear estado='agotado' en el mismo save. Alternativa/complemento: filtrar el listado por $expr stockUsado<stockMaximo. Y/o deshabilitar 'Canjear' cuando el cupón no esté activo/vigente.

### [S6-05] ⬜ pendiente — Imágenes rotas sin fallback: cover/logo/galería/imagen de cupón muestran el ícono de imagen rota en vez del placeholder categórico
- **Sector:** S6 · lentes 15 (UX/a11y/responsive), 6
- **Causa raíz:** ¿Por qué se ve rota? Porque el <img> renderiza src del comercio sin manejar el evento error. ¿Por qué no cae al placeholder? Porque CardImage decide placeholder vs imagen SOLO por 'coverImageUrl truthy', no por si la imagen efectivamente cargó. Causa terminal: no hay onError que borre la src fallida y muestre el placeholder categórico ya disponible.
- **Evidencia:** `apps/web/src/components/CardImage.tsx:82`, `apps/web/src/pages/MerchantDetailPage.tsx:152`, `apps/web/src/pages/MerchantDetailPage.tsx:257`
- **Fix sugerido:** Agregar onError en CardImage que setee un estado 'failed' y renderice el placeholder categórico; en galería/logo, onError que oculte el <img> o muestre un placeholder. Validar/whitelistear el host de coverImageUrl en el alta.

### [S6-06] ⬜ pendiente — 'Abierto/Cerrado ahora' y 'Vigente hasta' se calculan con la timezone del dispositivo del vecino, no la de la ciudad del tenant
- **Sector:** S6 · lentes 7 (fecha/timezone), 6
- **Causa raíz:** ¿Por qué se corre? Porque los helpers de formato usan getters locales del Date del cliente. ¿Por qué? Porque se asume que vecino y comercio comparten tz (app hiperlocal), suposición que se rompe con multi-país (Mi[Ciudad]/Colombia) y con vecinos fuera de la ciudad. Causa terminal: el FE no conoce/usa la tz del tenant (tenant.config) al formatear horarios/vigencia, mientras el BE sí la tiene (merchants.ts:tzForPais).
- **Evidencia:** `apps/web/src/lib/format.ts:214`, `apps/web/src/lib/format.ts:16`, `apps/api/src/routes/merchants.ts:219`
- **Fix sugerido:** Pasar la tz del tenant (tenant.config) a isOpenNow/formatVigencia y formatear con Intl.DateTimeFormat({timeZone}) en vez de getters locales, reutilizando tzForPais del backend.

### [S7-04] ⬜ pendiente — El email de canje formatea la fecha con toLocaleString sin timeZone → muestra la hora del server (UTC en Railway), +3h respecto a la hora local del vecino
- **Sector:** S7 · lentes 7 (fecha/timezone), 3 (contrato)
- **Causa raíz:** Por qué la hora está mal → toLocaleString(locale) usa la TZ del runtime, no la del tenant. Por qué no pasa la TZ → el objeto que arma el email pasa locale y moneda del tenant pero omite timeZone. Por qué la omite → existe tzForPais(tenant.pais) en merchantStats pero no se reutiliza en el email. Causa terminal: patrón de TZ correcto ya existe en el repo pero no se aplicó al render del email.
- **Evidencia:** `apps/api/src/routes/redemptions.ts:311`, `apps/api/src/services/merchantStats.ts:35`
- **Fix sugerido:** Pasar { timeZone: tzForPais(tenant?.pais) } (y locale) a toLocaleString en el email de canje; reusar el mismo helper que merchantStats para consistencia entre stats y notificaciones.

### [S7-05] ⬜ pendiente — confirmRedemptionSchema rechaza montoTicket 0/negativo/>$10M/string con un 400 genérico que BLOQUEA todo el canje — contradice el invariante 'el monto NUNCA bloquea el canje'
- **Sector:** S7 · lentes 8 (plata: 0/negativo/>10M/string), 3 (contrato), 9
- **Causa raíz:** Por qué 0/negativo bloquea → el schema usa .positive().max(10M) y ante violación falla TODO el body (no ignora el campo). Por qué falla todo → montoTicket es opcional pero, si viene fuera de rango, Zod invalida el objeto entero en vez de tratarlo como 'no informado'. Por qué así → el intento (monto nunca bloquea) se implementó como 'opcional' pero no como 'tolerante a valores inválidos'. Causa terminal: el contrato Zod es más estricto que la regla de negocio declarada.
- **Evidencia:** `packages/shared/src/schemas.ts:351`, `apps/api/src/routes/redemptions.ts:136`
- **Fix sugerido:** Definir la semántica: si el monto no debe bloquear, hacer el back tolerante (ej. coerce/clamp o descartar montoTicket inválido y seguir con precioReferencia) en vez de 400. O, si se quiere validar, devolver un error específico ('monto inválido, se confirma sin monto') y confirmar igual. Además alinear el cap del input (8 dígitos) con el .max(10M).

### [S7-06] ⬜ pendiente — AdminValidarPage: sin feedback de carga en modo Código mientras el /validate está en vuelo; en modo QR aparece un 'No encontramos este código' local espurio durante la carga
- **Sector:** S7 · lentes 6 (estados: cargando), 1 (costura demo/API), 15 (UX)
- **Causa raíz:** Por qué no hay feedback en CodeMode → el componente solo consume { result }, descarta loading, y ready && result no renderiza nada si result es null. Por qué el parpadeo en ScanMode → la lógica de fallback devuelve localResult cuando !apiResult, y para comercio API el local está vacío = not-found. Por qué difieren los dos modos → cada modo resolvió el fallback local de forma distinta (CodeMode ignora local para sesión API; ScanMode no). Causa terminal: manejo inconsistente del estado 'cargando' 
- **Evidencia:** `apps/web/src/pages/admin/AdminValidarPage.tsx:85`, `apps/web/src/pages/admin/AdminValidarPage.tsx:133`, `apps/web/src/pages/admin/AdminValidarPage.tsx:219`
- **Fix sugerido:** Consumir el flag loading de useApiValidateByCode y mostrar un spinner/'Validando…' cuando ready && loading en ambos modos. En ScanMode, no caer a localResult para sesiones API mientras apiResult está cargando (mismo criterio que CodeMode).

### [S7-07] ⬜ pendiente — El rate limit de /validate y /confirm está keyeado por IP/User-Agent, no 'por comercio' como dice el comentario: bypass distribuido y bloqueo cruzado entre comercios tras el mismo NAT
- **Sector:** S7 · lentes 9 (anti-abuso/brute force), 12 (infra), 3
- **Causa raíz:** Por qué el límite no es por comercio → clientKey solo mira IP/UA, nunca auth.merchantId. Por qué → el rateLimit corre ANTES de requireMerchantAuth (no hay merchantId disponible aún en el middleware). Por qué corre antes → se ordenó el limiter primero para frenar no autenticados. Causa terminal: el limiter genérico no puede keyear por sujeto porque está antes de la auth, y el comentario quedó desactualizado respecto a la implementación.
- **Evidencia:** `apps/api/src/middleware/security.ts:73`, `apps/api/src/routes/redemptions.ts:22`
- **Fix sugerido:** Corregir el comentario y/o keyear un segundo limiter por merchantId DESPUÉS de requireMerchantAuth para el enforcement 'por comercio'. Para brute-force real de códigos, considerar backoff por (merchantId) además del por-IP. En multi-instancia, mover el bucket a un store compartido (Redis) si el anti-abuso es crítico.

### [S7-08] ⬜ pendiente — El polling del vecino marca redeemedAt con la hora del cliente (Date.now()), no con el redeemedAt real del backend
- **Sector:** S7 · lentes 7 (fecha), 3 (contrato)
- **Causa raíz:** Por qué usa hora del cliente → markRedeemed hardcodea new Date().toISOString() y la llamada del polling solo le pasa ahorro y monto, no el redeemedAt del backend. Por qué no lo pasa → la firma de markRedeemed no acepta redeemedAt y el polling no lo propaga. Causa terminal: la acción del store fue pensada para el modo demo (donde no hay backend) y se reutilizó para el path real sin propagar la fecha autoritativa.
- **Evidencia:** `apps/web/src/lib/stores.ts:251`, `apps/web/src/pages/CuponActivoPage.tsx:77`
- **Fix sugerido:** Extender markRedeemed para aceptar redeemedAt y que el polling propague res.activation.redeemedAt. Alternativamente, dejar que syncMyActivations sea la única fuente de verdad del historial (ya lo corrige) y no fijar fecha en markRedeemed.

### [S7-09] ⬜ pendiente — Al agotarse el stock en el claim fallido, se marca 'agotado' sin guard de estado='activo' (a diferencia del marcado posterior), pudiendo pisar un cupón recién pausado
- **Sector:** S7 · lentes 9 (carreras), 11 (stock)
- **Causa raíz:** Por qué pisa pausado → el update de agotado en el path de 'sin stock' no filtra por estado='activo'. Por qué inconsistente → el otro marcado de agotado (cierre exitoso) sí lo filtra, señal de que la protección se aplicó en un lugar y se olvidó en el otro. Causa terminal: dos rutas que marcan 'agotado' con condiciones distintas (una atómica-guardada, otra no).
- **Evidencia:** `apps/api/src/routes/redemptions.ts:190`, `apps/api/src/routes/redemptions.ts:272`
- **Fix sugerido:** Agregar estado:'activo' (y opcionalmente el $expr de stock) al updateOne de la línea 190, para no transicionar desde estados no-activos y ser consistente con el marcado del cierre exitoso.

### [S7-10] ⬜ pendiente — CanjeadosPage calcula 'este mes' con el inicio de mes en la TZ del navegador contra redeemedAt en UTC → miscount en el borde de mes si la TZ del dispositivo no coincide con la del usuario
- **Sector:** S7 · lentes 7 (bordes de mes, UTC vs -03)
- **Causa raíz:** Por qué el borde falla → la frontera de mes se arma con getFullYear()/getMonth() (TZ del runtime del browser), pero redeemedAt se compara como instante absoluto UTC. Por qué difiere del backend → merchantStats usa tzForPais(tenant.pais); el front del vecino no tiene ese contexto. Causa terminal: no hay una TZ canónica del tenant aplicada en el front del vecino para agregaciones por período.
- **Evidencia:** `apps/web/src/pages/CanjeadosPage.tsx:64`, `apps/api/src/services/merchantStats.ts:73`
- **Fix sugerido:** Calcular el inicio de mes en la TZ del tenant (derivada de pais/locale del tenant config) igual que merchantStats, o mover el agregado 'este mes' al backend que ya es TZ-aware.

### [S7-11] ⬜ pendiente — montoTicket acepta decimales en el contrato (z.number sin .int()) → tickets fraccionarios persistidos y ahorro con redondeo por request directo al API
- **Sector:** S7 · lentes 8 (plata: decimal, centavos)
- **Causa raíz:** Por qué se guardan decimales → el schema no fuerza enteros. Por qué no los fuerza → el front ya limpia a enteros (parseInt) y se asumió que era suficiente, pero el backend es la fuente de verdad del contrato. Causa terminal: la validación de dinero delega la 'enteridad' al front en vez de exigirla en el contrato compartido.
- **Evidencia:** `packages/shared/src/schemas.ts:352`, `packages/shared/src/valor.ts:15`
- **Fix sugerido:** Agregar .int() (o .multipleOf(1)) a montoTicket en confirmRedemptionSchema para que el contrato exija pesos enteros, coherente con el formateo y con el resto del sistema.

### [S7-12] ⬜ pendiente — El código de 6 dígitos es único por tenant sobre TODOS los estados: activaciones canjeadas/canceladas ocupan el slot para siempre → el espacio de códigos se satura con el tiempo y generateUniqueCode tira 500
- **Sector:** S7 · lentes 11 (límites/stock del espacio), 9 (colisión de código)
- **Causa raíz:** Por qué se saturan los códigos → el unique index no es parcial por estado activo, entonces nunca se liberan. Por qué no es parcial → se priorizó impedir cualquier reuso de código (incluso histórico) para trazabilidad. Por qué 12 reintentos → número fijo pensado para densidad baja. Causa terminal: espacio de 6 dígitos + unicidad perpetua no escala a ciudades grandes de largo plazo.
- **Evidencia:** `apps/api/src/models/Activation.ts:46`, `apps/api/src/routes/activations.ts:21`
- **Fix sugerido:** Hacer el unique index parcial a status:'activo' (liberando códigos de activaciones cerradas), o ampliar el espacio (más dígitos / alfanumérico), o subir/loopear reintentos con jitter. Un índice parcial además permite reusar códigos ya consumidos sin ambigüedad porque el /validate solo resuelve por código y luego chequea estado.

### [S7-13] ⬜ pendiente — Doble-tap sobre la MISMA activación con stockMaximo=1 devuelve 'agotado' (mensaje incorrecto) en vez de 'ya canjeado'
- **Sector:** S7 · lentes 9 (idempotencia), 14 (feedback correcto)
- **Causa raíz:** Por qué mensaje equivocado → el claim de stock ocurre ANTES del insert del Redemption (que es el verdadero guard de doble-canje), así que el segundo request choca primero contra el stock. Por qué el orden → el stock se reclama atómicamente antes de crear el Redemption por diseño (evitar oversell). Causa terminal: para stockMaximo=1 el fallo de stock enmascara el fallo de doble-canje, produciendo un mensaje que no refleja la causa.
- **Evidencia:** `apps/api/src/routes/redemptions.ts:183`
- **Fix sugerido:** Antes de responder 'agotado' cuando el claim falla, chequear si ya existe un Redemption para esta activationId; si existe, responder 'ya canjeado' (mensaje correcto). O mover el insert del Redemption antes del claim para stockMaximo pequeño (con la compensación ya existente).

### [S7-14] ⬜ pendiente — Compensación del cierre de canje traga errores con .catch(()=>{}) sin log ni alerta → puede quedar Redemption registrado + activación 'activo' sin rastro
- **Sector:** S7 · lentes 14 (errores tragados), 9 (consistencia)
- **Causa raíz:** Por qué no se detecta → cada paso compensatorio silencia su propio error. Por qué se silencia → se priorizó no enmascarar el closeErr original y no romper el flujo. Causa terminal: la compensación best-effort no reporta sus propios fallos, dejando estados inconsistentes invisibles para operaciones/monitoreo.
- **Evidencia:** `apps/api/src/routes/redemptions.ts:287`
- **Fix sugerido:** Loguear/captureException en cada .catch de la compensación (con activationId/redemptionId) para que un estado inconsistente sea observable y reparable, sin cambiar el rethrow del closeErr.

### [S8-07] ⬜ pendiente — Editar un cupón 'agotado' o 'vencido' lo fuerza a 'activo'
- **Sector:** S8 · lentes 11, 3, 6
- **Causa raíz:** 1) El payload de publicar manda estado: existing.estado==='pausado' ? 'pausado' : 'activo'. 2) El schema couponShape.estado solo acepta ['activo','pausado'] → cualquier estado que no sea 'pausado' se colapsa a 'activo'. 3) El PATCH aplica coupon.estado=data.estado. 4) Causa terminal: el front solo distingue pausado/activo y descarta agotado/vencido al re-serializar el estado.
- **Evidencia:** `apps/web/src/pages/admin/AdminCuponEditPage.tsx:516`, `packages/shared/src/schemas.ts:300`, `apps/api/src/routes/coupons.ts:229`
- **Fix sugerido:** Preservar el estado real al editar (no colapsar agotado/vencido a activo): recalcular estado en base a stockUsado>=stockMaximo y vigenciaHasta<now, o mandar el estado existente cuando no sea activo/pausado.

### [S8-08] ⬜ pendiente — precioReferencia no se puede limpiar en edición (se manda crudo, schema no es nullable)
- **Sector:** S8 · lentes 3
- **Causa raíz:** 1) En publicar(), casi todos los opcionales pasan por clr() (undefined→null en edición) para limpiarlos, pero precioReferencia se manda crudo (precioRefNum, que es undefined si el campo está vacío). 2) JSON.stringify omite las claves undefined → el backend no recibe precioReferencia. 3) El PATCH solo actúa if (data.precioReferencia !== undefined). 4) Además el schema define precioReferencia como .positive().optional() SIN .nullable(), así que aunque el front mandara null, sería rechazado. 5) Cau
- **Evidencia:** `apps/web/src/pages/admin/AdminCuponEditPage.tsx:498`, `packages/shared/src/schemas.ts:260`, `apps/api/src/routes/coupons.ts:224`
- **Fix sugerido:** Hacer precioReferencia .nullable() en el schema y enviarlo con clr(precioRefNum) en edición para que un valor vacío lo limpie (paridad con los otros opcionales).

### [S8-09] ⬜ pendiente — Auto-referido evadible: el chequeo self compara teléfono/cuit por igualdad exacta sin normalizar y el alta ya no pide CUIT
- **Sector:** S8 · lentes 9 (abuso), 3
- **Causa raíz:** 1) isSelf = sameEmail || sameCuit || samePhone. 2) samePhone compara referrer.telefono === comercio.telefono como strings crudos (existe normalizeTelefono en shared pero no se usa acá). 3) sameCuit requiere ambos CUIT no vacíos, pero el alta ya no pide CUIT (queda vacío). 4) Con email y teléfono distintos, ningún término matchea. 5) Causa terminal: la detección de 'misma persona' se apoya en igualdad textual de campos fácilmente variables, no en identidad normalizada.
- **Evidencia:** `apps/api/src/routes/merchant-auth.ts:134`, `apps/api/src/routes/merchant-auth.ts:133`, `packages/shared/src/schemas.ts:95`
- **Fix sugerido:** Normalizar teléfono (normalizeTelefono) antes de comparar en el check self y considerar señales adicionales de mismo dispositivo/IP; documentar el trade-off si se acepta.

### [S8-10] ⬜ pendiente — AdminReferidosPage muestra '+1 semana' en todos los referidos confirmados, incluso los que otorgaron 0 semanas por tope
- **Sector:** S8 · lentes 3, 15
- **Causa raíz:** 1) El badge se decide solo por r.status==='confirmed', ignorando r.weeksGranted. 2) La confirmación marca status='confirmed' incluso cuando el tope impide acreditar (weeksGranted=0). 3) 'Confirmados' cuenta todos los confirmed. 4) Causa terminal: el front asume confirmed⇒+1 semana, pero el back distingue confirmed-con-crédito de confirmed-sin-crédito y no lo propaga al copy.
- **Evidencia:** `apps/web/src/pages/admin/AdminReferidosPage.tsx:233`, `apps/api/src/routes/coupons.ts:184`, `apps/api/src/routes/referrals.ts:40`
- **Fix sugerido:** Usar r.weeksGranted (ya lo devuelve /referrals/mine) para el badge: mostrar '+1 semana' solo si weeksGranted>0, y 'Activó (tope alcanzado)' cuando sea 0.

### [S8-11] ⬜ pendiente — NotesSection traga errores de carga: un fallo real de /notes muestra 'Sin notas todavía'
- **Sector:** S8 · lentes 14, 6
- **Causa raíz:** 1) refresh() hace try/catch; en el catch, cualquier error (no solo offline) cae a setNotes([]) y loading=false. 2) El comentario asume que el único error posible es 'endpoint no existe' (offline/demo). 3) No hay estado de error diferenciado. 4) Causa terminal: se colapsa 'falló la carga' con 'no hay notas'.
- **Evidencia:** `apps/web/src/pages/admin/AdminClienteDetailPage.tsx:490`, `apps/web/src/pages/admin/AdminClienteDetailPage.tsx:567`
- **Fix sugerido:** Distinguir error de vacío: guardar un flag de error en el catch y mostrar un estado 'No pudimos cargar las notas · Reintentar' en vez de 'Sin notas todavía'.

### [S8-12] ⬜ pendiente — Endpoints agregados del comercio cargan TODAS las Redemption en memoria sin límite (stats, stats/asesor, clientes)
- **Sector:** S8 · lentes 6, 10
- **Causa raíz:** 1) Se eligió agregar en JS 'porque el volumen por comercio es chico'. 2) No hay tope ni pipeline de agregación en Mongo. 3) A medida que un comercio acumula historial, el costo crece linealmente sin cota. 4) Causa terminal: supuesto de bajo volumen embebido en el diseño, sin salvaguarda.
- **Evidencia:** `apps/api/src/routes/merchants.ts:205`, `apps/api/src/routes/merchants.ts:170`, `apps/api/src/routes/redemptions.ts:400`
- **Fix sugerido:** Migrar los agregados a un aggregation pipeline en Mongo (group por userId/couponId/día) o paginar; como mínimo acotar por rango de fecha del período pedido.

### [S8-13] ⬜ pendiente — POST /clientes/notes permite crear notas sobre cualquier User del tenant, aunque nunca haya canjeado en el comercio
- **Sector:** S8 · lentes 5, 2
- **Causa raíz:** 1) Se agregó la validación User.exists({_id,appId}) para evitar userIds inexistentes. 2) Pero no se validó que exista al menos un Redemption entre este merchant y ese user. 3) La UI solo expone la sección para clientes reales, pero el endpoint es accesible directo. 4) Causa terminal: falta el check de pertenencia (el vecino es cliente de ESTE comercio) en la mutación.
- **Evidencia:** `apps/api/src/routes/redemptions.ts:488`, `apps/api/src/routes/redemptions.ts:492`
- **Fix sugerido:** Antes de crear la nota, exigir Redemption.exists({appId, merchantId: auth.merchantId, userId}) (el vecino debe ser cliente del comercio).

### [S8-14] ⬜ pendiente — KPIs del Dashboard (hoy/semana/mes) se calculan en la timezone del dispositivo sobre la lista /recent capada a 200
- **Sector:** S8 · lentes 7, 10
- **Causa raíz:** 1) kpis filtra 'redemptions' (recent 200) usando new Date() local del navegador. 2) merchantStats.ts calcula los bordes de período en tzForPais(tenant.pais). 3) Dos fuentes/zonas distintas para 'el mismo' número. 4) Causa terminal: el Dashboard duplica el cálculo de período en el cliente (TZ dispositivo + lista capada) en vez de consumir el agregado del backend.
- **Evidencia:** `apps/web/src/pages/admin/AdminDashboardPage.tsx:56`, `apps/api/src/services/merchantStats.ts:73`, `apps/api/src/routes/merchants.ts:219`
- **Fix sugerido:** Servir los KPIs hoy/semana/mes desde el backend (en TZ del tenant) como parte de /me/stats, o reusar el endpoint /stats/asesor, en vez de recalcularlos en el cliente sobre la lista capada.

### [S8-15] ⬜ pendiente — Estadísticas: 'Volvieron/Una sola vez' y 'Mejores clientes' son lifetime pero se muestran bajo el selector de período
- **Sector:** S8 · lentes 3, 15
- **Causa raíz:** 1) computeAsesorStats calcula volvieron/unaSolaVez/mejores desde byUser (agregado lifetime), no del subconjunto del período. 2) La UI las ubica junto a las métricas por período sin etiqueta 'de por vida'. 3) Causa terminal: mezcla de granularidades (período vs lifetime) sin señalización en la UI.
- **Evidencia:** `apps/api/src/services/merchantStats.ts:171`, `apps/api/src/services/merchantStats.ts:194`, `apps/web/src/pages/admin/AdminEstadisticasPage.tsx:228`
- **Fix sugerido:** Etiquetar explícitamente esas tarjetas como 'de por vida' (o recalcularlas por período) para no inducir a leerlas como métricas del período seleccionado.

### [S8-16] ⬜ pendiente — Crecimiento muestra '+100%' cuando el período previo fue 0 (crecimiento infinito representado como 100%)
- **Sector:** S8 · lentes 8, 7
- **Causa raíz:** 1) pctVar(cur,prev): if prev===0 return cur>0?100:null. 2) Se eligió 100 como sentinel para 'de 0 a algo'. 3) La UI lo pinta como un % normal. 4) Causa terminal: colapsar 'variación desde base 0' a un 100% fijo pierde información y puede confundir.
- **Evidencia:** `apps/api/src/services/merchantStats.ts:126`, `apps/web/src/pages/admin/AdminEstadisticasPage.tsx:283`
- **Fix sugerido:** Para prev===0 mostrar un indicador cualitativo ('nuevo' / '↑ desde 0') en vez de un '+100%' numérico que subrepresenta el salto.

### [S9-09] ⬜ pendiente — El límite mensual se calcula con el mes en zona horaria del server (UTC), no AR (-03): la ventana de cupo se corre 3h
- **Sector:** S9 · lentes 7
- **Causa raíz:** Se usó fecha local del proceso sin fijar TZ AR. Por qué: no hay utilidad de 'inicio de mes AR'. Causa terminal: cálculos de bordes temporales dependientes de process.env.TZ implícito.
- **Evidencia:** `apps/api/src/routes/whatsapp.ts:18`
- **Fix sugerido:** Calcular el inicio de mes en America/Argentina/Buenos_Aires (o guardar un campo 'yyyy-mm' AR por campaña y contar por él).

### [S9-10] ⬜ pendiente — El tope de 4 campañas y el contrato de /wa/* están duplicados FE/BE y ausentes de packages/shared (fuente de verdad)
- **Sector:** S9 · lentes 3
- **Causa raíz:** El sector WhatsApp no se modeló en el contrato canónico. Por qué: se agregó tarde, con tipos inline. Causa terminal: single-source-of-truth (shared) no cubre WA; constantes de negocio no compartidas.
- **Evidencia:** `apps/api/src/routes/whatsapp.ts:16`, `apps/web/src/pages/admin/AdminWhatsappPage.tsx:33`
- **Fix sugerido:** Mover el tope y los tipos de campaign/quota a packages/shared y consumirlos en ambos lados; el front debe usar SIEMPRE quota.max del backend, sin fallback a un literal local.

### [S9-11] ⬜ pendiente — El conteo de destinatarios mostrado incluye clientes sin teléfono válido → sobrecuenta vs lo realmente enviado
- **Sector:** S9 · lentes 6,8
- **Causa raíz:** Se cuenta antes de filtrar los números inválidos. Por qué: el filtro de validez vive en handleStartSend, no en el cálculo del bucket. Causa terminal: dos definiciones distintas de 'audiencia' (mostrada vs enviable) sin reconciliar.
- **Evidencia:** `apps/web/src/pages/admin/AdminWhatsappPage.tsx:441`, `apps/web/src/pages/admin/AdminWhatsappPage.tsx:810`
- **Fix sugerido:** Calcular los buckets ya filtrados por teléfono válido (o mostrar 'N enviables de M') y usar ese número en botón/confirm/labels.

### [S9-12] ⬜ pendiente — ComposerScreen sigue mostrando 'WhatsApp conectado' aunque el SSE reporte disconnected/error (status se lee una sola vez, sin re-poll)
- **Sector:** S9 · lentes 6
- **Causa raíz:** El gate connected usa un fetch estático, no el stream en vivo que ya está suscripto. Por qué: se separaron las fuentes (status HTTP para el gate, SSE para qr/progreso) sin sincronizarlas. Causa terminal: dos fuentes de verdad de conexión sin reconciliación reactiva.
- **Evidencia:** `apps/web/src/pages/admin/AdminWhatsappPage.tsx:108`, `apps/web/src/lib/apiQueries.ts:258`
- **Fix sugerido:** Que el gate connected observe wa.status del stream (o refetch de status cuando wa.status !== 'ready') para volver a ConnectionScreen al caerse la sesión.

### [S9-13] ⬜ pendiente — Copy engañoso: 'Mantené WhatsApp Web abierto en una pestaña' y 'si cerrás WhatsApp Web la campaña se pausa hasta que vuelvas' — el envío corre headless en el server, no en el navegador del comercio, y no hay pausa/reanudación
- **Sector:** S9 · lentes 14,15
- **Causa raíz:** Copy heredado del modelo mental 'WhatsApp Web en el browser del usuario'. Por qué: se migró a Puppeteer server-side sin actualizar la ayuda. Causa terminal: documentación de UX no sincronizada con la arquitectura real.
- **Evidencia:** `apps/web/src/pages/admin/AdminWhatsappPage.tsx:266`, `apps/web/src/pages/admin/AdminWhatsappPage.tsx:574`
- **Fix sugerido:** Reescribir el copy: el envío ocurre en el servidor; el comercio sólo debe mantener el dispositivo vinculado (no cerrar sesión desde el teléfono). Quitar la promesa de 'pausa'.

### [S9-14] ⬜ pendiente — El reporte muestra 'Entregados' = sentCount, que sólo significa 'aceptado por WhatsApp Web sin throw', no entrega real
- **Sector:** S9 · lentes 14
- **Causa raíz:** Se reusó sentCount para dos labels distintos. Por qué: no hay señal de delivery sin la API oficial de Meta. Causa terminal: se etiquetó como 'Entregados' un dato que es 'Aceptados/Encolados'.
- **Evidencia:** `apps/web/src/pages/admin/AdminWhatsappPage.tsx:456`, `apps/web/src/pages/admin/AdminWhatsappPage.tsx:889`
- **Fix sugerido:** Renombrar 'Entregados' a 'Aceptados/Encolados' (o unificar con 'Enviados' y dejar sólo 'Fallidos'), reservando 'Entregados' para cuando exista delivery receipt real.

### [S9-15] ⬜ pendiente — Reconexión SSE sin replay (Last-Event-ID ignorado) + ping a /me cada 5s durante caídas + reintento potencialmente infinito si el refresh falla
- **Sector:** S9 · lentes 6,7
- **Causa raíz:** No hay buffer de eventos por merchant ni honor de Last-Event-ID, y el backoff es fijo 5s sin tope ni corte por session-expired. Causa terminal: reconexión best-effort sin resiliencia de entrega ni límite de reintentos.
- **Evidencia:** `apps/web/src/lib/useWhatsappStream.ts:71`, `apps/api/src/routes/whatsapp.ts:60`
- **Fix sugerido:** Backoff exponencial con tope, cortar el loop ante session-expired, y (para progreso) tratar campaign.done como estado terminal idempotente; opcionalmente honrar Last-Event-ID con un buffer corto por merchant.

### [S10-06] ⬜ pendiente — Contrato roto: el backend envía redeemedAt/no envía occurredAt, el front lee data.occurredAt → siempre cae a Date.now() (timestamp real del evento se pierde)
- **Sector:** S10 · lentes 3, 7
- **Causa raíz:** ¿Por qué occurredAt es siempre 'ahora'? Porque data.occurredAt no existe en el payload. ¿Por qué? El publisher envía redeemedAt (redemption) y nada de tiempo (activation), pero el consumer espera occurredAt. Causa terminal: divergencia de nombres entre NotifEvent.payload (backend) y MerchantNotifEvent (front) sin un tipo compartido en packages/shared que los una.
- **Evidencia:** `apps/api/src/services/notifications.service.ts:24`, `apps/web/src/lib/useMerchantNotifications.ts:112`
- **Fix sugerido:** Definir el contrato del payload en packages/shared y alinear nombres (occurredAt vs redeemedAt), incluyendo un timestamp también en activation.created. Que el front use ese timestamp real en lugar del fallback a Date.now().

### [S10-07] ⬜ pendiente — El id de la notificación se genera con Math.random()+Date.now() en vez de la clave estable (redemptionId/activationId) → sin dedupe ante doble entrega
- **Sector:** S10 · lentes 9, 10
- **Causa raíz:** ¿Por qué no deduplica? Porque el id se arma con `${data.id ?? random}-${Date.now()}` y data.id nunca existe (el payload trae redemptionId/activationId, no id). ¿Por qué? El generador de id no usó la clave de dominio estable disponible. Causa terminal: se eligió un id sintético no idempotente teniendo una clave natural (redemptionId/activationId) a mano.
- **Evidencia:** `apps/web/src/lib/useMerchantNotifications.ts:110`, `apps/api/src/services/notifications.service.ts:20`
- **Fix sugerido:** Usar data.redemptionId ?? data.activationId como id estable y, al mergear, descartar si ya existe ese id. Así reconexiones/reintentos no duplican filas ni inflan el unread.

### [S10-09] ⬜ pendiente — Fallback de API_URL hardcodeado a localhost:3001 mientras el API dev corre en :3002 (y env.PORT default también 3001)
- **Sector:** S10 · lentes 12
- **Causa raíz:** ¿Por qué el fallback está desalineado? El default en código (3001) no se actualizó cuando el entorno pasó a 3002 (.env.local). ¿Por qué no rompe siempre? Porque .env.local overridea a 3002; el default solo muerde si falta la env. Causa terminal: puerto hardcodeado duplicado en dos módulos como fallback, no derivado de una fuente única.
- **Evidencia:** `apps/web/src/lib/useMerchantNotifications.ts:31`, `apps/web/src/lib/push.ts:9`, `apps/web/.env.local:1`
- **Fix sugerido:** Unificar el fallback a 3002 (o al puerto real de dev) en ambos módulos, idealmente centralizando la base URL en un solo helper para no duplicar el literal.

### [S10-10] ⬜ pendiente — El stream SSE limpia la suscripción in-memory hasta 25s tarde y sin onAbort → listeners colgados por conexión abortada
- **Sector:** S10 · lentes 6, 9
- **Causa raíz:** ¿Por qué el listener sobrevive al corte? Porque la detección de 'muerto' depende de que falle un write, y los writes solo ocurren en heartbeat (25s) o al llegar un evento. ¿Por qué no antes? No se usa el hook onAbort de streamSSE para desuscribir ante desconexión. Causa terminal: teardown acoplado al fallo de escritura en vez de a la señal de abort de la conexión.
- **Evidencia:** `apps/api/src/routes/notifications.ts:53`, `apps/api/src/routes/notifications.ts:62`
- **Fix sugerido:** Usar stream.onAbort(() => { alive = false; unsubscribe?.() }) para desuscribir apenas la conexión se aborta, sin esperar el heartbeat.

### [S10-11] ⬜ pendiente — GET /notifications/ticket y /stream no exigen comercio activo ni tienen rate-limit → comercio suspendido/cancelado sigue abriendo el stream
- **Sector:** S10 · lentes 4, 5
- **Causa raíz:** ¿Por qué un suspendido recibe notificaciones? Porque /ticket solo aplica requireMerchantAuth, no requireMerchantActive; y /stream valida el ticket sin re-chequear estado. ¿Por qué? El foco de seguridad estuvo en no mandar el access en la URL (ticket efímero), no en el gating por estado del comercio. Causa terminal: falta requireMerchantActive en el endpoint de ticket/stream y falta rate-limit en estas rutas.
- **Evidencia:** `apps/api/src/routes/notifications.ts:13`, `apps/api/src/routes/notifications.ts:27`
- **Fix sugerido:** Agregar requireMerchantActive a /ticket (y validar estado al abrir /stream), y aplicar un rateLimit a /ticket para evitar emisión abusiva de tickets.

### [S11-03] ⬜ pendiente — Webhook MP duplicado dispara receipt de email duplicado por detección de activación no atómica (exists() en vez de modifiedCount)
- **Sector:** S11 · lentes 9
- **Causa raíz:** ¿Por qué dos receipts? Porque wasActivated no es la señal atómica de 'primera activación'. ¿Por qué? Se deriva de un read (exists) desacoplado del write (updateOne). ¿Por qué importa? Entre el exists y el updateOne hay un await (getPreapproval ya corrió, pero save/updateOne no son una sola operación) → dos ejecuciones ganan el exists. Causa terminal: falta idempotencia — no se usa el modifiedCount del compare-and-set atómico ni una clave de idempotencia por evento de webhook.
- **Evidencia:** `apps/api/src/routes/billing.ts:107`, `apps/api/src/routes/billing.ts:110`
- **Fix sugerido:** Derivar wasActivated de const r = await Merchant.updateOne({_id, estado:'pending_payment'},{estado:'activo'}); const wasActivated = r.modifiedCount === 1. Además dedupe por id de evento (guardar processed webhook ids).

### [S11-08] ⬜ pendiente — Firma del webhook se omite si no hay dataId y no existe dedupe de evento (replay dentro de la ventana de 5 min)
- **Sector:** S11 · lentes 9, 4
- **Causa raíz:** ¿Por qué se puede saltear la firma? El chequeo está condicionado a dataId, no es incondicional. ¿Por qué no rompe hoy? El bloque de mutación también exige dataId → sin dataId no muta. ¿Por qué sigue siendo riesgo? Un branch futuro sin dataId quedaría sin autenticar; y el único anti-replay es la ventana ts. Causa terminal: autenticación acoplada a un dato del payload en vez de ser un gate previo e incondicional, sin idempotencia por id de evento.
- **Evidencia:** `apps/api/src/routes/billing.ts:79`, `apps/api/src/routes/billing.ts:61`
- **Fix sugerido:** Verificar la firma incondicionalmente (rechazar si no hay dataId cuando type lo requiere) y persistir ids de evento procesados para idempotencia real.

### [S11-09] ⬜ pendiente — PATCH owner devuelve la suscripción SIN populate; el front la mergea sobre la fila poblada y borra las columnas Comercio/App (muestran '—')
- **Sector:** S11 · lentes 3, 6
- **Causa raíz:** ¿Por qué desaparece el nombre? Porque updated.merchantId es un ObjectId, no el objeto poblado. ¿Por qué? El PATCH no popula. ¿Por qué rompe la fila? El front confía en que la respuesta tenga la misma forma poblada que el listado. Causa terminal: contrato inconsistente entre GET (poblado) y PATCH (crudo), y merge optimista que asume forma idéntica.
- **Evidencia:** `apps/api/src/routes/owner.ts:1037`, `apps/owner/src/pages/SubscriptionsPage.tsx:87`, `apps/owner/src/pages/SubscriptionsPage.tsx:172`
- **Fix sugerido:** Popular appId/merchantId en el PATCH (igual que el GET) o, en el front, mergear solo campos escalares (status, nextBillingAt) preservando los objetos poblados.

### [S11-10] ⬜ pendiente — El receipt calcula período now..now+30d ignorando el next_payment_date real de MP → comprobante con período incorrecto
- **Sector:** S11 · lentes 7, 8
- **Causa raíz:** ¿Por qué período incorrecto? Se calcula con el reloj del servidor al procesar, no con los datos de MP. ¿Por qué? sendReceiptForSubscription no recibe el detail. Causa terminal: el comprobante deriva fechas de la hora de proceso en lugar del ciclo real de la suscripción.
- **Evidencia:** `apps/api/src/routes/billing.ts:32`, `apps/api/src/routes/billing.ts:106`
- **Fix sugerido:** Pasar el período real desde detail (current_period/next_payment_date) a sendReceiptForSubscription en vez de now+30d.

### [S11-12] ⬜ pendiente — AdminComercio muestra 'Cancelar suscripción' y copy de plan pagado a comercios en trial sin Subscription → cancelar tira 404 y el copy miente
- **Sector:** S11 · lentes 1, 6, 14
- **Causa raíz:** ¿Por qué error al cancelar? Porque no existe Subscription para un comercio en trial. ¿Por qué se ofrece cancelar? La UI asume que estado 'activo' ⇒ suscripción paga. ¿Por qué asume eso? El card no distingue trial de pago. Causa terminal: la UI de billing quedó modelada sobre el flujo pago-primero previo al bypass de MP (costura demo/real).
- **Evidencia:** `apps/web/src/pages/admin/AdminComercioPage.tsx:1433`, `apps/web/src/pages/admin/AdminComercioPage.tsx:1441`, `apps/api/src/routes/billing.ts:229`
- **Fix sugerido:** Distinguir trial vs pago en la card: si no hay Subscription mostrar 'Gratis hasta {freeTrialUntil}' sin botón cancelar (o con acción adecuada). Manejar el 404 con mensaje claro.

### [S11-13] ⬜ pendiente — Paginación offset del owner (loadMore) puede duplicar/saltear filas y desincronizar total mientras entran suscripciones
- **Sector:** S11 · lentes 10
- **Causa raíz:** ¿Por qué duplica? Offset-based sobre un dataset que muta en el tope del orden. ¿Por qué? Se usa skip/limit por índice en vez de cursor por createdAt/_id. Causa terminal: paginación por offset sin cursor estable frente a inserciones.
- **Evidencia:** `apps/owner/src/pages/SubscriptionsPage.tsx:63`, `apps/api/src/routes/owner.ts:1016`
- **Fix sugerido:** Paginar por cursor (createdAt/_id < last) o de-duplicar por _id al concatenar en el front.

### [S11-14] ⬜ pendiente — mapMpStatus default→'pending' puede degradar silenciosamente una suscripción authorized si MP emite un status no mapeado
- **Sector:** S11 · lentes 1, 6
- **Causa raíz:** ¿Por qué degrada? El default colapsa todo lo desconocido a 'pending' y el webhook sobreescribe siempre. ¿Por qué? Se prioriza 'defensivo' sin distinguir 'desconocido' de 'pendiente'. Causa terminal: mapeo lossy + escritura incondicional del status en cada webhook, sin guardar el status crudo ni ignorar transiciones inválidas.
- **Evidencia:** `apps/api/src/services/mp-signature.ts:78`, `apps/api/src/routes/billing.ts:104`, `apps/api/src/services/mp-signature.test.ts:176`
- **Fix sugerido:** No sobrescribir status con 'pending' ante valores desconocidos: preservar el status previo (o guardar el crudo) y solo aplicar transiciones conocidas.

### [S11-15] ⬜ pendiente — El webhook solo maneja topics preapproval; ignora payment/subscription_authorized_payment → fallos de cobro recurrente nunca suspenden al comercio
- **Sector:** S11 · lentes 9, 1
- **Causa raíz:** ¿Por qué no reacciona a impagos? No hay branch para los topics de pago. ¿Por qué? Solo se modeló el alta (preapproval). Causa terminal: cobertura incompleta del ciclo de vida de MP (falta el evento de cobro periódico), que además alimenta S11-01 (nada suspende por falta de pago).
- **Evidencia:** `apps/api/src/routes/billing.ts:93`, `apps/api/src/routes/billing.ts:63`
- **Fix sugerido:** Agregar manejo de payment/subscription_authorized_payment: ante pago fallido, pausar/suspender según política y propagar a Merchant.estado.

### [S11-16] ⬜ pendiente — El email OTP del comercio hardcodea '<subdomain>.micuidad.com' en vez de tenantFrontUrl/PLATFORM_DOMAIN → ignora customDomain y rompe en staging
- **Sector:** S11 · lentes 12, 1
- **Causa raíz:** ¿Por qué dominio equivocado? Se construyó la URL a mano en vez de usar el helper tenant-aware. ¿Por qué? Duplicación de lógica de URL. Causa terminal: existe tenantFrontUrl como fuente única (usada en billing back_url) pero merchant-auth no la reutiliza.
- **Evidencia:** `apps/api/src/routes/merchant-auth.ts:238`, `apps/api/src/lib/urls.ts:20`
- **Fix sugerido:** Usar tenantFrontUrl(tenant) + '/#/admin/login' en request-otp para respetar customDomain y PLATFORM_DOMAIN.

### [S12-06] ⬜ pendiente — Gráfico 'MRR por ciudad' grafica montos de distinta moneda en un mismo eje Y (COP y ARS comparados a la misma escala)
- **Sector:** S12 · lentes 8 (moneda mezclada) + 15
- **Causa raíz:** ¿Por qué es engañoso? Se grafica un número crudo sin normalizar por moneda. ¿Por qué? byCity ya mezcla monedas y el chart asume homogeneidad. Causa terminal: no hay conversión a una moneda base ni separación por moneda antes de comparar visualmente magnitudes.
- **Evidencia:** `apps/owner/src/pages/StatsPage.tsx:138`, `apps/owner/src/pages/StatsPage.tsx:137`, `apps/api/src/services/ownerStats.service.ts:55`
- **Fix sugerido:** Separar el chart por moneda (una serie/facet por currency) o convertir a una moneda base con FX antes de comparar alturas.

### [S12-07] ⬜ pendiente — POST /owner/apps no maneja E11000: subdomain duplicado (o carrera de slug) devuelve 500 en vez de 409
- **Sector:** S12 · lentes 9 (carrera/idempotencia) + 6
- **Causa raíz:** ¿Por qué 500? No hay catch de duplicate key en el POST y no se pre-chequea subdomain. ¿Por qué? El pre-check se hizo solo para slug asumiendo que el subdomain deriva del slug; los subdomains explícitos rompen esa asunción. Causa terminal: validación de unicidad hecha con read-then-write (no atómica) y cobertura parcial (solo slug), en vez de confiar en el índice unique + traducir E11000 como sí hace el PATCH.
- **Evidencia:** `apps/api/src/routes/owner.ts:669`, `apps/api/src/routes/owner.ts:657`, `apps/api/src/routes/owner.ts:778`
- **Fix sugerido:** Envolver App.create en try/catch traduciendo code===11000 a 409 (idéntico al PATCH), idealmente indicando si chocó slug o subdomain.

### [S12-08] ⬜ pendiente — logOwnerAction nunca persiste ownerEmail en OwnerAuditLog: la desnormalización 'sobrevive si el owner se borra' está muerta
- **Sector:** S12 · lentes 3 + 6
- **Causa raíz:** ¿Por qué vacío? El create omite ownerEmail. ¿Por qué? Se agregó el fallback en la lectura y el campo en el schema, pero la escritura (logOwnerAction) no se actualizó para hidratarlo. Causa terminal: la desnormalización se diseñó pero no se cableó en el único productor de filas; hoy es un salvavidas sin aire (latente porque los owners son soft-disable, nunca hard-delete).
- **Evidencia:** `apps/api/src/routes/owner.ts:72`, `apps/api/src/routes/owner.ts:442`, `apps/api/src/models/OwnerAuditLog.ts:12`
- **Fix sugerido:** Pasar ownerEmail a OwnerAuditLog.create (leer el email del owner una vez, o desde el token si se agrega el claim).

### [S12-09] ⬜ pendiente — apps/owner/src/lib/api.ts hardcodea fallback http://localhost:3001 pero la API dev del monorepo corre en :3002
- **Sector:** S12 · lentes 12 (URL/env hardcodeada) + 1
- **Causa raíz:** ¿Por qué 3001? Copia del default histórico (env.ts default PORT=3001) mientras la API real dev migró a 3002 (apps/api/.env). ¿Por qué no se notó? .env.local del owner setea 3002 y tapa el fallback en dev. Causa terminal: default divergente entre el consumidor (front) y el productor (api PORT) — el fallback debería ser el mismo puerto real o ausente (fail-fast).
- **Evidencia:** `apps/owner/src/lib/api.ts:10`
- **Fix sugerido:** Alinear el fallback a 3002 o eliminarlo y fallar explícito si VITE_API_URL falta en build de prod.

### [S12-10] ⬜ pendiente — SettingsPage: 'Rol' cae a 'super' cuando el rol es undefined, y 'Próximamente: Equipo' es copy stale (Equipo ya existe)
- **Sector:** S12 · lentes 1 (costura/stale) + 15
- **Causa raíz:** Default de presentación mal elegido (mínimo privilegio sería el default seguro) + roadmap escrito en UI que no se actualizó al shippear Equipo. Causa terminal: texto/valores de la UI no versionados contra el estado real de features.
- **Evidencia:** `apps/owner/src/pages/SettingsPage.tsx:53`, `apps/owner/src/pages/SettingsPage.tsx:106`
- **Fix sugerido:** Usar '—' (o 'viewer') como fallback de Rol y quitar 'Equipo' de la lista Próximamente.

### [S12-11] ⬜ pendiente — AppDetailPage muestra el botón 'Editar' a todos los roles (sin can('apps','editar')); guardar da 403 a viewer/soporte/finanzas
- **Sector:** S12 · lentes 5 (RBAC front) + 15
- **Causa raíz:** El gate de edición se aplicó en las entradas de creación pero no en el editor del detalle; inconsistencia de aplicación del RBAC en el front. Causa terminal: no hay un helper/route-guard central que oculte acciones de escritura por rol; se decide ad-hoc por página.
- **Evidencia:** `apps/owner/src/pages/AppDetailPage.tsx:224`, `apps/owner/src/pages/AppsPage.tsx:16`
- **Fix sugerido:** Envolver el botón Editar con can(auth.owner?.rol,'apps','editar').

### [S12-12] ⬜ pendiente — AppDetailPage: no se puede BORRAR un customDomain (draft vacío → undefined → no se envía → persiste el viejo)
- **Sector:** S12 · lentes 3 + 6
- **Causa raíz:** Convención '|| undefined' pensada para 'no pisar' choca con el caso 'querer limpiar'. Causa terminal: falta distinguir 'campo ausente' de 'campo puesto a vacío' (no se envía null explícito para desetear).
- **Evidencia:** `apps/owner/src/pages/AppDetailPage.tsx:149`
- **Fix sugerido:** Enviar customDomain: draft.customDomain.trim() === '' ? null : draft.customDomain y aceptar null en el schema/handler para $unset.

### [S12-13] ⬜ pendiente — Filtro de fechas de /audit trata from/to como medianoche UTC: 'to=YYYY-MM-DD' excluye todo ese día
- **Sector:** S12 · lentes 7 (fecha/timezone) + 6
- **Causa raíz:** new Date('YYYY-MM-DD') es UTC-midnight y $lte con esa fecha corta el inicio del día. Causa terminal: no se normaliza el 'to' a fin-de-día (23:59:59.999) ni se considera el offset del tenant (-03).
- **Evidencia:** `apps/api/src/routes/owner.ts:426`, `apps/api/src/routes/owner.ts:425`
- **Fix sugerido:** Si 'to' es fecha sin hora, setear $lte a fin de día (o $lt del día siguiente); documentar la zona horaria usada.

### [S12-14] ⬜ pendiente — Errores tragados en cargas secundarias del panel (loadMore de auditoría y fetch de apps para filtros)
- **Sector:** S12 · lentes 14 (errores tragados) + 6
- **Causa raíz:** catch vacío como atajo para 'no romper la vista' termina ocultando fallos reales. Causa terminal: manejo de error inconsistente (las cargas primarias sí setean error, las secundarias lo silencian).
- **Evidencia:** `apps/owner/src/pages/AuditPage.tsx:73`, `apps/owner/src/pages/MerchantsPage.tsx:31`, `apps/owner/src/pages/UsersPage.tsx:29`
- **Fix sugerido:** Setear un estado de error (o toast) también en loadMore y en la carga de apps para filtros.

### [S12-15] ⬜ pendiente — Snapshot MRR: upsert por date con índice unique puede lanzar E11000 bajo concurrencia (multi-instancia), perdiendo el snapshot de ese tick
- **Sector:** S12 · lentes 9 (idempotencia/carrera) + 1
- **Causa raíz:** upsert no es libre de carrera cuando dos procesos insertan la misma clave unique simultáneamente. Causa terminal: el loop es in-process pensado para 1 instancia; en horizontal no hay lock ni retry-on-11000.
- **Evidencia:** `apps/api/src/services/ownerSnapshot.service.ts:22`, `apps/api/src/models/MrrSnapshot.ts:10`
- **Fix sugerido:** Retry-on-11000 (re-ejecutar el updateOne, que a la segunda ya encuentra el doc) o un lock/leader-election para el loop en despliegues multi-instancia.

### [S12-16] ⬜ pendiente — MerchantsPage: suspender/reactivar bajo un filtro de estado deja la fila que ya no matchea y no ajusta el total
- **Sector:** S12 · lentes 6 (estados) + 10 + 15
- **Causa raíz:** La actualización optimista muta el item pero no re-evalúa el filtro ni el total. Causa terminal: el estado local no se reconcilia con el criterio de filtro tras una mutación que cambia justamente el campo filtrado.
- **Evidencia:** `apps/owner/src/pages/MerchantsPage.tsx:89`
- **Fix sugerido:** Tras la mutación, si el nuevo estado no matchea el filtro activo, quitar la fila y ajustar total (o refetch de la página).

### [S12-17] ⬜ pendiente — GET /owner/metrics suma el MRR cargando TODAS las suscripciones authorized en memoria (JS) en vez de agregación
- **Sector:** S12 · lentes 6 (lista de N grande) + 1
- **Causa raíz:** Se implementó el sum en JS en /metrics antes de existir computeMrr (que ya agrega en Mongo). Causa terminal: duplicación de lógica de MRR (una en /metrics, otra en ownerStats.service) sin reutilizar la agregación.
- **Evidencia:** `apps/api/src/routes/owner.ts:478`, `apps/api/src/services/ownerStats.service.ts:19`
- **Fix sugerido:** Reutilizar computeMrr() en /metrics (agregación por moneda) en vez del find+sum en memoria.

### [S13-01] ⬜ pendiente — El contador de escasez "Ya van N de 20 · quedan X lugares" cuenta TODOS los comercios activos y se traba en "quedan 0" para siempre, mientras el backend sigue regalando el mismo trato
- **Sector:** S13 · lentes 1,2,9,11
- **Causa raíz:** Por qué el contador miente → porque restantes=total-adheridos y adheridos=min(20, merchantsActivos). Por qué merchantsActivos no representa el 'cupo de lanzamiento' → porque cuenta countDocuments({estado:'activo'}) sin filtrar por foundingMember/cohorte. Por qué eso conflaciona todo → porque el alta nueva NO distingue cohorte: todo comercio nace estado:'activo' (merchant-auth.ts:102) con freeTrialUntil informativo que 'no corta nada'. Por qué existe ese desalineamiento → porque el modelo pasó de
- **Evidencia:** `apps/landing/src/lib/tenant.ts:197`, `apps/api/src/routes/tenant.ts:35`, `apps/api/src/routes/merchant-auth.ts:76`, `apps/landing/src/sections/Hero.tsx:87`
- **Fix sugerido:** Separar 'cohorte de lanzamiento' de 'comercios activos': contar merchantsActivos con filtro por foundingMember/cohorte, o exponer un campo dedicado 'cuposLanzamientoUsados' desde el backend. Y decidir el comportamiento en 0: si el cupo realmente cierra, gatear el alta o cambiar el CTA a lista de espera; si no cierra (backend actual), quitar la narrativa de cupo agotado y no mostrar 'quedan 0 lugar

### [S13-03] ⬜ pendiente — favicon/apple-touch-icon hardcodeados a /comercios/ y /vecino/ ignoran el base del build → 404 en el deploy GH Pages (assets van a /misanpedro/...)
- **Sector:** S13 · lentes 12,13,15
- **Causa raíz:** Por qué el favicon 404ea en GH Pages → porque su href /comercios/ solo matchea el base de Railway (/comercios/), no el de GH Pages (/misanpedro/comercios/). Por qué no se reescribe con el base → porque Vite no reescribe hrefs de <link icon> con ruta root-absoluta; solo procesa imports/módulos. Por qué se hardcodeó /comercios/ → porque se asumió un único deploy (micuidad.com raíz) al escribir el index. Causa terminal: dos targets de deploy con bases distintas (Railway /comercios/ vs GH Pages /mis
- **Evidencia:** `apps/landing/index.html:40`, `apps/landing/dist/index.html:94`, `apps/landing-vecino/index.html:36`
- **Fix sugerido:** Referenciar el favicon relativo al base (ej. href="favicon.svg" o usar %BASE_URL% en el index, que Vite sí reescribe) en vez de una ruta root-absoluta hardcodeada, para que funcione en ambos bases.

### [S13-04] ⬜ pendiente — Fallback de VITE_API_URL hardcodeado a http://localhost:3001, pero la API dev corre en :3002 → si falta .env.local el fetch del tenant falla en silencio
- **Sector:** S13 · lentes 12,14
- **Causa raíz:** Por qué el default apunta a :3001 → porque es el puerto viejo (apps/api/.env.example todavía dice PORT=3001). Por qué diverge del real → porque la API se movió a :3002 pero el fallback del cliente no se actualizó. Por qué no se nota → porque el error se traga en catch sin telemetría. Causa terminal: puerto por defecto stale duplicado en el cliente + manejo de error mudo.
- **Evidencia:** `apps/landing/src/lib/tenant.ts:51`, `apps/api/.env.example:3`, `apps/landing/src/lib/tenant.ts:129`
- **Fix sugerido:** Unificar el default a :3002 (o mejor, no adivinar puerto: fallar ruidoso en dev si falta VITE_API_URL) y alinear apps/api/.env.example a PORT=3002.

### [S13-05] ⬜ pendiente — COMERCIOS_URL / links cruzados usan ruta root-absoluta '/comercios/' que 404ea en GH Pages y en dev (solo resuelve en el deploy micuidad)
- **Sector:** S13 · lentes 12,15
- **Causa raíz:** Por qué el link rompe fuera de micuidad → porque '/comercios/' es root-absoluta y asume que la landing de comercio cuelga de la raíz del host. Por qué se asumió eso → porque el deploy primario (micuidad) sí lo cumple. Por qué no se parametrizó por base → porque no se contempló el target GH Pages con prefijo /misanpedro/. Causa terminal: cross-link entre las dos landings hardcodeado a un layout de host que no vale en todos los deploys.
- **Evidencia:** `apps/landing-vecino/src/lib/cn.ts:43`, `apps/landing-vecino/src/sections/Nav.tsx:54`, `apps/landing-vecino/src/sections/Comercios.tsx:53`
- **Fix sugerido:** Setear VITE_COMERCIOS_URL por target de deploy (incluir el prefijo /misanpedro/ en GH Pages) o derivar la URL del origin+base actual en vez de una ruta root-absoluta fija.

### [S13-06] ⬜ pendiente — El contador dinámico de lanzamiento está gateado por slug === 'sanpedro' hardcodeado → ninguna otra ciudad ve números reales, siempre copy genérico
- **Sector:** S13 · lentes 1,2
- **Causa raíz:** Por qué solo San Pedro ve el contador → porque el gate es config?.slug === 'sanpedro' literal en 5 lugares. Por qué se hardcodeó la ciudad → porque el lanzamiento arrancó como single-tenant San Pedro. Por qué no se generalizó → porque el pivot multi-ciudad (Mi[Ciudad]) no propagó a la lógica de escasez. Causa terminal: lógica de negocio por-ciudad codificada contra un slug fijo en la capa white-label.
- **Evidencia:** `apps/landing/src/sections/Hero.tsx:86`, `apps/landing/src/lib/tenant.ts:190`
- **Fix sugerido:** Reemplazar el gate por-slug por un flag/config del tenant (ej. app.settings.lanzamientoActivo o merchantsActivos>0) para que el contador funcione en cualquier ciudad.

### [S13-08] ⬜ pendiente — Pluralización incorrecta 'quedan 1 lugares' cuando restantes === 1 (múltiples secciones)
- **Sector:** S13 · lentes 7,15
- **Causa raíz:** Por qué sale mal → porque se interpola el número sin lógica de plural. Por qué no se contempló → porque no se probó el borde N-1. Causa terminal: copy con conteo dinámico sin pluralización.
- **Evidencia:** `apps/landing/src/sections/Hero.tsx:87`, `apps/landing/src/sections/Pricing.tsx:51`
- **Fix sugerido:** Usar 'lugar'/'lugares' según restantes===1 (helper de pluralización).

### [S13-09] ⬜ pendiente — Estructura DOM inválida/a11y: <details> como hijo directo de <dl> con <dt> dentro de <summary> (ambas landings)
- **Sector:** S13 · lentes 15
- **Causa raíz:** Por qué es inválido → porque se combinó el patrón nativo <details>/<summary> con el semántico <dl>/<dt>/<dd> sin envoltura válida. Por qué se hizo → para obtener el toggle nativo y a la vez semántica de definición. Causa terminal: dos patrones semánticos superpuestos sin contenedor permitido.
- **Evidencia:** `apps/landing/src/sections/FAQ.tsx:72`, `apps/landing-vecino/src/sections/FAQ.tsx:51`
- **Fix sugerido:** Envolver cada par en <div> dentro del <dl> o abandonar dl/dt/dd y usar solo <details>/<summary> con headings; no anidar <dt> dentro de <summary>.

### [S13-10] ⬜ pendiente — StickyCTA del vecino no evalúa el scroll inicial: no aparece si la página carga ya scrolleada (restauración de scroll)
- **Sector:** S13 · lentes 6,15
- **Causa raíz:** Por qué no aparece al cargar scrolleado → porque setShow solo corre en el evento scroll, no en el mount. Por qué falta el disparo inicial → porque se omitió el onScroll() de arranque que sí tiene el Nav. Causa terminal: estado derivado del scroll inicializado solo por evento, no por lectura inmediata.
- **Evidencia:** `apps/landing-vecino/src/sections/StickyCTA.tsx:20`, `apps/landing-vecino/src/sections/Nav.tsx:30`
- **Fix sugerido:** Llamar onScroll() una vez dentro del useEffect antes de suscribir el listener (como hace el Nav).

### [S13-11] ⬜ pendiente — Tap targets por debajo de 44px en mobile: botón hamburguesa (36px) y links de nav/footer
- **Sector:** S13 · lentes 15
- **Causa raíz:** Por qué son chicos → porque se dimensionaron por estética visual sin garantizar el área táctil mínima. Causa terminal: falta de mínimo de hit-area en controles mobile.
- **Evidencia:** `apps/landing/src/sections/Nav.tsx:92`
- **Fix sugerido:** Llevar el botón de menú a min 44x44 (h-11 w-11 o padding) y asegurar hit-area en links mobile.

### [S13-12] ⬜ pendiente — loginUrl definido pero nunca usado y la landing de comercio no ofrece CTA de 'Ingresar' para comercios existentes
- **Sector:** S13 · lentes 6
- **Causa raíz:** Por qué no hay login → porque el Nav prioriza conversión (signup) y se omitió el acceso de retorno. Por qué queda muerto → porque loginUrl se preparó pero no se cableó. Causa terminal: falta de entry point de retorno + export sin uso.
- **Evidencia:** `apps/landing/src/lib/cn.ts:51`
- **Fix sugerido:** Agregar un link secundario 'Ingresar' en el Nav que use loginUrl, o eliminar loginUrl si se decide no ofrecer login desde la landing.

### [S13-14] ⬜ pendiente — Sin analítica/medición instalada en ninguna de las dos landings pese a reenviar UTM a la PWA (no se puede medir conversión de la landing)
- **Sector:** S13 · lentes 14,1
- **Causa raíz:** Por qué no hay medición → porque quedó como TODO pendiente. Por qué importa → porque toda la optimización de conversión de una landing depende de medir; sin ella, los cambios de copy/CTA son a ciegas. Causa terminal: instrumentación de analytics no implementada.
- **Evidencia:** `apps/landing-vecino/index.html:58`
- **Fix sugerido:** Instalar un analytics liviano sin cookies (Plausible/Umami) en ambos index.html y trackear al menos pageview y clicks de CTA.

### [S13-15] ⬜ pendiente — La allowlist de CORS en dev no incluye los puertos de las landings (5181/5185) → probar branding de tenant localmente bloquea el fetch del config
- **Sector:** S13 · lentes 12,2
- **Causa raíz:** Por qué se bloquea → porque la allowlist dev enumera 5180/5173 pero no 5181/5185. Por qué se omitieron → porque las landings se agregaron después y su fetch normalmente no dispara en dev (slug null). Causa terminal: allowlist de dev incompleta respecto de los puertos reales de las landings.
- **Evidencia:** `apps/api/src/index.ts:59`
- **Fix sugerido:** Agregar http://localhost:5181 y http://localhost:5185 (y 127.0.0.1) a la allowlist de CORS en dev, o permitir cualquier localhost en no-prod.

### [S14-06] ⬜ pendiente — No se emite ningún header Content-Security-Policy pese al comentario que afirma tenerlo; el mismo server sirve SPA HTML y landings con contenido inyectado por tenant
- **Sector:** S14 · lentes 1,15
- **Causa raíz:** 1) ¿Por qué no hay CSP? Porque nunca se agregó el header. 2) ¿Por qué el comentario dice que sí? Porque quedó desactualizado. 3) ¿Por qué importa? Porque se sirven HTML con datos tenant-controlados. 4) ¿Por qué se toleró? Porque se asumió 'API JSON' cuando también sirve UI. 5) Causa terminal: defensa en profundidad ausente + comentario que da falsa sensación de cobertura.
- **Evidencia:** `apps/api/src/middleware/security.ts:9`, `apps/api/src/middleware/security.ts:12`
- **Fix sugerido:** Agregar una CSP mínima para las respuestas HTML (default-src 'self'; img-src 'self' data:; etc.), o al menos para las rutas que sirven index.html/landings; corregir el comentario.

### [S14-07] ⬜ pendiente — packages/shared (tipos de dominio) desincronizado del schema Mongoose y del front, y ADEMÁS no lo importa nadie → 'single source of truth' incumplido
- **Sector:** S14 · lentes 3,1
- **Causa raíz:** 1) ¿Por qué drifean los tipos? Porque el schema evolucionó (imagenUrl, expiresAt deprecado) y shared no. 2) ¿Por qué no rompió el build? Porque nadie importa esos tipos. 3) ¿Por qué existe la copia del web? Porque se tipó la capa API localmente. 4) ¿Por qué se mantiene shared? Por intención de contrato único que no se sostuvo. 5) Causa terminal: el contrato canónico quedó como código muerto que ya no refleja la realidad, invitando a que un futuro consumidor confíe en tipos falsos.
- **Evidencia:** `packages/shared/src/types.ts:106`, `packages/shared/src/types.ts:143`, `apps/api/src/models/Coupon.ts:18`
- **Fix sugerido:** O bien re-sincronizar shared/types.ts con el schema (imagenUrl, expiresAt opcional/eliminado, cover/logoSeed opcionales, montoTicket) y hacer que api+web lo importen, o bien borrar los tipos de dominio de shared y documentar que sólo los Zod son compartidos, para no dejar un contrato falso.

### [S14-08] ⬜ pendiente — onError filtra err.message al cliente cuando isProd es false
- **Sector:** S14 · lentes 14,4
- **Causa raíz:** 1) ¿Por qué se filtra? Porque el branch de dev devuelve message. 2) ¿Por qué depende de isProd? Porque isProd=NODE_ENV==='production'. 3) ¿Por qué es frágil? Porque NODE_ENV puede faltar en runtime. 4) ¿Por qué no hay redacción por default? Porque el default es 'development'. 5) Causa terminal: default inseguro (dev) para una decisión de exposición de errores.
- **Evidencia:** `apps/api/src/index.ts:364`, `apps/api/src/index.ts:359`
- **Fix sugerido:** Redactar por default: sólo exponer message si NODE_ENV==='development' explícito. Idealmente unificar con S14-01 (fail-closed).

### [S14-09] ⬜ pendiente — CORS allowHeaders no incluye x-admin-token y el preflight se cachea 24h
- **Sector:** S14 · lentes 12,5
- **Causa raíz:** 1) ¿Por qué falla el admin desde browser? Porque su header no está permitido. 2) ¿Por qué maxAge 24h? Por performance. 3) ¿Por qué es riesgo? Porque acopla despliegues de config a una ventana de 24h. 4) ¿Por qué no se notó? Porque admin.ts se usa por script/curl. 5) Causa terminal: allowlist de headers incompleta + TTL de preflight alto sin plan de invalidación.
- **Evidencia:** `apps/api/src/index.ts:83`, `apps/api/src/index.ts:86`
- **Fix sugerido:** Si se quiere un admin UI browser, agregar x-admin-token a allowHeaders. Considerar bajar maxAge (ej. 3600) mientras la config esté cambiando.

### [S14-10] ⬜ pendiente — sentry.service.ts: comentario obsoleto dice que el SDK 'no está instalado por defecto', pero @sentry/node es dependencia
- **Sector:** S14 · lentes 1,14
- **Causa raíz:** 1) ¿Por qué confunde? Porque el comentario quedó de una etapa previa. 2) ¿Por qué no se actualizó? Porque agregar la dep no tocó el doc. 3) ¿Por qué importa? Porque afecta decisiones de observabilidad en prod. 4/5) Causa terminal: doc-drift entre comentario y manifest.
- **Evidencia:** `apps/api/src/services/sentry.service.ts:6`, `apps/api/package.json:18`
- **Fix sugerido:** Actualizar el comentario: el SDK ya está instalado; el tracking se activa sólo con SENTRY_DSN.

### [S14-11] ⬜ pendiente — Snapshot de MRR usa fecha UTC como clave 'de hoy' → en AR (-03) el corte diario ocurre a las 21:00 local
- **Sector:** S14 · lentes 7,8
- **Causa raíz:** 1) ¿Por qué el corte a las 21? Porque UTC-3. 2) ¿Por qué UTC? Porque se usó toISOString(). 3) ¿Por qué no locale del tenant? Porque el snapshot es global (multi-ciudad, multi-huso). 4) ¿Por qué se eligió UTC? Por estabilidad simple. 5) Causa terminal: clave de día sin huso del negocio.
- **Evidencia:** `apps/api/src/services/ownerSnapshot.service.ts:13`
- **Fix sugerido:** Documentar que la clave es UTC, o normalizar a America/Argentina/Buenos_Aires (o al locale del operador) para que el 'día' coincida con el día comercial.

### [S14-12] ⬜ pendiente — requestId refleja el x-request-id provisto por el cliente (≤200 chars) en el header de respuesta y en el body de error
- **Sector:** S14 · lentes 14,4
- **Causa raíz:** 1) ¿Por qué se refleja? Porque respeta el id upstream. 2) ¿Por qué sin charset? Porque sólo chequea longitud. 3) ¿Por qué es menor? Porque el runtime bloquea CRLF y no hay uso sensible. 4/5) Causa terminal: confianza en un header no autenticado para correlación.
- **Evidencia:** `apps/api/src/middleware/security.ts:36`
- **Fix sugerido:** Validar un charset acotado (ej. [A-Za-z0-9._-]) además de la longitud, o generar siempre el id server-side salvo proxy confiable.


---

# Refutados por el verificador adversarial (8)

- **[S6-08]** Gates de loading/error acoplados a localCoupons.length===0: hoy inertes (SEED vacío) pero rompen si el store local se llena en el mismo origin — Las tres citas son textualmente correctas: MisCuponesPage.tsx:92 (`apiFailed = PROD && !!apiError && localCoupons.length===0`), DescuentosPage.tsx:183 (`if (isLoading && localCoupons.length===0)`), co
- **[S9-16]** {{link}} usa window.location.origin y descarta el base path del router → link roto en deploys con subpath (ej. GH Pages /misanpedro/) — Cita exacta y real en AdminWhatsappPage linea 411 y 421, no inventada. Pero el bug afirma links rotos bajo deploy con subpath, y ese escenario no existe en prod. nixpacks.toml buildea el paquete web c
- **[S10-08]** Typo 'micuidad' en el default de VAPID_SUBJECT (y de SUPPORT_EMAIL / VITE_SUPPORT_EMAIL) — dominio de contacto push inválido — Las citas son literalmente exactas (env.ts:51 VAPID_SUBJECT default 'mailto:soporte@micuidad.com', env.ts:59 SUPPORT_EMAIL 'soporte@micuidad.com', web/.env.local:3 VITE_SUPPORT_EMAIL=soporte@micuidad.
- **[S11-11]** freeTrialUntil nunca se enforcea: el 'trial de 3 meses' no tiene borde y el copy de landing/Features promete un cobro MP post-trial que ningún backend dispara — La afirmación tiene dos patas y ambas caen. (1) BACKEND — es cierto que freeTrialUntil no se enforcea: grep en apps/api/src solo lo usa en merchant-auth.ts:77/103 (lo setea al alta), coupons.ts:166-17
- **[S13-02]** Pricing/Features/FAQ prometen cobro automático por MercadoPago al 4º mes y 'cancelás desde tu panel', pero el alta no toma tarjeta, freeTrialUntil no corta nada y no hay UI de cancelación — Evidencia fabricada/stale + afirmación central refutada. (1) Features.tsx:44 NO contiene "Empezás sin tarjeta. Recién cobramos por MercadoPago cuando terminan los 3 meses gratis" — la palabra MercadoP
- **[S13-07]** Sopa de dominios: canonical/OG hardcodean misanpedro.com, el código usa micuidad.com (typo de 'ciudad') y la API usa misanpedro.app — inconsistencia SEO/marca — La evidencia citada es fabricada/stale. El finding afirma que apps/landing/index.html:13 hardcodea el canonical en 'https://misanpedro.com/comercios/'; FALSO: el canonical real está en index.html:22 y
- **[S13-13]** Datos inconsistentes en el mockup del Hero: 'cumple en julio' vs stat 'Cumple 11 abr · Próximo en 14 días' — La evidencia citada NO coincide con el archivo real (evidencia inventada). El finding afirma que la línea 213 dice `<p className="text-[10px] text-white/80">35 años · cumple en julio</p>` y la 221 `<S
- **[S14-01]** NODE_ENV/TRUST_PROXY sólo declarados en nixpacks.toml [variables] (fase build) → si faltan en runtime, cascada a takeover del owner — Las 3 citas coinciden con el código real (owner.ts:129 gatea _debugCode por NODE_ENV==='production'; env.ts:4 defaultea a 'development'; nixpacks declara NODE_ENV en [variables]). Pero la premisa term
