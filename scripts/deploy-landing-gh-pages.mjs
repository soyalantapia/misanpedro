#!/usr/bin/env node
/**
 * Deploya `apps/landing/dist` a la rama `gh-pages` bajo el subpath
 * `/comercios/`, sin pisar la PWA del vecino que vive en el ROOT de gh-pages.
 *
 * Resultado: https://soyalantapia.github.io/misanpedro/comercios/
 *
 * Asume que ya corriste `pnpm --filter @misanpedro/landing build` (con el
 * vite.config base = '/misanpedro/comercios/' por default).
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd().endsWith('/apps/landing')
  ? join(process.cwd(), '../..')
  : process.cwd()
const DIST = join(ROOT, 'apps/landing/dist')
const TARGET_SUBDIR = 'comercios'

if (!existsSync(DIST)) {
  console.error(
    `❌ No existe ${DIST}.\nCorré primero: pnpm --filter @misanpedro/landing build`,
  )
  process.exit(1)
}

const sh = (cmd, opts = {}) => {
  console.log(`$ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', ...opts })
}

const tmp = mkdtempSync(join(tmpdir(), 'msp-landing-gh-'))

try {
  // 1. Worktree de gh-pages (rama remota) en /tmp
  sh(`git -C "${ROOT}" worktree add "${tmp}" gh-pages`)

  // 2. Borrar SÓLO el subdirectorio /comercios/ — el resto (PWA) queda intacto
  const targetDir = join(tmp, TARGET_SUBDIR)
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true })
    console.log(`🧹 Limpiado ${TARGET_SUBDIR}/ previo`)
  }

  // 3. Copiar landing dist al subdirectorio
  sh(`mkdir -p "${targetDir}"`)
  sh(`cp -R "${DIST}/." "${targetDir}"`)

  // 4. .nojekyll en root (puede ya existir, idempotente)
  sh(`touch "${tmp}/.nojekyll"`)

  // 5. Commit + push (sólo si hay cambios)
  sh(`git -C "${tmp}" add -A`)
  try {
    sh(`git -C "${tmp}" commit -m "Deploy landing: $(date +%Y-%m-%d-%H%M)"`)
    sh(`git -C "${tmp}" push origin gh-pages`)
    console.log(
      '\n✅ Deploy listo.\n→ https://soyalantapia.github.io/misanpedro/comercios/',
    )
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
