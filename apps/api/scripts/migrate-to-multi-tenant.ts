/**
 * Migración: data existente → multi-tenant.
 *
 * Etiqueta TODOS los documentos legacy (sin `appId`) como pertenecientes
 * a la app `sanpedro`. Crea la App `sanpedro` si no existe.
 *
 * IDEMPOTENTE: se puede correr varias veces, sólo procesa documentos
 * que aún no tengan `appId`.
 *
 * Uso:
 *   pnpm --filter @misanpedro/api exec tsx scripts/migrate-to-multi-tenant.ts
 *
 * Para dry-run (no escribe nada, solo loguea):
 *   DRY_RUN=true pnpm --filter @misanpedro/api exec tsx scripts/migrate-to-multi-tenant.ts
 *
 * Slug del tenant default: 'sanpedro'. Override con:
 *   DEFAULT_TENANT_SLUG=otrociudad pnpm ...
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import {
  App,
  User,
  Merchant,
  MerchantUser,
  Coupon,
  Activation,
  Redemption,
  Subscription,
  WaSend,
  CustomerNote,
  Otp,
} from '../src/models'

const URI = process.env.MONGODB_URI
if (!URI) {
  console.error('[migrate] MONGODB_URI no configurado en .env')
  process.exit(1)
}

const DRY_RUN = process.env.DRY_RUN === 'true'
const DEFAULT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? 'sanpedro'

async function main() {
  console.log(
    `\n${DRY_RUN ? '🔍 DRY RUN' : '🚀 RUNNING'} · slug default: "${DEFAULT_SLUG}"\n`,
  )

  await mongoose.connect(URI!)
  console.log('[migrate] mongo conectado')

  // 1) Asegurar que existe la App "sanpedro" (o el slug provisto).
  let app = await App.findOne({ slug: DEFAULT_SLUG })
  if (!app) {
    if (DRY_RUN) {
      console.log(`[dry-run] crearía App ${DEFAULT_SLUG}`)
    } else {
      app = await App.create({
        slug: DEFAULT_SLUG,
        nombre:
          DEFAULT_SLUG === 'sanpedro'
            ? 'Mi San Pedro'
            : DEFAULT_SLUG.charAt(0).toUpperCase() + DEFAULT_SLUG.slice(1),
        ciudad: DEFAULT_SLUG === 'sanpedro' ? 'San Pedro' : DEFAULT_SLUG,
        provincia: 'Buenos Aires',
        pais: 'Argentina',
        subdomain: DEFAULT_SLUG,
        status: 'active',
        plan: 'founder',
        brand: {
          primaryColor: '#695ede',
          accentColor: '#4239a3',
        },
      })
      console.log(`[migrate] App creada: ${app._id} (slug=${DEFAULT_SLUG})`)
    }
  } else {
    console.log(`[migrate] App ya existe: ${app._id} (slug=${DEFAULT_SLUG})`)
  }

  const appId = app?._id

  if (DRY_RUN && !appId) {
    console.log('[dry-run] Skip update steps (App no creada en dry-run)')
    // En dry-run sin app preexistente sólo contamos cuántos docs hay
    const counts = await countLegacyDocs()
    printSummary(counts, true)
    await mongoose.disconnect()
    return
  }

  // 2) Para cada modelo: updateMany docs sin appId → set appId
  const models = [
    { name: 'User', M: User },
    { name: 'Merchant', M: Merchant },
    { name: 'MerchantUser', M: MerchantUser },
    { name: 'Coupon', M: Coupon },
    { name: 'Activation', M: Activation },
    { name: 'Redemption', M: Redemption },
    { name: 'Subscription', M: Subscription },
    { name: 'WaSend', M: WaSend },
    { name: 'CustomerNote', M: CustomerNote },
    { name: 'Otp', M: Otp },
  ] as const

  const summary: Record<string, { matched: number; modified: number }> = {}

  for (const { name, M } of models) {
    const filter = { appId: { $exists: false } } as any
    const matched = await (M as any).countDocuments(filter)
    if (DRY_RUN) {
      summary[name] = { matched, modified: 0 }
      console.log(`[dry-run] ${name}: would label ${matched} docs`)
      continue
    }
    if (matched === 0) {
      summary[name] = { matched: 0, modified: 0 }
      continue
    }
    const res = await (M as any).updateMany(filter, { $set: { appId } })
    summary[name] = { matched, modified: res.modifiedCount ?? 0 }
    console.log(`[migrate] ${name}: matched ${matched} · modified ${res.modifiedCount}`)
  }

  printSummary(summary, DRY_RUN)

  // 3) Drop legacy indexes que ya no aplican (unique global → unique scoped).
  // Solo en NO-dry-run y con cuidado.
  if (!DRY_RUN) {
    await dropLegacyIndexes()
  } else {
    console.log('[dry-run] skipping drop legacy indexes')
  }

  await mongoose.disconnect()
  console.log('\n✅ Migración terminada')
}

async function countLegacyDocs() {
  const out: Record<string, { matched: number; modified: number }> = {}
  const list = [
    { name: 'User', M: User },
    { name: 'Merchant', M: Merchant },
    { name: 'MerchantUser', M: MerchantUser },
    { name: 'Coupon', M: Coupon },
    { name: 'Activation', M: Activation },
    { name: 'Redemption', M: Redemption },
    { name: 'Subscription', M: Subscription },
    { name: 'WaSend', M: WaSend },
    { name: 'CustomerNote', M: CustomerNote },
    { name: 'Otp', M: Otp },
  ] as const
  for (const { name, M } of list) {
    out[name] = {
      matched: await (M as any).countDocuments({ appId: { $exists: false } }),
      modified: 0,
    }
  }
  return out
}

function printSummary(
  s: Record<string, { matched: number; modified: number }>,
  dryRun: boolean,
) {
  console.log('\n┌──────────────────────────┬─────────┬──────────┐')
  console.log('│ Modelo                   │ Matched │ Modified │')
  console.log('├──────────────────────────┼─────────┼──────────┤')
  for (const [name, v] of Object.entries(s)) {
    const m = String(v.matched).padStart(7)
    const mod = String(v.modified).padStart(8)
    console.log(`│ ${name.padEnd(24)} │ ${m} │ ${mod} │`)
  }
  console.log('└──────────────────────────┴─────────┴──────────┘')
  if (dryRun) {
    console.log('\n⚠️  Dry run: nada se escribió. Corré sin DRY_RUN=true para aplicar.')
  }
}

/**
 * Drops legacy indexes globales que cambiamos a scoped por tenant.
 * Si el índice no existe, ignora silenciosamente.
 */
async function dropLegacyIndexes() {
  const ops = [
    { collection: 'users', index: 'dni_1' },
    { collection: 'users', index: 'email_1' },
    { collection: 'users', index: 'whatsapp_1' },
    { collection: 'merchants', index: 'slug_1' },
    { collection: 'merchantusers', index: 'email_1' },
    { collection: 'activations', index: 'codigoNumerico_1' },
  ]

  for (const { collection, index } of ops) {
    try {
      const c = mongoose.connection.db!.collection(collection)
      await c.dropIndex(index)
      console.log(`[migrate] dropped legacy index ${collection}.${index}`)
    } catch (err: any) {
      if (err?.codeName === 'IndexNotFound' || err?.code === 27) {
        // silent: índice ya no existe
        continue
      }
      console.warn(`[migrate] could not drop ${collection}.${index}:`, err?.message)
    }
  }
}

main().catch((err) => {
  console.error('[migrate] FAILED:', err)
  process.exit(1)
})
