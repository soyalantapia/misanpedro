/**
 * Worker de plataforma micuidad.com — comodín de subdominios (alternativa FREE al
 * Origin Rule, que es Enterprise). Ruta: `*.micuidad.com/*` (zona micuidad.com).
 *
 * Sirve la PWA (que vive en el vhost `ciudades.micuidad.com` de Hostinger, docroot
 * public_html/ciudades) para CUALQUIER <ciudad>.micuidad.com, reescribiendo el host
 * de la subpetición al origen → así Hostinger la enruta al vhost `ciudades`. El
 * navegador conserva el host real (minariño.micuidad.com), por lo que la PWA resuelve
 * el tenant por el subdominio (lógica ya implementada en apps/web/src/lib/tenant.ts).
 *
 * `administracion` y el apex se sirven tal cual (su propio vhost). Cloudflare termina
 * el SSL wildcard (*.micuidad.com) en el borde — gratis con Universal SSL.
 *
 * Deploy: Cloudflare → Workers & Pages → Create Worker → pegar este código → Deploy.
 * Luego Routes → agregar `*.micuidad.com/*` → este worker (zona micuidad.com).
 */
const PASSTHROUGH = new Set([
  'micuidad.com',
  'www.micuidad.com',
  'administracion.micuidad.com',
  'ciudades.micuidad.com',
])

export default {
  async fetch(request) {
    const url = new URL(request.url)
    // El Owner, el apex y el propio vhost `ciudades` se sirven sin reescribir.
    if (PASSTHROUGH.has(url.hostname)) {
      return fetch(request)
    }
    // Cualquier <ciudad>.micuidad.com → servir desde el vhost `ciudades` (Host pasa a
    // ciudades.micuidad.com). El front sigue leyendo el host real del navegador.
    url.hostname = 'ciudades.micuidad.com'
    return fetch(new Request(url, request))
  },
}
