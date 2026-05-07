#!/usr/bin/env node
// Deploys apps/web/dist a la rama gh-pages.
// Asume que ya corriste `pnpm --filter @misanpedro/web build`.

import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd().endsWith('/apps/web')
  ? join(process.cwd(), '../..')
  : process.cwd()
const DIST = join(ROOT, 'apps/web/dist')

if (!existsSync(DIST)) {
  console.error(`❌ No existe ${DIST}. Corré primero: pnpm --filter @misanpedro/web build`)
  process.exit(1)
}

const sh = (cmd, opts = {}) => {
  console.log(`$ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', ...opts })
}

const tmp = mkdtempSync(join(tmpdir(), 'msp-gh-'))

try {
  sh(`git -C "${ROOT}" worktree add "${tmp}" gh-pages`)
  sh(`find "${tmp}" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +`)
  sh(`cp -R "${DIST}/." "${tmp}"`)
  sh(`touch "${tmp}/.nojekyll"`)
  sh(`git -C "${tmp}" add -A`)
  try {
    sh(`git -C "${tmp}" commit -m "Deploy: $(date +%Y-%m-%d-%H%M)"`)
    sh(`git -C "${tmp}" push origin gh-pages`)
    console.log('✅ Deployed to gh-pages')
  } catch (e) {
    console.log('ℹ️  Nada para commitear (no hay cambios en dist).')
  }
} finally {
  try {
    sh(`git -C "${ROOT}" worktree remove "${tmp}" --force`)
  } catch {
    /* noop */
  }
}
