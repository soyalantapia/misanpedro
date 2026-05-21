# Deploy del backend (apps/api) en Railway

Guía paso-a-paso para subir el backend a Railway y conectar el PWA público.
**Tiempo estimado: 15-20 minutos.**

---

## 🚀 Quick start (TL;DR)

Si solo querés los pasos esenciales:

1. **Railway → New Project → Deploy from GitHub repo → `soyalantapia/misanpedro`**
2. **+ New → Database → MongoDB**
3. **Service API → Variables → pegar las 5 vars obligatorias** (ver Paso 3)
4. **Service API → Settings → Networking → Generate Domain** → copiar URL
5. **En tu compu**, editar `apps/web/.env.production` con la URL de Railway:
   ```
   VITE_API_URL=https://TU-URL.up.railway.app
   ```
6. **Re-build + re-deploy del PWA**:
   ```bash
   pnpm --filter @misanpedro/web build
   pnpm --filter @misanpedro/web deploy:gh-pages
   git add apps/web/.env.production && git commit -m "config: URL del API público" && git push
   ```

Listo. Probá el signup en https://soyalantapia.github.io/misanpedro/#/admin/registro.

---

## ⚠️ Importante — Seguridad

**No necesitamos OAuth de Railway para este deploy.** Conectá Railway con GitHub
desde el UI directamente. Si en algún momento compartiste un Client Secret de
Railway OAuth (en chat con un asistente, en Slack, en Discord, etc.), considéralo
comprometido: borralo desde Railway → Settings → Developer → tu app y generá
uno nuevo guardándolo en un password manager. Lo mismo para los API tokens
(Account Settings → Tokens).

---

## Paso 1 — Crear el proyecto en Railway

1. Andá a https://railway.app → New Project
2. Elegí **"Deploy from GitHub repo"**
3. Conectá tu cuenta GitHub si no está conectada
4. Seleccioná el repo `soyalantapia/misanpedro`
5. Railway va a empezar a construir automáticamente leyendo el
   `nixpacks.toml` de la raíz del repo

**Resultado esperado:** un service llamado por default `misanpedro` con
status "Building". El primer build tarda 3-5 minutos (instala pnpm + deps).

---

## Paso 2 — Agregar MongoDB

En el mismo proyecto:

1. Click en **"+ New"** (botón superior derecha del canvas)
2. Elegí **"Database" → "Add MongoDB"**
3. Railway crea un MongoDB managed
4. Click en el service de MongoDB recién creado → tab **"Variables"**
5. Copiá el valor de `MONGO_URL` (lo vamos a usar como `MONGODB_URI` en el API)

**Resultado esperado:** un segundo service tipo MongoDB con status "Active"
y una connection string lista en Variables.

---

## Paso 3 — Configurar env vars del API

Volvé al service del API (el primero, que está deployando):

1. Click en el service → tab **"Variables"**
2. Sumá las siguientes variables (copy-paste desde `apps/api/.env.example`):

### Vars OBLIGATORIAS

```
MONGODB_URI         = <pegá el MONGO_URL del paso 2>
JWT_SECRET          = <generá con: openssl rand -base64 48>
JWT_REFRESH_SECRET  = <generá con: openssl rand -base64 48>  (DIFERENTE al JWT_SECRET)
NODE_ENV            = production
TRUST_PROXY         = true
```

### Vars con valores por default OK

```
APP_URL_FRONT       = https://soyalantapia.github.io/misanpedro
                      (cuando tengamos cuponcito.app, lo cambiamos)
APP_URL_API         = <Railway te da la URL pública en tab Settings → Networking>
CORS_ORIGINS        = (vacío por ahora)
PLAN_AMOUNT_ARS     = 25000
SUPPORT_EMAIL       = hola@misanpedro.app
SUPPORT_WHATSAPP    = +5493329000000
```

### Vars OPCIONALES (dejá vacío al inicio)

```
SUPER_ADMIN_TOKEN   = <vacío por ahora — Fase 1 lo reemplaza>
MP_ACCESS_TOKEN     = (vacío → MercadoPago en modo mock)
MP_PUBLIC_KEY       = (vacío)
MP_WEBHOOK_SECRET   = (vacío)
RESEND_API_KEY      = (vacío → emails se loguean a consola)
SENTRY_DSN          = (vacío)
```

3. Después de pegar todas las vars, click **"Save"** (Railway redeploys auto).

---

## Paso 4 — Generar URL pública del API

1. Click en el service API → tab **"Settings"** → sección **"Networking"**
2. Click **"Generate Domain"**
3. Railway te genera algo tipo: `cuponcito-api-production-XXXX.up.railway.app`
4. Copiá esa URL y volvé a tab **"Variables"** → editá `APP_URL_API` con esa URL
5. Save → Railway redeploys con la URL correcta

---

## Paso 5 — Verificar el healthcheck

Abrí en el navegador:

```
https://TU-URL-DE-RAILWAY/api/v1/health
```

**Resultado esperado:**

```json
{
  "ok": true,
  "env": "production",
  "db": "connected",
  "uptime": 12,
  "memoryMB": { "rss": 89, "heapUsed": 32, "heapTotal": 56 },
  "timestamp": "2026-05-15T14:30:00.000Z",
  "requestId": "..."
}
```

Si ves `"db": "disconnected"` → revisá que `MONGODB_URI` esté bien pegada
y que el cluster de Mongo esté Active.

---

## Paso 6 — Configurar healthcheck en Railway (opcional pero recomendado)

1. Service API → Settings → **"Healthcheck"**
2. Path: `/api/v1/health/ready`
3. Timeout: 10s
4. Railway va a reintentar el deploy si el endpoint no devuelve 200 en 30s

---

## Paso 7 — Actualizar el CORS del API con tu URL de Railway

Tu frontend (PWA + landing en GH Pages) va a llamar al API. Hay que
agregar los orígenes en `CORS_ORIGINS`:

```
CORS_ORIGINS = https://soyalantapia.github.io
```

Save → Railway redeploys. Listo.

---

## Troubleshooting común

### "Build failed: nixpacks couldn't find package.json"
→ El Root Directory está mal. Settings → Build → Root Directory = `/` (vacío).

### "MongoNetworkError: connection refused"
→ Si usás Atlas (no Railway MongoDB), tenés que whitelist `0.0.0.0/0` en
   Network Access. Si usás Railway MongoDB no debería pasar.

### "Module not found: @misanpedro/shared"
→ El build no instaló las deps del workspace. Verificá que el
   `nixpacks.toml` esté en la raíz del repo (NO en `apps/api/`).

### "Error: PORT is required"
→ Railway inyecta `PORT` automáticamente. Si falta, revisá que NO
   tengas un valor hardcoded en Variables — dejá que Railway lo provea.

### El service queda en "crashed loop"
→ Mirá los logs en Deployments → último deploy → Logs. Buscá:
   - `[bootstrap] failed to connect DB` → MONGODB_URI mal
   - `❌ Variables de entorno inválidas` → falta algún var obligatorio
   - `EADDRINUSE` → conflicto de puerto (raro en Railway)

---

## Próximos pasos (después de que el API esté live)

1. **Confirmá que `/api/v1/health` devuelve 200** desde el dominio Railway.
2. **Avisame en el chat la URL pública** para arrancar Fase 1 (backend
   multi-tenant).
3. **Si tenés MP credentials de prod**, las podés agregar ahora o más
   adelante — el deploy funciona sin ellas.

---

## Cheat sheet de comandos útiles (Railway CLI)

```bash
# Login
railway login

# Linkear el repo al proyecto
railway link

# Ver logs en vivo del service
railway logs

# Setear una env var desde la CLI
railway variables set FOO=bar

# Triggerear redeploy manual
railway redeploy
```
