/**
 * Demo E2E del flow del Owner:
 *   1. POST /owner/auth/login → setup2FA (devuelve TOTP secret)
 *   2. Generar TOTP code con el secret
 *   3. POST /owner/auth/2fa/verify → activa 2FA
 *   4. POST /owner/auth/login (con TOTP) → access + refresh tokens
 *   5. POST /owner/apps → crear "Mi Ramallo"
 *   6. GET /owner/apps → listar
 *   7. GET /owner/metrics → KPIs
 */

import { generateSync as totpGenerate } from 'otplib'

function generateTotpCode(secret: string): string {
  // otplib generateSync devuelve string (el código de 6 dígitos)
  const code = totpGenerate({
    strategy: 'totp',
    secret,
    algorithm: 'sha1',
    digits: 6,
    period: 30,
  }) as unknown as string
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new Error('TOTP generation failed: got ' + JSON.stringify(code))
  }
  return code
}

const API = 'http://localhost:3002'
const EMAIL = 'alan@misanpedro.app'
const PASSWORD = 'alan-misanpedro-2026!'

async function main() {
  console.log('\n=== Demo E2E del Owner flow ===\n')

  // 1. Login inicial — devuelve setup2FA
  console.log('1️⃣  Login inicial...')
  let r = await fetch(`${API}/api/v1/owner/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  let body = await r.json() as any
  console.log('   →', r.status, body.setup2FA ? 'setup2FA mode' : body.needTotp ? 'needs TOTP' : 'logged in')

  let totpSecret: string
  if (body.setup2FA) {
    totpSecret = body.secret
    console.log('   → secret recibido:', totpSecret.substring(0, 8) + '…')

    // 2. Generar TOTP code
    const code = generateTotpCode(totpSecret)
    console.log('2️⃣  Código generado:', code)

    // 3. Verify 2FA
    r = await fetch(`${API}/api/v1/owner/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, totp: code }),
    })
    body = await r.json()
    console.log('3️⃣  2FA verify:', r.status, body.ok ? '✅ activado' : '❌ ' + body.error)

    // 4. Login con TOTP
    const code2 = generateTotpCode(totpSecret)
    r = await fetch(`${API}/api/v1/owner/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, totp: code2 }),
    })
    body = await r.json()
    console.log('4️⃣  Login con TOTP:', r.status, body.access ? '✅ access token' : '❌ ' + body.error)
  } else if (body.needTotp) {
    // Owner ya tenía 2FA setup desde antes. No tenemos el secret guardado para
    // generar el código, así que asumimos reset.
    console.log('   → Owner ya tenía 2FA activado. Para repetir el demo, hacer reset:')
    console.log('     RESET_PASSWORD=true OWNER_EMAIL=' + EMAIL + ' OWNER_PASSWORD=... pnpm exec tsx scripts/bootstrap-owner.ts')
    return
  }

  if (!body.access) {
    console.error('No conseguimos access token; abort')
    return
  }
  const access = body.access
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` }

  // 5. Crear app "Ramallo"
  console.log('\n5️⃣  Crear App "Mi Ramallo"...')
  r = await fetch(`${API}/api/v1/owner/apps`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      slug: 'ramallo',
      nombre: 'Mi Ramallo',
      ciudad: 'Ramallo',
      provincia: 'Buenos Aires',
      primaryColor: '#0ea5e9',
      accentColor: '#0369a1',
    }),
  })
  body = await r.json()
  if (r.status === 409) {
    console.log('   → ya existía. OK.')
  } else {
    console.log('   →', r.status, body.ok ? `✅ creada (${body.app._id})` : '❌ ' + body.error)
  }

  // 6. Listar apps
  console.log('\n6️⃣  Listar apps...')
  r = await fetch(`${API}/api/v1/owner/apps`, { headers })
  body = await r.json()
  console.log('   → tenemos', body.apps?.length, 'apps:')
  body.apps?.forEach((a: any) =>
    console.log(`     · ${a.slug.padEnd(15)} ${a.nombre.padEnd(25)} ${a.status}`),
  )

  // 7. Métricas globales
  console.log('\n7️⃣  Métricas globales...')
  r = await fetch(`${API}/api/v1/owner/metrics`, { headers })
  body = await r.json()
  if (body.ok) {
    const m = body.metrics
    console.log(`     apps:        ${m.apps.active}/${m.apps.total}`)
    console.log(`     merchants:   ${m.merchants.active}/${m.merchants.total}`)
    console.log(`     vecinos:     ${m.users.total}`)
    console.log(`     canjes 30d:  ${m.redemptions.last30Days}`)
    console.log(`     MRR ARS:     $${m.revenue.mrrARS.toLocaleString('es-AR')}`)
  }

  // 8. Verificar /tenant/ramallo/config (público)
  console.log('\n8️⃣  Verificar tenant config público...')
  r = await fetch(`${API}/api/v1/tenant/ramallo/config`)
  body = await r.json()
  if (body.ok) {
    console.log(`     ✅ ${body.tenant.nombre} (${body.tenant.ciudad})`)
    console.log(`     branding: ${body.tenant.brand.primaryColor} / ${body.tenant.brand.accentColor}`)
  }

  console.log('\n✅ Flow completo OK!\n')
}

main().catch((err) => {
  console.error('ERROR:', err)
  process.exit(1)
})
