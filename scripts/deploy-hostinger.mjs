#!/usr/bin/env node
/**
 * Deploy de los 3 frontends ESTÁTICOS de Mi San Pedro a Hostinger (misanpedro.com)
 * por SSH/rsync. El API (Node) NO va acá — el hosting compartido no corre Node;
 * el backend sigue en Railway. Acá solo viajan archivos estáticos buildeados.
 *
 * ── Arquitectura de URLs ────────────────────────────────────────────────────
 *   misanpedro.com/            → landing del VECINO   (apps/landing-vecino)  docroot: public_html/
 *   misanpedro.com/comercios/  → landing del COMERCIO (apps/landing)         docroot: public_html/comercios/
 *   app.misanpedro.com/        → la PWA (apps/web: vecino + panel en /#/admin) docroot: public_html/app/
 *   api → https://api-production-43c52.up.railway.app  (Railway, NO se toca acá)
 *
 * ── Auth SSH ────────────────────────────────────────────────────────────────
 *   Recomendado: configurá una llave una sola vez para no tipear la clave en cada deploy:
 *       ssh-copy-id -p 65002 u598759732@62.72.50.249      (te pide la clave UNA vez)
 *   Si no, rsync te va a pedir la contraseña SSH en cada target.
 *   Este script NUNCA contiene ni te pide la contraseña por archivo.
 *
 * ── Uso ─────────────────────────────────────────────────────────────────────
 *   pnpm deploy:hostinger                # build de los 3 + rsync
 *   pnpm deploy:hostinger --build-only   # solo build (sin SSH) — para verificar
 *   pnpm deploy:hostinger --dry-run      # build + rsync en --dry-run (no escribe nada en el server)
 *
 * ── Config por env (con defaults) ───────────────────────────────────────────
 *   SSH_HOST=62.72.50.249  SSH_USER=u598759732  SSH_PORT=65002
 *   REMOTE_ROOT=/home/u598759732/domains/misanpedro.com/public_html
 *   API_URL=https://api-production-43c52.up.railway.app
 *   APP_URL=https://app.misanpedro.com
 */

import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SSH_HOST = process.env.SSH_HOST ?? '62.72.50.249'
const SSH_USER = process.env.SSH_USER ?? 'u598759732'
const SSH_PORT = process.env.SSH_PORT ?? '65002'
const REMOTE_ROOT =
  process.env.REMOTE_ROOT ?? `/home/${SSH_USER}/domains/misanpedro.com/public_html`
const API_URL = process.env.API_URL ?? 'https://api-production-43c52.up.railway.app'
const APP_URL = process.env.APP_URL ?? 'https://app.misanpedro.com'

const BUILD_ONLY = process.argv.includes('--build-only')
const DRY_RUN = process.argv.includes('--dry-run')

const sh = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts })
}

// ── 1) BUILD de los 3 frontends con su base/env correctos ───────────────────
const builds = [
  {
    name: 'PWA (apps/web → app.misanpedro.com)',
    filter: '@misanpedro/web',
    dist: 'apps/web/dist',
    env: { VITE_BASE: '/', VITE_API_URL: API_URL },
  },
  {
    name: 'Landing vecino (apps/landing-vecino → misanpedro.com/)',
    filter: '@misanpedro/landing-vecino',
    dist: 'apps/landing-vecino/dist',
    env: { VITE_BASE: '/', VITE_APP_URL: APP_URL, VITE_API_URL: API_URL },
  },
  {
    name: 'Landing comercios (apps/landing → misanpedro.com/comercios/)',
    filter: '@misanpedro/landing',
    dist: 'apps/landing/dist',
    env: { VITE_BASE: '/comercios/', VITE_APP_URL: APP_URL, VITE_API_URL: API_URL },
  },
  {
    name: 'Panel Owner (apps/owner → misanpedro.com/owner/)',
    filter: '@misanpedro/owner',
    dist: 'apps/owner/dist',
    env: { VITE_BASE: '/owner/', VITE_API_URL: API_URL },
  },
]

console.log('═══ BUILD ═══')
for (const b of builds) {
  const envStr = Object.entries(b.env)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  console.log(`\n▸ ${b.name}`)
  sh(`${envStr} pnpm --filter ${b.filter} build`)
}

// ── 2) Guardrails: la PWA no debe apuntar a localhost ni a la URL placeholder ─
const webAssetsDir = join(ROOT, 'apps/web/dist/assets')
if (existsSync(webAssetsDir)) {
  const js = readdirSync(webAssetsDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(webAssetsDir, f), 'utf8'))
    .join('\n')
  if (/localhost:\d+/.test(js)) {
    console.error(
      '\n❌ El build de la PWA apunta a localhost. Revisá VITE_API_URL / .env.production.\n',
    )
    process.exit(2)
  }
  if (!js.includes('api-production-43c52')) {
    console.warn(
      '\n⚠️  No encontré la URL de Railway en el bundle de la PWA. Verificá VITE_API_URL antes de seguir.\n',
    )
  }
}

// Mismo guardrail para el panel Owner: su api.ts tiene fallback a localhost, así que
// un build sin VITE_API_URL subiría apuntando a localhost sin que nadie lo note.
const ownerAssetsDir = join(ROOT, 'apps/owner/dist/assets')
if (existsSync(ownerAssetsDir)) {
  const js = readdirSync(ownerAssetsDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(ownerAssetsDir, f), 'utf8'))
    .join('\n')
  if (/localhost:\d+/.test(js)) {
    console.error('\n❌ El build del panel Owner apunta a localhost. Revisá VITE_API_URL.\n')
    process.exit(2)
  }
  if (!js.includes('api-production-43c52')) {
    console.warn(
      '\n⚠️  No encontré la URL de Railway en el bundle del Owner. Verificá VITE_API_URL antes de seguir.\n',
    )
  }
}

if (BUILD_ONLY) {
  console.log('\n✅ Build OK (--build-only). No se subió nada por SSH.')
  process.exit(0)
}

// ── 3) RSYNC a Hostinger ─────────────────────────────────────────────────────
//  - landing-vecino → public_html/  (con --delete pero PRESERVANDO app/ y comercios/)
//  - web            → public_html/app/       (aislado, --delete)
//  - landing        → public_html/comercios/ (aislado, --delete)
// SSH_KEY (opcional): si se setea, usamos esa llave privada (deploy sin contraseña).
const SSH_KEY = process.env.SSH_KEY ?? ''
const sshCmd = `ssh -p ${SSH_PORT}${SSH_KEY ? ` -i ${SSH_KEY} -o IdentitiesOnly=yes` : ''}`
const rsyncFlags = `-avz --human-readable${DRY_RUN ? ' --dry-run' : ''} -e "${sshCmd}"`

const targets = [
  {
    name: 'Landing vecino → /',
    dist: 'apps/landing-vecino/dist',
    remote: `${REMOTE_ROOT}/`,
    // no borres los subdirectorios de los otros dos frontends ni el challenge de SSL.
    // excludes ANCLADOS (/) = solo al root del transfer (public_html), no a cualquier nivel.
    extra: '--delete --exclude=/app/ --exclude=/comercios/ --exclude=/owner/ --exclude=/.well-known/',
  },
  {
    name: 'PWA → /app/',
    dist: 'apps/web/dist',
    remote: `${REMOTE_ROOT}/app/`,
    extra: `--delete --rsync-path="mkdir -p ${REMOTE_ROOT}/app && rsync"`,
  },
  {
    name: 'Landing comercios → /comercios/',
    dist: 'apps/landing/dist',
    remote: `${REMOTE_ROOT}/comercios/`,
    extra: `--delete --rsync-path="mkdir -p ${REMOTE_ROOT}/comercios && rsync"`,
  },
  {
    name: 'Panel Owner → /owner/',
    dist: 'apps/owner/dist',
    remote: `${REMOTE_ROOT}/owner/`,
    extra: `--delete --rsync-path="mkdir -p ${REMOTE_ROOT}/owner && rsync"`,
  },
]

console.log(`\n═══ RSYNC → ${SSH_USER}@${SSH_HOST}:${SSH_PORT} ${DRY_RUN ? '(DRY-RUN)' : ''} ═══`)
for (const t of targets) {
  console.log(`\n▸ ${t.name}`)
  sh(`rsync ${rsyncFlags} ${t.extra} "${join(ROOT, t.dist)}/" ${SSH_USER}@${SSH_HOST}:${t.remote}`)
}

console.log('\n✅ Deploy a Hostinger completo.')
console.log('→ Vecino (landing):   https://misanpedro.com/')
console.log('→ Comercios (landing): https://misanpedro.com/comercios/')
console.log('→ App (PWA):          https://app.misanpedro.com/')
console.log('\nRecordá: el API vive en Railway y necesita CORS para estos orígenes.')
