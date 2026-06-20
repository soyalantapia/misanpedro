# Plataforma micuidad.com — subdominios por ciudad

Objetivo: cada ciudad vive en `mi<ciudad>.micuidad.com` y el owner en
`administracion.micuidad.com`.

## Decisión de arquitectura (por qué NO comodín)
Hostinger **no soporta comodín de subdominios** (`*.micuidad.com` → "Multi-level
subdomains are not supported") ni SSL wildcard. Sí crea **subdominios específicos**
con SSL gratis automático. Por eso:

- La **PWA se deploya UNA vez** a una carpeta compartida `public_html/ciudades`.
- Cada ciudad es un **subdominio** cuyo *document root* apunta a esa misma carpeta.
- La PWA lee el subdominio del host y resuelve el tenant (match por slug **o**
  `subdomain`, IDN/ñ vía punycode). Una sola build sirve a todas las ciudades.
- Sumar un pueblo = **crear 1 subdominio** que apunte a `public_html/ciudades` (30 seg).

## Estado actual
- ✅ `administracion.micuidad.com` → **Owner LIVE** (creado, SSL activo, deployado).
- ✅ PWA deployada en `public_html/ciudades` (con el código que reconoce micuidad.com).
- ✅ API (Railway) resuelve `*.micuidad.com` y su CORS los permite.

## Deploy (repetible)
```
SSH_KEY=~/.ssh/misanpedro_hostinger pnpm exec node scripts/deploy-micuidad.mjs
```
Buildea Owner (→administracion) y PWA (→ciudades) en base=/ y las sube. `--dry-run` para probar.

## Sumar una ciudad (ej. Nariño → minariño.micuidad.com)
1. **Crear la ciudad en prod**: entrá al Owner (https://administracion.micuidad.com,
   tras el bootstrap — ver `SETUP-OWNER.md`) y creá "Mi Nariño" (Colombia → COP/es-CO).
   Anotá su `subdomain` (default `minarino`). Si querés la ñ, seteá el subdomain a
   `minariño` (se guarda como punycode `xn--minario-9za`).
2. **Crear el subdominio en Hostinger** apuntando a la carpeta compartida. En hPanel →
   micuidad.com → Subdominios → Crear:
   - Subdominio: `minarino` (o `xn--minario-9za` para la ñ — Hostinger no acepta ñ literal).
   - **Document root / carpeta personalizada**: `public_html/ciudades` (NO la default).
   - SSL: se activa solo.
   El label del subdominio debe COINCIDIR con el `App.subdomain` de la ciudad.
3. Listo: `minarino.micuidad.com` (o `minariño…`) sirve la PWA y muestra Mi Nariño.

## Convención
Cada ciudad nueva nace en el panel con `subdomain = mi<slug>`. Creás el subdominio
homónimo en Hostinger apuntando a `public_html/ciudades` y queda online.
