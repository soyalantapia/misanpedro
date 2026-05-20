# Onboarding de una nueva ciudad

Cómo sumar una ciudad nueva (ej: Ramallo) al SaaS Cuponcito.

**Tiempo total estimado**: 20-30 min (mayoría es esperar propagación DNS).

---

## Pre-requisitos

- [ ] Acceso al **Owner Panel** (`admin.cuponcito.app` o local `:5182`)
- [ ] Acceso al **registrador del dominio** `cuponcito.app` (Cloudflare/Namecheap/etc.)
- [ ] Acceso al **deploy host** (Railway, Vercel, etc.) para configurar custom domains

---

## Paso 1 — Crear la app desde el Owner Panel

1. Login en `admin.cuponcito.app` (o `http://localhost:5182` en dev)
2. Click **"Apps" → "Nueva app"**
3. Wizard de 3 pasos:
   - **Ubicación**: nombre comercial ("Mi Ramallo"), ciudad ("Ramallo"), provincia
   - **Dominio**: slug (`ramallo`), subdomain (`ramallo`)
   - **Branding**: colores primary + accent

4. Submit → POST /api/v1/owner/apps crea el tenant en DB.

**Resultado**: la app queda en estado `active` con `subdomain="ramallo"`. Si tenés Resend configurado, recibís email de notificación.

---

## Paso 2 — DNS wildcard (una sola vez por dominio)

Esto se hace **una sola vez** para todo el dominio `cuponcito.app`. Después, cada subdomain nuevo funciona automáticamente sin tocar DNS.

### Si usás Cloudflare

```
Type:    CNAME
Name:    *
Content: <tu-deploy-target.up.railway.app>
Proxy:   Activado (naranja)
TTL:     Auto
```

### Si usás un registrador tradicional (Namecheap, GoDaddy)

```
Type:   CNAME
Host:   *
Value:  <tu-deploy-target.up.railway.app>
TTL:    300 (5 min)
```

**Validación**: una vez propagado (5-15 min), probá:

```bash
dig ramallo.cuponcito.app +short
# debería devolver el target de Railway o un IP
```

---

## Paso 3 — Custom domains en Railway

Railway necesita saber qué dominios sirvir.

### Opción A — Wildcard explícito

Algunos planes de Railway aceptan `*.cuponcito.app` como un único custom domain. Si el tuyo lo soporta:

1. Railway → tu service del frontend (`apps/web`) → Settings → Networking
2. Custom Domains → Add `*.cuponcito.app`
3. Verificá el certificate SSL (Let's Encrypt auto-gen)

### Opción B — Por ciudad (si wildcard no funciona)

Cada vez que sumás una ciudad nueva, agregás el custom domain a Railway:

1. Railway → apps/web service → Settings → Networking → Custom Domains
2. Add `ramallo.cuponcito.app`
3. Railway te muestra el target CNAME — debería ya estar configurado por el wildcard

---

## Paso 4 — Verificar que el PWA responde con branding del tenant

```bash
curl https://ramallo.cuponcito.app/
```

Debería devolver el `index.html` del PWA. Abrir en el browser:

- Hero card del PWA debería mostrar el branding de Ramallo (color, nombre)
- `document.title` → "Mi Ramallo · Descuentos del barrio"
- En DevTools → Network → requests al API deberían tener `X-Tenant-Slug: ramallo`

---

## Paso 5 — Verificar API end-to-end

```bash
# Listado público de comercios del tenant ramallo
curl https://api.cuponcito.app/api/v1/merchants \
  -H "X-Tenant-Slug: ramallo"
# → { ok: true, merchants: [] } (vacío, no hay comercios todavía)

# Config del tenant
curl https://api.cuponcito.app/api/v1/tenant/ramallo/config
# → { ok: true, tenant: { slug, nombre, brand, ... } }
```

---

## Paso 6 — Activación opcional: signup self-service para comercios

Si querés que los comercios de Ramallo se registren solos:

1. Comparte `https://ramallo.cuponcito.app/#/admin/registro` con tus partners
2. El form de signup va a etiquetar al comercio con `appId=ramallo` automáticamente (resolvido por subdomain)
3. El comercio paga vía MercadoPago como cualquier otro

---

## Troubleshooting

### "tenant not found" al abrir el subdomain

→ Verificá que la App esté en estado `active` (no `pending` o `archived`)
→ Slug del DB debe coincidir con el subdomain
→ Cache del browser: hard refresh (Cmd+Shift+R)

### Subdomain responde pero sin branding

→ El PWA hace fetch del config en `loadTenantConfig()`. Si falla, el branding cae al default.
→ Abrí DevTools → Network → buscá `/api/v1/tenant/ramallo/config` → debe ser 200

### El certificado SSL falla (lock rojo)

→ Railway puede tardar 5-10 min en provisionar el cert de Let's Encrypt
→ Si después de 15 min sigue mal, sacá y volvé a agregar el custom domain
→ Verifica que el DNS propagó correctamente con `dig`

### Quiero pausar una ciudad temporalmente

→ Owner Panel → Apps → click la app → PATCH `/api/v1/owner/apps/:id` con `status: 'suspended'`
→ El subdomain responde 403 con mensaje "tenant suspended"

### Quiero borrar una ciudad

→ NO recomendado. Usar `status: 'archived'` para soft-delete.
→ Si realmente borrás, hay que limpiar también todos los Merchants, Users, Coupons, etc. con `appId` apuntando a esa App.

---

## Checklist final por ciudad

- [ ] App creada en Owner Panel con status=active
- [ ] DNS subdomain propagado (`dig ramallo.cuponcito.app +short` devuelve algo)
- [ ] Railway tiene el custom domain (o wildcard) configurado
- [ ] HTTPS funciona (lock verde)
- [ ] `https://ramallo.cuponcito.app/` muestra el PWA con branding del tenant
- [ ] `/api/v1/tenant/ramallo/config` responde 200
- [ ] Signup de comercio en `/#/admin/registro` funciona
- [ ] (Opcional) 1-2 comercios pioneros agregados manualmente
- [ ] (Opcional) Owner panel → App detail → cachedStats refrescado

¡Ramallo está live! 🎉
