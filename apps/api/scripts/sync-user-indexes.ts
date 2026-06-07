// One-off: sincroniza los índices de User con el schema actual.
// Dropea los unique viejos (appId+dni, appId+email, appId+whatsapp) y crea
// el nuevo {appId, telefono} unique. Pre-lanzamiento (datos descartables).
//   Run: node --import tsx --env-file=.env scripts/sync-user-indexes.ts
import mongoose from 'mongoose'
import { User } from '../src/models/User'

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI vacío')
  // MISMO dbName que la app (src/db/connection.ts), si no sincroniza otra DB.
  await mongoose.connect(uri, { dbName: 'misanpedro' })
  const before = (await User.collection.indexes()).map((i) => i.name)
  console.log('índices ANTES:', before)
  // Limpieza total de índices viejos (dni_1, email_1, compuestos unique, etc.).
  try {
    await User.collection.dropIndexes()
  } catch (e) {
    console.log('dropIndexes:', (e as Error).message)
  }
  await User.syncIndexes()
  const after = (await User.collection.indexes()).map((i) => i.name)
  console.log('índices DESPUÉS:', after)
  await mongoose.disconnect()
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
