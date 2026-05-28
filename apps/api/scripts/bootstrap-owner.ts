/**
 * Crea el primer Owner del SaaS.
 *
 * Uso:
 *   OWNER_EMAIL=alan@misanpedro.app \
 *   OWNER_PASSWORD='mi-password-segura' \
 *   OWNER_NOMBRE='Alan Tapia' \
 *   pnpm --filter @misanpedro/api exec tsx scripts/bootstrap-owner.ts
 *
 * Si el email ya existe, falla. Para resetear el password de un Owner existente:
 *   RESET_PASSWORD=true OWNER_EMAIL=... OWNER_PASSWORD=... pnpm exec tsx ...
 *
 * Tras crear el owner, abrí el Owner Panel y logueate. El primer login
 * te va a mostrar el QR del 2FA para escanear con Google Authenticator.
 */

import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { Owner } from '../src/models'

const URI = process.env.MONGODB_URI
if (!URI) {
  console.error('❌ MONGODB_URI no configurado')
  process.exit(1)
}

const email = process.env.OWNER_EMAIL?.toLowerCase().trim()
const password = process.env.OWNER_PASSWORD
const nombre = process.env.OWNER_NOMBRE ?? 'Owner'
const reset = process.env.RESET_PASSWORD === 'true'

if (!email) {
  console.error('❌ OWNER_EMAIL requerido')
  process.exit(1)
}
if (!password || password.length < 8) {
  console.error('❌ OWNER_PASSWORD requerido (mín 8 chars)')
  process.exit(1)
}

async function main() {
  // Mismo dbName que usa el API en src/db/connection.ts. Sin esto, el script
  // crearía el Owner en la DB default ('test') y el API no lo encontraría.
  await mongoose.connect(URI!, { dbName: process.env.MONGODB_DB ?? 'misanpedro' })
  console.log('[bootstrap-owner] mongo conectado · db:', mongoose.connection.name)

  const existing = await Owner.findOne({ email })
  if (existing && !reset) {
    console.error(`❌ Ya existe un Owner con email ${email}. Para resetear: RESET_PASSWORD=true`)
    process.exit(2)
  }

  const passwordHash = await bcrypt.hash(password!, 10)

  if (existing && reset) {
    existing.passwordHash = passwordHash
    existing.totpEnabled = false
    existing.totpSecret = ''
    await existing.save()
    console.log(`✅ Owner ${email} actualizado. 2FA reseteado — próximo login te muestra el QR.`)
  } else {
    const owner = await Owner.create({
      email,
      passwordHash,
      nombre,
      rol: 'super',
      enabled: true,
    })
    console.log(`✅ Owner creado: ${owner._id}`)
    console.log(`   email: ${owner.email}`)
    console.log(`   nombre: ${owner.nombre}`)
    console.log(`   rol: ${owner.rol}`)
    console.log('')
    console.log('🔐 Primer login va a mostrarte el QR del 2FA.')
    console.log('   Escaneá con Google Authenticator / Authy / 1Password.')
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('[bootstrap-owner] FAILED:', err)
  process.exit(1)
})
