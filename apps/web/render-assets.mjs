// Render de assets de marca a PNG con Playwright/Chromium (a tamaño exacto).
//   - OG image (1200x630) desde brand/og-image.html
//   - iconos PWA (192/512 transparente, 512-maskable y apple-touch con fondo naranja)
// Uso: node apps/web/render-assets.mjs   (resuelve @playwright/test desde apps/web)
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url)) // apps/web
const ROOT = join(HERE, '../..')
const PUB = join(HERE, 'public')

const browser = await chromium.launch()

// ── OG image ──────────────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.goto('file://' + join(ROOT, 'brand/og-image.html'), { waitUntil: 'networkidle' })
  try { await page.evaluate(() => document.fonts.ready) } catch {}
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(PUB, 'og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } })
  await page.close()
  console.log('✅ og-image.png (1200x630)')
}

// ── OG image comercios (landing de negocio) ────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.goto('file://' + join(ROOT, 'brand/og-image-comercios.html'), { waitUntil: 'networkidle' })
  try { await page.evaluate(() => document.fonts.ready) } catch {}
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(ROOT, 'apps/landing/public/og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } })
  await page.close()
  console.log('✅ comercios/og-image.png (1200x630)')
}

// ── iconos ──────────────────────────────────────────────────────────────────
const selloTransparent = `<svg viewBox="0 0 64 64" width="100%" height="100%">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fb8a3c"/><stop offset="1" stop-color="#ea580c"/></linearGradient></defs>
  <circle cx="32" cy="32" r="31" fill="url(#g)"/>
  <circle cx="32" cy="32" r="23" fill="none" stroke="#fff" stroke-width="1.8" stroke-dasharray="1.5 4.5" stroke-linecap="round" opacity="0.85"/>
  <text x="32" y="42.5" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-weight="800" font-size="27" fill="#fff" text-anchor="middle">%</text>
</svg>`

const selloFill = `<div style="width:100%;height:100%;background:linear-gradient(135deg,#fb8a3c,#ea580c);display:grid;place-items:center">
  <svg viewBox="0 0 64 64" width="72%" height="72%">
    <circle cx="32" cy="32" r="26" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="1.7 5" stroke-linecap="round" opacity="0.9"/>
    <text x="32" y="44" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-weight="800" font-size="34" fill="#fff" text-anchor="middle">%</text>
  </svg>
</div>`

async function renderIcon(size, fill, out) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px">${fill ? selloFill : selloTransparent}</body></html>`,
  )
  await page.screenshot({ path: out, omitBackground: !fill })
  await page.close()
  console.log(`✅ ${out.split('/').pop()} (${size}px${fill ? ', fill' : ', transparent'})`)
}

await renderIcon(192, false, join(PUB, 'icon-192.png'))
await renderIcon(512, false, join(PUB, 'icon-512.png'))
await renderIcon(512, true, join(PUB, 'icon-512-maskable.png'))
await renderIcon(180, true, join(PUB, 'apple-touch-icon.png'))

await browser.close()
console.log('\n✅ assets renderizados en apps/web/public/')
