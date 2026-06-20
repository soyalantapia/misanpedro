#!/usr/bin/env node
/**
 * Deploy de la PLATAFORMA micuidad.com a Hostinger (estáticos).
 *   - Owner → administracion.micuidad.com           (base=/)  docroot: public_html/administracion
 *   - PWA   → carpeta compartida 'ciudades' (base=/) docroot: public_html/ciudades
 *
 * Hostinger NO soporta comodín de subdominios (*.micuidad.com) ni SSL wildcard.
 * Por eso cada ciudad es un SUBDOMINIO específico (con su SSL gratis automático)
 * cuyo *document root* apunta a .../public_html/ciudades. Así una sola build de la
 * PWA sirve a TODAS las ciudades; sumar un pueblo = crear 1 subdominio que apunta
 * a esa carpeta (la PWA lee el subdominio y resuelve el tenant).
 *
 * Uso:
 *   SSH_KEY=~/.ssh/misanpedro_hostinger node scripts/deploy-micuidad.mjs
 *   node scripts/deploy-micuidad.mjs --dry-run
 */
import { execSync } from 'node:child_process'
import { writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SSH_HOST = process.env.SSH_HOST ?? '62.72.50.249'
const SSH_USER = process.env.SSH_USER ?? 'u598759732'
const SSH_PORT = process.env.SSH_PORT ?? '65002'
const REMOTE_ROOT =
  process.env.MICUIDAD_ROOT ?? `/home/${SSH_USER}/domains/micuidad.com/public_html`
const API_URL = process.env.API_URL ?? 'https://api-production-43c52.up.railway.app'
const SSH_KEY = process.env.SSH_KEY ?? ''
const DRY = process.argv.includes('--dry-run')

// SPA fallback en la RAÍZ del subdominio (los dos fronts se sirven en base=/).
const SPA_HTACCESS = `# SPA fallback (servido en la raíz del subdominio).
RewriteEngine On
RewriteBase /
RewriteRule ^index\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . index.html [L]
`

const sh = (cmd) => {
  console.log(`\n$ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT })
}
const sshCmd = `ssh -p ${SSH_PORT}${SSH_KEY ? ` -i ${SSH_KEY} -o IdentitiesOnly=yes` : ''}`
const rsyncFlags = `-avz --human-readable --delete${DRY ? ' --dry-run' : ''} -e "${sshCmd}"`

function guardrail(distDir, label) {
  const assets = join(distDir, 'assets')
  if (!existsSync(assets)) return
  const js = readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(assets, f), 'utf8'))
    .join('\n')
  if (/localhost:\d+/.test(js)) {
    console.error(`\n❌ ${label}: el bundle apunta a localhost. Revisá VITE_API_URL.\n`)
    process.exit(2)
  }
  if (!js.includes('api-production-43c52')) {
    console.warn(`\n⚠️  ${label}: no encontré la URL de Railway en el bundle.\n`)
  }
}

const targets = [
  {
    name: 'Owner → administracion.micuidad.com',
    filter: '@misanpedro/owner',
    dist: 'apps/owner/dist',
    remote: `${REMOTE_ROOT}/administracion/`,
  },
  {
    name: 'PWA → ciudades (cada <ciudad>.micuidad.com)',
    filter: '@misanpedro/web',
    dist: 'apps/web/dist',
    remote: `${REMOTE_ROOT}/ciudades/`,
  },
]

console.log('═══ BUILD (base=/) ═══')
for (const t of targets) {
  console.log(`\n▸ ${t.name}`)
  sh(`VITE_BASE=/ VITE_API_URL=${API_URL} pnpm --filter ${t.filter} build`)
  // Override del .htaccess: ambos fronts van en la raíz del subdominio (no /owner/).
  writeFileSync(join(ROOT, t.dist, '.htaccess'), SPA_HTACCESS)
  guardrail(join(ROOT, t.dist), t.name)
}

console.log(`\n═══ RSYNC → ${SSH_USER}@${SSH_HOST}:${SSH_PORT} ${DRY ? '(DRY-RUN)' : ''} ═══`)
for (const t of targets) {
  console.log(`\n▸ ${t.name}`)
  const mk = `--rsync-path="mkdir -p ${t.remote.replace(/\/$/, '')} && rsync"`
  sh(`rsync ${rsyncFlags} ${mk} "${join(ROOT, t.dist)}/" ${SSH_USER}@${SSH_HOST}:${t.remote}`)
}

console.log('\n✅ Deploy micuidad.com completo.')
console.log('→ Owner:    https://administracion.micuidad.com')
console.log('→ Ciudades: cada <ciudad>.micuidad.com (apuntá su document root a public_html/ciudades)')
