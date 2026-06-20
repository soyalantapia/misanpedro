# Plataforma micuidad.com — subdominios por ciudad (comodín)

Objetivo: cada ciudad vive en `mi<ciudad>.micuidad.com` y el owner en
`administracion.micuidad.com`. Con **un comodín `*.micuidad.com`** configurado UNA vez,
cada pueblo nuevo que creás en el panel queda online solo — sin tocar DNS por pueblo.

## Cómo funciona (ya está en el código)
- El API resuelve el tenant por el **primer label del host** cuando termina en `.micuidad.com`
  (`apps/api/src/middleware/tenant.ts`). Matchea por `slug` **o** `subdomain` del App.
- `administracion` está **reservado** (no es una ciudad → sirve el panel Owner).
- IDN (ñ): `minariño` se guarda/matchea como **punycode** `xn--minario-9za` (transparente —
  el navegador muestra `minariño`). Nariño ya quedó con `subdomain = xn--minario-9za` en dev.
- CORS del API permite cualquier `*.micuidad.com` por sufijo (no hay que enumerar).
- Convención automática: al crear una ciudad sin subdomain explícito, se deriva `mi<slug>`.

## 1. Pasos en Hostinger (UNA vez — los hacés vos, es tu cuenta)
En hPanel → micuidad.com → **Subdominios**:

1. **`administracion`** → creá el subdominio `administracion.micuidad.com`.
   Anotá su carpeta (document root), ej. `…/domains/micuidad.com/public_html/administracion`.
2. **Comodín `*`** → creá el subdominio `*` (`*.micuidad.com`).
   Anotá su carpeta, ej. `…/domains/micuidad.com/public_html/wildcard`.
3. **SSL** → activá SSL en ambos (Hostinger emite Let's Encrypt; el comodín necesita el
   certificado wildcard — si hPanel no lo ofrece solo, avisame y vemos Cloudflare delante).

> Pasame las dos carpetas (document roots) que te asignó Hostinger y con eso cierro el deploy.

## 2. Deploy de los fronts a micuidad.com (lo corro yo con tus carpetas)
- **Owner** → `administracion.micuidad.com` (base `/`):
  `VITE_BASE=/ VITE_API_URL=https://api-production-43c52.up.railway.app pnpm --filter @misanpedro/owner build`
  → rsync de `apps/owner/dist/` a la carpeta de `administracion`.
- **PWA** → `*.micuidad.com` (base `/`):
  `VITE_BASE=/ VITE_API_URL=https://api-production-43c52.up.railway.app pnpm --filter @misanpedro/web build`
  → rsync de `apps/web/dist/` a la carpeta del comodín. La PWA lee el subdominio y resuelve la ciudad.

## 3. Que Nariño quede en `minariño.micuidad.com` (prod)
Nariño hoy existe en **dev**, no en prod. Para tenerlo en prod:
1. Entrá al panel Owner (una vez bootstrappeado — ver `SETUP-OWNER.md`) y creá **"Mi Nariño"**
   (Colombia → COP/es-CO). Nace con subdomain `minarino` (ASCII).
2. Si querés la ñ exacta, seteá su subdomain a `minariño` (queda `xn--minario-9za`).
   Por consola, dentro de Railway o contra la DB que corresponda:
   `SLUG=narino NOMBRE="Mi Nariño" CIUDAD="Pasto" PAIS="Colombia" MONEDA="COP" LOCALE="es-CO" SUBDOMAIN=minariño UPDATE=true node --import tsx --env-file=.env scripts/crear-ciudad.ts`

## 4. De acá en más (automático)
Creás un pueblo en el panel → nace con `mi<slug>.micuidad.com` → el comodín lo sirve al
instante y el API resuelve el tenant. **Cero pasos de DNS por pueblo.**
