/**
 * Limpia comercios de PRUEBA del tenant (los que tienen "(borrar)" en el nombre)
 * y todo lo que cuelga de ellos. Pensado para borrar la data que dejaron las
 * pruebas de QA del flujo de referidos sin tocar comercios reales.
 *
 * Uso (dry-run por defecto, NO borra nada):
 *   MONGODB_URI=... pnpm --filter @misanpedro/api exec tsx scripts/cleanup-qa-data.ts
 *
 * Para borrar de verdad:
 *   MONGODB_URI=... pnpm --filter @misanpedro/api exec tsx scripts/cleanup-qa-data.ts --confirm
 *
 * Tenant por defecto: sanpedro. Override con TENANT_SLUG=ramallo.
 */

import mongoose from 'mongoose'
import { App, Merchant, MerchantUser, Coupon, Referral, Activation, Redemption } from '../src/models'

const URI = process.env.MONGODB_URI
if (!URI) {
  console.error('❌ MONGODB_URI no configurado')
  process.exit(1)
}

const SLUG = process.env.TENANT_SLUG ?? 'sanpedro'
const CONFIRM = process.argv.includes('--confirm')
// Solo comercios marcados explícitamente como descartables.
const NAME_RE = /\(borrar\)/i

async function main() {
  await mongoose.connect(URI!, { dbName: process.env.MONGODB_DB ?? 'misanpedro' })
  console.log(`[cleanup] db: ${mongoose.connection.name} · tenant: ${SLUG} · modo: ${CONFIRM ? 'BORRAR' : 'dry-run'}`)

  const app = await App.findOne({ slug: SLUG })
  if (!app) {
    console.error(`❌ No existe el tenant '${SLUG}'`)
    process.exit(2)
  }
  const appId = app._id

  const merchants = await Merchant.find({ appId, nombre: NAME_RE }, { nombre: 1, slug: 1 })
  if (merchants.length === 0) {
    console.log('✅ No hay comercios de prueba "(borrar)" para limpiar.')
    await mongoose.disconnect()
    return
  }

  const ids = merchants.map((m) => m._id)
  console.log(`\nComercios de prueba encontrados (${merchants.length}):`)
  for (const m of merchants) console.log(`  · ${m.nombre}  [${m.slug}]`)

  // Conteo de lo que cuelga (para mostrar el blast radius antes de borrar).
  const [coupons, refsAsReferrer, refsAsReferred, users, activations, redemptions] = await Promise.all([
    Coupon.countDocuments({ appId, merchantId: { $in: ids } }),
    Referral.countDocuments({ appId, referrerMerchantId: { $in: ids } }),
    Referral.countDocuments({ appId, referredMerchantId: { $in: ids } }),
    MerchantUser.countDocuments({ appId, merchantId: { $in: ids } }),
    Activation.countDocuments({ appId, merchantId: { $in: ids } }),
    Redemption.countDocuments({ appId, merchantId: { $in: ids } }),
  ])
  console.log(
    `\nCascade: ${coupons} cupones · ${users} usuarios · ${refsAsReferrer + refsAsReferred} referrals · ${activations} activaciones · ${redemptions} redemptions`,
  )

  if (!CONFIRM) {
    console.log('\n(dry-run) No se borró nada. Corré con --confirm para ejecutar.')
    await mongoose.disconnect()
    return
  }

  await Coupon.deleteMany({ appId, merchantId: { $in: ids } })
  await Referral.deleteMany({ appId, $or: [{ referrerMerchantId: { $in: ids } }, { referredMerchantId: { $in: ids } }] })
  await Activation.deleteMany({ appId, merchantId: { $in: ids } })
  await Redemption.deleteMany({ appId, merchantId: { $in: ids } })
  await MerchantUser.deleteMany({ appId, merchantId: { $in: ids } })
  await Merchant.deleteMany({ appId, _id: { $in: ids } })

  console.log(`\n✅ Borrados ${merchants.length} comercios de prueba y su cascade.`)
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('[cleanup] FAILED:', err)
  process.exit(1)
})
