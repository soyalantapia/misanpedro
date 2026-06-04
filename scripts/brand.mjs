#!/usr/bin/env node
/**
 * Cambia el color de marca (--color-brand) en las 4 apps de una sola vez.
 * Cada app deriva TODO (escala accent, sombras, texturas, pines) de ese knob,
 * así que esto re-tematiza el sistema entero. Con los dev servers corriendo,
 * Vite aplica el cambio por HMR al instante.
 *
 *   node scripts/brand.mjs '#2563eb'     → pinta todo de azul royal
 *   node scripts/brand.mjs '#695ede'     → vuelve al violeta de marca
 *
 * Nota: si probás un color CLARO (ej. amarillo/cielo), el texto blanco sobre
 * la marca puede quedar ilegible — ahí conviene cambiar --color-on-brand a un
 * ink oscuro en apps/web/src/index.css.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILES = [
  'apps/web/src/index.css',
  'apps/landing/src/index.css',
  'apps/owner/src/index.css',
  'apps/landing-vecino/src/index.css',
]

const hex = (process.argv[2] || '').trim().toLowerCase()
if (!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(hex)) {
  console.error(`Uso: node scripts/brand.mjs '#rrggbb'   (recibí: "${process.argv[2] ?? '(vacío)'}")`)
  process.exit(1)
}

// Reemplaza SOLO el hex después de "--color-brand:", preservando comentarios.
const RE = /(--color-brand:\s*)#[0-9a-fA-F]{3,8}/

let changed = 0
for (const rel of FILES) {
  const path = resolve(root, rel)
  let css
  try {
    css = readFileSync(path, 'utf8')
  } catch {
    console.warn(`⚠ ${rel}: no existe (omito)`)
    continue
  }
  if (!RE.test(css)) {
    console.warn(`⚠ ${rel}: no encontré "--color-brand" (omito)`)
    continue
  }
  writeFileSync(path, css.replace(RE, `$1${hex}`))
  console.log(`✓ ${rel} → ${hex}`)
  changed++
}

console.log(`\nListo: ${changed}/${FILES.length} apps en ${hex}. HMR re-tematiza solo (recargá si hiciera falta).`)
