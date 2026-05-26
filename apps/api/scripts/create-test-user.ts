/**
 * Crea un MerchantUser de test para QA.
 * Uso: pnpm --filter @misanpedro/api exec tsx scripts/create-test-user.ts
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { App, Merchant, MerchantUser } from '../src/models'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('❌ MONGODB_URI no configurado'); process.exit(1) }

async function main() {
  await mongoose.connect(URI!, { dbName: process.env.MONGODB_DB ?? 'misanpedro' })
  console.log('[create-test-user] mongo conectado · db:', mongoose.connection.name)

  const app = await App.findOne({ slug: 'sanpedro' })
  if (!app) { console.error('❌ App sanpedro no encontrada'); process.exit(1) }
  console.log('[create-test-user] app:', app._id.toString(), app.slug)

  const merchants = await Merchant.find({ appId: app._id }).lean()
  console.log('[create-test-user] merchants encontrados:', merchants.map(m => `${m.slug} (${m._id})`))

  if (merchants.length === 0) { console.error('❌ No hay merchants'); process.exit(1) }

  // Usar el primer merchant (QA Test o el que sea)
  const merchant = merchants[0]
  console.log('[create-test-user] usando merchant:', merchant.nombre, merchant._id.toString())

  const email = 'qa@misanpedro.app'
  const password = 'qa123456'
  const passwordHash = await bcrypt.hash(password, 10)

  // Borrar si ya existe
  await MerchantUser.deleteOne({ appId: app._id, email })

  const user = await MerchantUser.create({
    appId: app._id,
    merchantId: merchant._id,
    email,
    passwordHash,
    nombre: 'QA Admin',
    rol: 'admin',
  })

  console.log('✅ MerchantUser creado:')
  console.log('   email:', email)
  console.log('   password:', password)
  console.log('   merchant:', merchant.nombre)
  console.log('   userId:', user._id.toString())

  await mongoose.disconnect()
}

main().catch(err => { console.error('FAILED:', err); process.exit(1) })
