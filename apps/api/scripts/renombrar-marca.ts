/**
 * Cambia el NOMBRE COMERCIAL (`App.nombre`) de una ciudad. Sólo el nombre visible:
 * no toca `slug`, `subdomain`, `ciudad` ni ningún identificador — el nombre es
 * puro branding y se muestra en la landing, la PWA, el panel y los mails.
 *
 * Corre en DRY-RUN por defecto: muestra qué cambiaría y no escribe nada.
 * Para aplicar, pasá APPLY=true.
 *
 * Uso (carga el .env del API para el MONGODB_URI):
 *   SLUG=sanpedro NOMBRE="MiSanPedro" \
 *   node --import tsx --env-file=.env scripts/renombrar-marca.ts
 *
 *   SLUG=sanpedro NOMBRE="MiSanPedro" APPLY=true \
 *   node --import tsx --env-file=.env scripts/renombrar-marca.ts
 */
import mongoose from 'mongoose'
import { App } from '../src/models'

const URI = process.env.MONGODB_URI
if (!URI) {
  console.error('❌ MONGODB_URI no configurado (corré con --env-file=.env)')
  process.exit(1)
}

const slug = process.env.SLUG?.toLowerCase().trim()
const nombre = process.env.NOMBRE?.trim()
const apply = process.env.APPLY === 'true'

if (!slug || !nombre) {
  console.error('❌ Faltan SLUG y/o NOMBRE. Ej: SLUG=sanpedro NOMBRE="MiSanPedro"')
  process.exit(1)
}

async function main() {
  await mongoose.connect(URI as string)

  const app = await App.findOne({ slug }).lean()
  if (!app) {
    console.error(`❌ No existe ninguna ciudad con slug "${slug}".`)
    process.exit(1)
  }

  console.log(`\nCiudad: ${app.slug} (${app.ciudad})`)
  console.log(`  nombre actual : "${app.nombre}"`)
  console.log(`  nombre nuevo  : "${nombre}"`)
  console.log(`  (slug, subdomain y ciudad NO se tocan)`)

  if (app.nombre === nombre) {
    console.log('\n✓ Ya estaba con ese nombre. No hay nada que hacer.')
    await mongoose.disconnect()
    return
  }

  if (!apply) {
    console.log('\n🔎 DRY-RUN: no se escribió nada. Repetí con APPLY=true para aplicar.\n')
    await mongoose.disconnect()
    return
  }

  const res = await App.updateOne({ slug }, { $set: { nombre } })
  console.log(`\n✅ Aplicado. Documentos modificados: ${res.modifiedCount}`)

  const check = await App.findOne({ slug }).select('slug nombre ciudad subdomain').lean()
  console.log(`   Verificación: ${JSON.stringify(check)}\n`)

  await mongoose.disconnect()
}

main().catch(async (e) => {
  console.error('❌ Error:', e)
  await mongoose.disconnect()
  process.exit(1)
})
