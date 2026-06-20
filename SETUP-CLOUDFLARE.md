# Comodín real con Cloudflare — `*.micuidad.com`

Meta: cada ciudad en `mi<ciudad>.micuidad.com` y owner en `administracion.micuidad.com`,
**sin crear un subdominio por ciudad**. Cloudflare aporta lo que Hostinger no tiene:
**DNS comodín + SSL wildcard gratis**. El contenido lo sigue sirviendo Hostinger.

## Cómo funciona
- Cloudflare resuelve `*.micuidad.com` (DNS comodín) y termina el SSL wildcard en el borde.
- Un **Cloudflare Worker** (ruta `*.micuidad.com/*`) reescribe el origen de todo `*.micuidad.com`
  → vhost `ciudades.micuidad.com` (Hostinger, docroot `public_html/ciudades`, donde está la PWA).
  > Nota: los **Origin Rules** (Host/SNI rewrite) son **Enterprise**. El Worker es la vía FREE
  > equivalente (free tier 100k req/día). Código en `infra/cloudflare-worker-micuidad.js`.
- El navegador conserva el host real (`minariño.micuidad.com`) → la PWA resuelve la ciudad
  (match por slug/subdomain, ya implementado). `administracion` y el apex se sirven tal cual.
- **El código de la app no cambia.** Es todo DNS/SSL/Worker.

## Datos
- Nameservers de Cloudflare para micuidad.com: **brynne.ns.cloudflare.com** / **norm.ns.cloudflare.com**
- IP origen Hostinger (web de subdominios): **88.222.222.42**. Apex: 62.72.50.249.
- Deploy de la PWA: `scripts/deploy-micuidad.mjs` (ya sube a `public_html/ciudades`).

## Estado
- ✅ Cloudflare: sitio micuidad.com (FREE), DNS comodín `*`/administracion/ciudades → 88.222.222.42
  (todos Proxied), apex → 62.72.50.249, SSL = **Full**.
- ⏳ Worker `*.micuidad.com` (reemplaza el Origin Rule Enterprise).
- ⏳ Hostinger: crear vhost `ciudades` + cambiar nameservers a brynne/norm.
- ⏳ Crear "Mi Nariño" en prod (tras bootstrap owner) para que tenga datos.

## Pasos restantes
### A. Hostinger (extensión)
1. Crear subdominio `ciudades.micuidad.com` → **document root `public_html/ciudades`** (+ SSL).
2. Cambiar nameservers de micuidad.com a: `brynne.ns.cloudflare.com` y `norm.ns.cloudflare.com`.

### B. Cloudflare (extensión)
3. Workers & Pages → Create Worker → pegar `infra/cloudflare-worker-micuidad.js` → Deploy.
4. Workers Routes (zona micuidad.com) → agregar ruta `*.micuidad.com/*` → ese Worker.

### C. Test (cuando propaguen los nameservers, minutos–horas)
`https://administracion.micuidad.com` → Owner. `https://<ciudad>.micuidad.com` → PWA de esa ciudad,
con candado válido.

## De acá en más (automático)
Creás un pueblo en el panel (nace con `subdomain = mi<slug>`) → **al instante** vive en
`mi<slug>.micuidad.com`. Cero DNS, cero subdominios, cero pasos por ciudad.
