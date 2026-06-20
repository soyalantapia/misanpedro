# Comodín real con Cloudflare — `*.micuidad.com`

Meta: cada ciudad en `mi<ciudad>.micuidad.com` y owner en `administracion.micuidad.com`,
**sin crear un subdominio por ciudad**. Cloudflare aporta lo que Hostinger no tiene:
**DNS comodín + SSL wildcard gratis**. El contenido lo sigue sirviendo Hostinger.

## Cómo funciona
- Cloudflare resuelve `*.micuidad.com` (DNS comodín) y termina el SSL wildcard en el borde.
- Un **Origin Rule** reescribe el `Host`/`SNI` de todo `*.micuidad.com` → `ciudades.micuidad.com`
  (un vhost real en Hostinger cuyo docroot = `public_html/ciudades`, donde ya está la PWA).
- El navegador conserva el host real (`minarino.micuidad.com`) → la PWA resuelve la ciudad
  (match por slug/subdomain, ya implementado). `administracion` se excluye del rule → sirve el Owner.
- **El código no cambia.** Es todo DNS/SSL/Rule.

## Datos
- IP origen Hostinger (web de subdominios): **88.222.222.42** (la que importe Cloudflare para `administracion`).
- IP apex micuidad.com: 62.72.50.249.
- Deploy de la PWA: `scripts/deploy-micuidad.mjs` (ya sube a `public_html/ciudades`).

## Pasos

### 1. Hostinger — crear el vhost `ciudades` (una vez)
Subdominio `ciudades.micuidad.com` con **document root = `public_html/ciudades`**. Le da SSL propio
(lo usa el Origin Rule como destino). → prompt de extensión.

### 2. Cloudflare — alta del sitio (vos, ~3 min)
1. Cuenta free en cloudflare.com → **Add a site** → `micuidad.com` → plan **Free**.
2. Cloudflare escanea e importa los DNS existentes. Continuar.
3. Te muestra **2 nameservers** (`algo.ns.cloudflare.com`). **Copialos y pasámelos.**

### 3. Hostinger — cambiar nameservers a Cloudflare (después del paso 2)
Domains → micuidad.com → Nameservers → custom → poner los 2 de Cloudflare. → prompt de extensión.
(Propaga en minutos–pocas horas. micuidad.com es nuevo, no rompe nada de misanpedro.com.)

### 4. Cloudflare — DNS + SSL + Origin Rule (una vez propagado)
**DNS** (todos con proxy ON = nube naranja):
- `A  micuidad.com → 62.72.50.249`
- `A  administracion → 88.222.222.42`  (la que importó CF)
- `A  ciudades → 88.222.222.42`
- `A  *  → 88.222.222.42`   ← el comodín

**SSL/TLS → Overview → modo `Full`.**

**Rules → Origin Rules → Create rule:**
- Expresión: `ends_with(http.host, ".micuidad.com") and http.host ne "administracion.micuidad.com"`
- Acciones:
  - **Host Header** → Rewrite to `ciudades.micuidad.com`
  - **SNI** → Override to `ciudades.micuidad.com`

### 5. Test
`https://minarino.micuidad.com` (con "Mi Nariño" ya creado en el panel de prod) → muestra Mi Nariño,
con candado válido. `administracion.micuidad.com` → Owner.

## De acá en más (automático)
Creás un pueblo en el panel (nace con `subdomain = mi<slug>`) → **al instante** vive en
`mi<slug>.micuidad.com`. Cero DNS, cero subdominios, cero pasos por ciudad.
