/**
 * Script de reset completo de la base.
 *
 *   pnpm --filter @misanpedro/api exec tsx scripts/reset-db.ts
 *
 * Borra TODO: users, merchants, cupones, activaciones, canjes, notas,
 * sesiones, password resets, otps, suscripciones. Es DESTRUCTIVO.
 *
 * Después de correrlo, el seed automático del API se va a reactivar
 * (crea los comercios demo "La Esquina", "Café Bohemio", etc.) en el
 * próximo restart del servidor. Si querés DB completamente vacía sin
 * seeds, también comentá la línea `ensureSeedMerchants()` en src/index.ts.
 */

// Usa --env-file=.env de node para cargar MONGODB_URI
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) {
  console.error('[reset-db] MONGODB_URI no configurado en .env')
  process.exit(1)
}

const COLLECTIONS = [
  'users',
  'merchantusers',
  'merchants',
  'coupons',
  'activations',
  'redemptions',
  'subscriptions',
  'passwordresets',
  'otps',
  'refreshtokens',
  'customernotes',
]

async function main() {
  console.log('[reset-db] conectando a', URI?.replace(/:[^@:]+@/, ':***@'))
  await mongoose.connect(URI!, { dbName: 'misanpedro' })
  const db = mongoose.connection.db
  if (!db) throw new Error('no db')

  for (const name of COLLECTIONS) {
    try {
      const before = await db.collection(name).countDocuments()
      if (before === 0) {
        console.log(`[reset-db] ${name.padEnd(20)} ya vacía`)
        continue
      }
      await db.collection(name).deleteMany({})
      console.log(`[reset-db] ${name.padEnd(20)} borrados ${before} docs ✓`)
    } catch (err: any) {
      if (err?.codeName === 'NamespaceNotFound') {
        console.log(`[reset-db] ${name.padEnd(20)} no existe`)
      } else {
        console.error(`[reset-db] ${name.padEnd(20)} ERROR`, err.message)
      }
    }
  }

  await mongoose.disconnect()
  console.log('[reset-db] listo ✅')
}

main().catch((err) => {
  console.error('[reset-db] ERROR', err)
  process.exit(1)
})
