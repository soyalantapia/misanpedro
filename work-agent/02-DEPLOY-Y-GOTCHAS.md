# 02 · Deploy, comandos, secretos y gotchas

## Setup local
```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"   # Node 22 obligatorio
cd ~/dev/misanpedro
pnpm install
pnpm dev                 # web + api en paralelo (turbo)
# o por separado:
pnpm dev:web             # PWA vecino/comercio
pnpm dev:api             # API
```
- Dev usa la DB de **Atlas** (reachable). `apps/api/.env` tiene `MONGODB_URI`, `JWT_SECRET`, etc.
- `apps/web/.env.local` → `VITE_API_URL=http://localhost:3002` (o el puerto del API dev).
- Para probar un tenant en local: `?tenant=narino` en la URL (localhost no tiene subdominio).

## Verificación antes de deployar
```bash
pnpm typecheck                 # tsc en los 6 paquetes
pnpm turbo run test            # TODOS los tests (269 = 130 api + 139 web) — OJO: "pnpm test" a secas NO corre nada
pnpm --filter @misanpedro/api test     # solo API (130)
pnpm --filter @misanpedro/web test     # solo web (139, incluye guardrail)
pnpm check:tenant              # guardrail: no "Mi San Pedro" hardcodeado en web/owner
```

## Checklist de cierre de tanda (cortar el drift recurrente)
El deploy es manual desde el working tree y la doc se mantiene a mano → la auditoría del 02/07 encontró
drift 3 veces. Para no repetirlo, al terminar una tanda hacé SIEMPRE, en este orden:
1. **Verde local:** `pnpm typecheck && pnpm turbo run test && pnpm check:tenant`.
2. **Commit + push** (nunca deployar sin haber pusheado — así GitHub no queda atrás de prod).
3. **Deploy:** `railway up …` + confirmar `uptime` reseteado en `/api/v1/health` + smoke del flujo tocado.
4. **Doc en el mismo cierre:** `CHANGELOG` (entrada de la tanda) + `01-PENDIENTES` (mover lo hecho, agregar
   lo nuevo) + conteo de tests si cambió. La doc viva se actualiza en la misma sesión, no "después".

## Deploy a producción (Railway)
**Un solo comando** (sube el código local, buildea web+owner+api con nixpacks y lo sirve):
```bash
cd ~/dev/misanpedro
railway up --detach --environment production --service api
```
- El build de Railway (`nixpacks.toml`) corre, en orden: **1)** `node scripts/check-no-hardcoded-tenant.mjs` (si reaparece "Mi San Pedro" → **falla el deploy**), **2)** `turbo run build --filter web/owner/api` con `VITE_BASE=/` y `VITE_API_URL=https://api-production-43c52.up.railway.app`, **3)** start `node apps/api/dist/index.js`.
- Healthcheck: `/api/v1/health`. Si el build/healthcheck falla, Railway **mantiene el deploy anterior** (no rompe prod).
- **Confirmar que quedó vivo:** poll de `https://sanpedro.micuidad.com/api/v1/health` hasta que `uptime` sea bajo (reseteó = build nuevo).
- Git: `main` es pusheable directo (este repo es propio, `soyalantapia/misanpedro`). El deploy NO depende de pushear (sube el working tree), pero conviene commitear+pushear igual.

> **Front estático en Hostinger (legacy):** ya NO se usa para micuidad.com. Quedan los
> scripts `deploy:micuidad` / `deploy:hostinger` para el sitio viejo, pero el flujo actual
> es todo Railway.

## Secretos que faltan / que el usuario setea en Railway (servicio `api`, environment `production`)
> **NUNCA** poner valores reales en docs ni commits. El asistente NO ingresa secretos.

| Variable | Para qué | Estado |
|---|---|---|
| `SMTP_PASSWORD` | login OTP (buzón soporte@micuidad.com) | ✅ seteada — SMTP FUNCIONA en prod (verificado 02/07). Pendiente: **rotarla** (se pegó en un chat), ver doc 01 §B |
| `SMTP_HOST/PORT/SECURE/USER`, `EMAIL_FROM` | resto del SMTP | ✅ seteadas |
| `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` / `MP_WEBHOOK_SECRET` | cobros MercadoPago (sin token = modo MOCK) | faltan (cuando se quiera cobrar real) |
| `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET` | core | ✅ |
| `OWNER_BOOTSTRAP_EMAIL/PASSWORD/NOMBRE`, `OWNER_2FA_REQUIRED` | bootstrap del owner (one-time) | ✅ (owner ya creado; 2FA OFF por decisión) |
| `APP_URL_FRONT` | links de email / back_url MP (hoy global) | revisar |

## Crear una ciudad nueva
- **Recomendado:** desde el panel owner (`administracion.micuidad.com`, logueado) → "Nueva app".
  Captura nombre→(localidad auto), país→(moneda/locale/prefijo auto), precio, color, geoCenter (lat/lng).
  El subdominio se deriva (`mi<slug>`) y resuelve solo (wildcard de Cloudflare). Cero infra por ciudad.
- **Sin login / DB no alcanzable:** `seedCityFromEnv()` — setear `SEED_CITY_JSON={...}` en Railway +
  `railway up` (crea la App al boot, idempotente) → borrar la var (`railway variable delete SEED_CITY_JSON`).

## Gotchas (trampas que ya nos mordieron — LEER)
1. **Service worker / caché de la PWA.** `apps/web` tiene SW (Workbox). Tras un deploy, el
   navegador puede seguir mostrando la versión vieja hasta que el SW se actualice → **hacer
   hard refresh (Cmd+Shift+R)**. Pasó varias veces ("sigo viendo lo viejo"). El owner NO tiene SW.
2. **El build del API es esbuild, no tsc.** `apps/api` build = `tsc -b --noEmit && node build.mjs`
   (esbuild resuelve el alias `@/`). El **`typecheck` (`tsc -b`) EMITE** y pisa `dist/index.js`
   con `@/` sin resolver → si corrés typecheck y después `node dist/index.js` local, falla con
   `ERR_MODULE_NOT_FOUND '@/env'`. En Railway no pasa (build limpio). Si necesitás correr el
   bundle local, reconstruí con `pnpm --filter @misanpedro/api build` (NO typecheck después).
3. **Prod Mongo es INTERNO a Railway** → no se alcanza desde local. Seeds/migraciones corren al
   boot dentro de Railway (`db/connection.ts`, `seed.service.ts`). Para cambiar datos de prod:
   panel owner, o `SEED_CITY_JSON`/`SEED_CITY_UPDATE` por env.
4. **Guardrail `check:tenant`.** No hardcodees el nombre de una ciudad en `apps/web`/`apps/owner`:
   usá `useTenant()`/`appName()`. El regex `/Mi\s+San\s+Pedro/i` exige espacios (matchea el
   nombre visible, NO el identificador `misanpedro` de storage keys/hosts, que es legítimo).
5. **zsh + `grep` = ugrep.** `grep --include` después de varios paths falla raro; poné `--include`
   ANTES del path y un path por vez. Para grepear bundles minificados (UTF-8), usá Python, no
   `LC_ALL=C grep` (tira "character not in range").
6. **Playwright MCP deja el browser lockeado** entre navegaciones a veces. Si "Browser is already
   in use": `pkill -9 -f ms-playwright-mcp` + borrar `SingletonLock`. Para ver el build fresco sin
   el SW viejo, borrar `~/Library/Caches/ms-playwright-mcp/.../Default/Service Worker` y `/Cache`.
7. **NO confundir con repos Deenex.** Este repo (`soyalantapia/misanpedro`) SÍ permite push a
   `main`. (La regla "nunca a main" es para los repos de Deenex, no este.)
