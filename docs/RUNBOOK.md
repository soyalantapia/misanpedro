# RUNBOOK — Operaciones e incidentes (Mi Ciudad)

> Qué hacer **cuando algo se rompe en producción**. Pensado para resolver rápido bajo presión.
> Contexto técnico completo: [`../PROJECT.MD`](../PROJECT.MD) · trampas: [`../work-agent/02-DEPLOY-Y-GOTCHAS.md`](../work-agent/02-DEPLOY-Y-GOTCHAS.md).

## Coordenadas de emergencia

| Recurso | Dónde |
|---|---|
| Health del API | `https://api.micuidad.com/api/v1/health` (devuelve `{ok, uptime, db}`; **503 si Mongo no está conectada**) |
| Logs / deploys / variables | Railway → proyecto `misanpedro-api` → servicio `api` |
| DNS / SSL | Cloudflare → zona `micuidad.com` |
| Buzón de correo (SMTP) | Hostinger → `soporte@micuidad.com` |
| Repo | `github.com/soyalantapia/misanpedro` (rama `main`) |
| Deploy | `railway up --detach --environment production --service api` (desde `~/dev/misanpedro`) |

## Diagnóstico en 30 segundos
```bash
curl -s -w " [%{http_code}]\n" https://api.micuidad.com/api/v1/health   # 200 = sano · 503 = Mongo caída
curl -s -o /dev/null -w "%{http_code}" https://sanpedro.micuidad.com   # ¿sirve el front?
```
- `db` ≠ `connected` → problema de Mongo (ver §"DB caída").
- `uptime` muy bajo y subiendo → reinició recién (¿deploy? ¿crash-loop?).
- 502/503 desde Cloudflare → el servicio Railway está caído o reiniciando.

---

## Incidente: el login del comercio/owner no manda el código (OTP)
**Síntoma:** `/request-otp` devuelve **503** o el email nunca llega.
1. Es casi siempre el **SMTP**. Verificá en Railway que estén `SMTP_HOST/PORT/USER/PASSWORD/SECURE` + `EMAIL_FROM`.
   El que más falta históricamente es **`SMTP_PASSWORD`** (la del buzón `soporte@micuidad.com`).
2. Probá el buzón directo en Hostinger (webmail) para descartar que la cuenta esté bloqueada.
3. DNS de email (SPF/DKIM/DMARC) ya está correcto — si el email "sale" pero cae en spam, NO es DNS;
   revisá reputación/contenido.
4. Workaround temporal: setear `RESEND_API_KEY` (fallback del `email.service.ts`).

## Incidente: "deployé y sigo viendo lo viejo" (PWA)
**Causa:** el **Service Worker** de `apps/web` sirve el bundle cacheado.
1. Hard refresh (Cmd+Shift+R). Si persiste, en la consola del navegador:
   ```js
   (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
   (await caches.keys()).forEach(k => caches.delete(k));
   location.reload();
   ```
2. El **owner** (`administracion.micuidad.com`) **no** tiene SW → ahí siempre ves lo último.
3. Confirmá primero que el deploy realmente entró: polleá `uptime` en `/health` (resetea a ~0 con el build nuevo).

## Incidente: el deploy falla
1. Railway **mantiene el deploy anterior** si el build o el healthcheck fallan → prod NO se rompe. Respirá.
2. Si falla el **healthcheck** (no el build): el server arrancó pero no pudo conectar a Mongo. Mirá los
   Deploy Logs y buscá `failed to connect DB; starting anyway`. Casi siempre es `MONGODB_URI` faltante o
   equivocada en las variables del servicio. Antes de este chequeo el `/health` devolvía `ok:true` con la
   base caída, así que un deploy así pasaba y entraba a servir con TODAS las rutas fallando.
3. Mirá los **Build Logs** en Railway. Causas típicas:
   - El **guardrail** `check-no-hardcoded-tenant.mjs` encontró un nombre de ciudad hardcodeado → arreglalo (usá `appName()`/`useTenant()`).
   - Error de typecheck/test en el build.
3. Reproducí local: `pnpm typecheck && pnpm turbo run test && pnpm check:tenant && pnpm build`.
4. **Rollback:** en Railway → Deployments → "Redeploy" sobre el último deploy sano.

## Incidente: el API está caído (502/503)
1. `/health` no responde o `db` ≠ connected.
2. Railway → servicio `api` → **Logs** (¿crash al boot? ¿Mongo no conecta?).
3. Si es crash-loop por un deploy nuevo → **rollback** al deploy anterior (Deployments → Redeploy).
4. **DB caída:** el servicio MongoDB es interno a Railway. Revisá su estado en el proyecto. La DB de prod
   **no se alcanza desde local** (no hay quick-fix por shell externo).

## Incidente: un subdominio de ciudad no resuelve / SSL roto
1. Cloudflare: `*` CNAME → Railway debe estar en **DNS-only (nube gris)**, no proxied.
2. SSL wildcard de Railway depende de `_acme-challenge` + `_railway-verify`. Si un subdominio nuevo no
   tiene SSL, esperá la emisión o revisá el dominio custom en Railway (`railway domain`).
3. Una ciudad resuelve por su `slug`/`subdomain`. Para ñ → punycode (`minariño` = `xn--minario-9za`).

## Incidente: sospecha de fuga entre ciudades (multi-tenant)
1. **No debería pasar** — está verificado (0 leaks). Pero si lo sospechás: el `appId` SIEMPRE sale del
   host/header, nunca del token. Revisá que la query nueva filtre por `getAppId(c)`.
2. Reproducí con `apps/api/src/routes/tenant-isolation.integration.test.ts` como molde.

## Incidente: algo raro hecho "por un comercio" que no fue el comercio
1. Puede ser una **sesión de soporte** (un owner operando como el propietario). Mirá `GET /owner/audit`
   filtrando `action=support.*` → ahí está **qué owner** entró, a qué comercio y qué mutó.
2. Para cortar sesiones de soporte de un comercio: `POST /owner/merchants/:id/revoke-support`.

---

## Operaciones rutinarias
- **Crear una ciudad:** panel owner → "Nueva app" (ver [`onboarding-new-city.md`](onboarding-new-city.md)).
- **Suspender/reactivar un comercio:** panel owner → Merchants → acción (o `PATCH /owner/merchants/:id {estado}`).
- **Ver métricas (MRR, comercios, canjes):** panel owner → dashboard (en vivo + snapshot diario).
- **Dar soporte a un comercio:** panel owner → Merchants → "Soporte" (entra como el propietario, auditado).
- **Cambiar datos de prod sin owner:** `SEED_CITY_JSON`/`SEED_CITY_UPDATE` por env + `railway up` (idempotente), después borrar la var.

## 🔴 Deploy del login por email del vecino — el orden importa

**Sólo aplica al deploy que estrena la identidad por email** (rama `cazabug/loop1-iso`). Una vez hecho,
este bloque se puede borrar.

El índice `{appId, email}` del vecino es **único y sin filtro parcial**: asume que todo vecino tiene
email. `User.syncIndexes()` corre al **bootear el API en producción**, y primero DROPEA los índices
viejos y después crea los nuevos.

Si se deploya antes de migrar, y quedó más de una cuenta sin email, la creación del único falla por
claves nulas duplicadas, el error se traga como "no fatal" y **el API arranca sin la unicidad de
identidad** — se pueden crear dos cuentas con el mismo email. (Desde este deploy ese error también
va a Sentry, pero el daño ya está hecho.)

**El orden es:**
```bash
# 1) Simulación: NO borra nada, lista las cuentas sin email y frena si alguna tiene canjes reales.
node --env-file=.env --import tsx apps/api/scripts/migrate-vecinos-email.ts

# 2) Recién si la simulación se ve bien:
node --env-file=.env --import tsx apps/api/scripts/migrate-vecinos-email.ts --apply

# 3) Ahora sí, deployar.
```

**Después del deploy, verificar que el índice EXISTE** (si no está, la unicidad no está garantizada):
```bash
# en la Mongo de prod
db.users.getIndexes()   # tiene que aparecer appId_1_email_1 con unique: true
```

## Verificación post-deploy (smoke)
```bash
curl -s https://api.micuidad.com/api/v1/health                  # ok + db connected
curl -s -o /dev/null -w "%{http_code}" https://sanpedro.micuidad.com    # 200
curl -s -o /dev/null -w "%{http_code}" https://administracion.micuidad.com  # 200 (owner)
```
Más un click-through del flujo tocado (login, canje, alta…), desregistrando el SW si es la PWA.
