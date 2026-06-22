#!/usr/bin/env node
/**
 * GUARDRAIL multi-tenant — evita que una identidad de ciudad quede hardcodeada en
 * las apps que sirven a TODAS las ciudades:
 *   - apps/web   (PWA vecino + panel comercio, en <ciudad>.micuidad.com)
 *   - apps/owner (panel super-admin, en administracion.micuidad.com)
 *
 * En esas apps el nombre/identidad de la ciudad SIEMPRE sale de la config del tenant
 * (useTenant() / appName()). Hardcodear una ciudad hace que otra muestre la equivocada
 * (ej. minarino.micuidad.com mostrando "Mi San Pedro"). Este check falla el build/deploy
 * (corre en el build de Railway / nixpacks), los tests (vitest) y `pnpm check:tenant`,
 * para que el bug no se pueda reintroducir en silencio.
 *
 * NO cubre apps/landing* (marketing single-tenant de San Pedro) ni el seed/demo del API.
 * Si una landing pasa a ser multi-ciudad, sumá su carpeta a SCAN_DIRS.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SCAN_DIRS = ['apps/web/src', 'apps/owner/src']
const SCAN_FILES = ['apps/web/index.html', 'apps/owner/index.html']
const EXTS = new Set(['.ts', '.tsx', '.html'])

/**
 * Identidades de ciudad que NO deben aparecer hardcodeadas en apps multi-tenant.
 * Es deliberadamente angosto (la marca recurrente) para no chocar con "San Pedro"
 * legítimo en datos/ejemplos. Sumá patrones acá si aparecen otras ciudades fijas.
 */
const BANNED = [
  {
    // \s+ EXIGE espacios reales: matchea el nombre visible "Mi San Pedro" (branding)
    // pero NO el identificador "misanpedro" (storage keys, hosts, @misanpedro/shared),
    // que son funcionales y legítimos.
    re: /Mi\s+San\s+Pedro/i,
    hint: 'nombre de ciudad hardcodeado. Usá useTenant()/appName(); el fallback genérico es "Mi Ciudad".',
  },
]

function walk(dir, acc) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'dist') walk(p, acc)
    } else if (EXTS.has(path.extname(e.name))) {
      acc.push(p)
    }
  }
}

export function collectOffenders() {
  const files = []
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files)
  for (const f of SCAN_FILES) files.push(path.join(ROOT, f))

  const offenders = []
  for (const f of files) {
    let content
    try {
      content = readFileSync(f, 'utf8')
    } catch {
      continue
    }
    content.split('\n').forEach((line, i) => {
      for (const b of BANNED) {
        if (b.re.test(line)) {
          offenders.push({
            file: path.relative(ROOT, f),
            line: i + 1,
            text: line.trim().slice(0, 120),
            hint: b.hint,
          })
        }
      }
    })
  }
  return offenders
}

// Modo CLI: usado por `pnpm check:tenant` y por el build de Railway (nixpacks).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const offenders = collectOffenders()
  if (offenders.length > 0) {
    console.error(
      `\n❌ check:tenant — ${offenders.length} identidad(es) de ciudad hardcodeada(s) en apps multi-tenant:\n`,
    )
    for (const o of offenders) {
      console.error(`  ${o.file}:${o.line}\n    ${o.text}\n    → ${o.hint}\n`)
    }
    console.error(
      'Las apps web (PWA) y owner sirven TODAS las ciudades; el nombre viene del tenant. No hardcodees una ciudad.\n',
    )
    process.exit(1)
  }
  console.log('✓ check:tenant — apps multi-tenant sin identidad de ciudad hardcodeada')
}
