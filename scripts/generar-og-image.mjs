#!/usr/bin/env node
/**
 * Renderiza la carátula (og:image) de la landing del comercio a PNG 1200×630.
 *
 *   node scripts/generar-og-image.mjs
 *
 * Fuente:  brand/og-image-comercios.html
 * Salida:  apps/landing/public/og-image.png
 *
 * Usa el Chrome del sistema en headless. Nada de dependencias nuevas: el PNG se
 * regenera a mano cuando cambia el titular o la oferta, no en cada build.
 *
 * OJO: la carátula tiene que decir lo mismo que la landing (titular del Hero,
 * oferta real, URL que funciona, cero números inventados). Es lo primero que ve
 * quien recibe el link por WhatsApp.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, copyFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'brand/og-image-comercios.html')
const OUT = path.join(ROOT, 'apps/landing/public/og-image.png')

const CHROMES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const chrome = CHROMES.find((p) => existsSync(p))
if (!chrome) {
  console.error('❌ No encontré Chrome ni Chromium. Instalá alguno o generá el PNG a mano.')
  process.exit(1)
}
if (!existsSync(SRC)) {
  console.error(`❌ No existe ${SRC}`)
  process.exit(1)
}

// Chrome headless escribe la captura en el CWD, así que lo aislamos en un tmp
// y después movemos: sin esto ensucia la raíz del repo.
const tmp = mkdtempSync(path.join(tmpdir(), 'og-'))
const shot = path.join(tmp, 'og.png')

try {
  execFileSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1200,630',
      // Las fuentes vienen de Google Fonts: sin esta espera, el render sale con
      // la fuente de sistema y la tipografía de la carátula no es la de la marca.
      '--virtual-time-budget=8000',
      `--screenshot=${shot}`,
      `file://${SRC}`,
    ],
    { stdio: 'pipe', timeout: 90_000 },
  )
} catch (e) {
  console.error('❌ Chrome falló al renderizar:', e.message)
  rmSync(tmp, { recursive: true, force: true })
  process.exit(1)
}

if (!existsSync(shot)) {
  console.error('❌ Chrome no dejó ningún PNG.')
  rmSync(tmp, { recursive: true, force: true })
  process.exit(1)
}

copyFileSync(shot, OUT)
rmSync(tmp, { recursive: true, force: true })

const kb = Math.round(statSync(OUT).size / 1024)
console.log(`✓ ${path.relative(ROOT, OUT)} — 1200×630, ${kb} KB`)
