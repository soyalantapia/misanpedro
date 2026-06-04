#!/usr/bin/env node
// Deploys apps/web/dist a la rama gh-pages (root).
// Preserva los subdirectorios /comercios/ (landing) y /vecino/ (landing-vecino).
// Asume que ya corriste `pnpm --filter @misanpedro/web build`.

import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd().endsWith('/apps/web')
  ? join(process.cwd(), '../..')
  : process.cwd()
const DIST = join(ROOT, 'apps/web/dist')
const PRESERVED_DIRS = ['comercios', 'vecino'] // landings viven acá, no las pises

if (!existsSync(DIST)) {
  console.error(`❌ No existe ${DIST}. Corré primero: pnpm --filter @misanpedro/web build`)
  process.exit(1)
}

// Guardrails: que no se deploye un build con la URL placeholder del API,
// ni uno apuntando a localhost (sería un site público roto).
const ALLOW_BROKEN = process.argv.includes('--allow-broken')
const assets = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js'))
const jsContents = assets
  .map((f) => readFileSync(join(DIST, 'assets', f), 'utf8'))
  .join('\n')
if (!ALLOW_BROKEN) {
  if (jsContents.includes('CHANGE-ME-RAILWAY-URL')) {
    console.error(
      '\n❌ El build todavía tiene la URL placeholder del API.\n' +
        '   Editá apps/web/.env.production con la URL pública de Railway y rebuildeá.\n' +
        '   (Para forzar el deploy igual: agregá --allow-broken)\n',
    )
    process.exit(2)
  }
  if (/localhost:\d+/.test(jsContents)) {
    console.error(
      '\n❌ El build apunta a localhost — eso solo funciona en tu máquina.\n' +
        '   Setá VITE_API_URL en apps/web/.env.production y rebuildeá.\n' +
        '   (Para forzar el deploy igual: agregá --allow-broken)\n',
    )
    process.exit(2)
  }
}

const sh = (cmd, opts = {}) => {
  console.log(`$ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', ...opts })
}

const tmp = mkdtempSync(join(tmpdir(), 'msp-gh-'))

try {
  sh(`git -C "${ROOT}" worktree add "${tmp}" gh-pages`)

  // Borrar todo del worktree EXCEPTO .git, .nojekyll, y los PRESERVED_DIRS
  const entries = readdirSync(tmp)
  for (const entry of entries) {
    if (entry === '.git' || entry === '.nojekyll' || PRESERVED_DIRS.includes(entry)) continue
    rmSync(join(tmp, entry), { recursive: true, force: true })
  }

  sh(`cp -R "${DIST}/." "${tmp}"`)
  sh(`touch "${tmp}/.nojekyll"`)
  sh(`git -C "${tmp}" add -A`)
  try {
    sh(`git -C "${tmp}" commit -m "Deploy web: $(date +%Y-%m-%d-%H%M)"`)
    sh(`git -C "${tmp}" push origin gh-pages`)
    console.log('\n✅ Deployed to gh-pages')
    console.log('→ PWA vecino: https://soyalantapia.github.io/misanpedro/')
    console.log('→ Landing:    https://soyalantapia.github.io/misanpedro/comercios/  (preservado)')
  } catch {
    console.log('ℹ️  Nada para commitear (no hay cambios en dist).')
  }
} finally {
  try {
    sh(`git -C "${ROOT}" worktree remove "${tmp}" --force`)
  } catch {
    /* noop */
  }
}
