/**
 * Crea una ciudad/tenant (App). Idempotente: si el slug ya existe, no la pisa.
 *
 * Uso (carga el .env del API para el MONGODB_URI):
 *   SLUG=narino NOMBRE="Mi Nariño" CIUDAD="Nariño" \
 *   node --import tsx --env-file=.env scripts/crear-ciudad.ts
 *
 * Opcionales: PROVINCIA, PAIS, MONEDA, LOCALE, LAT, LNG (geoCenter),
 *   PRIMARY_COLOR, ACCENT_COLOR.
 *   MONEDA = código ISO-4217 (ARS, COP, CLP, MXN, UYU, PEN, USD) · default ARS.
 *   LOCALE = BCP-47 para Intl (es-AR, es-CO, es-CL, …) · default es-AR.
 * Para crear varias, corré el comando una vez por ciudad (o un wrapper en bash).
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
const ciudad = process.env.CIUDAD?.trim()
const provincia = process.env.PROVINCIA?.trim() ?? 'Buenos Aires'
const pais = process.env.PAIS?.trim() ?? 'Argentina'
const moneda = process.env.MONEDA?.trim() ?? 'ARS'
const locale = process.env.LOCALE?.trim() ?? 'es-AR'
const lat = process.env.LAT ? Number(process.env.LAT) : undefined
const lng = process.env.LNG ? Number(process.env.LNG) : undefined
const primaryColor = process.env.PRIMARY_COLOR ?? '#ea580c'
const accentColor = process.env.ACCENT_COLOR ?? '#c2410c'

if (!slug || !nombre || !ciudad) {
  console.error('❌ Requeridos: SLUG, NOMBRE, CIUDAD')
  process.exit(1)
}

async function main() {
  await mongoose.connect(URI!, { dbName: process.env.MONGODB_DB ?? 'misanpedro' })
  console.log('[crear-ciudad] mongo:', mongoose.connection.name)

  const existing = await App.findOne({ slug })
  if (existing) {
    if (process.env.UPDATE === 'true') {
      // Actualiza localización/marca de una ciudad existente (no toca sus datos).
      existing.set({ nombre, ciudad, provincia, pais, moneda, locale })
      existing.brand = { ...existing.brand, primaryColor, accentColor }
      await existing.save()
      console.log(`✏️  Actualizada "${slug}" → ${nombre} · ${ciudad}, ${pais} · moneda=${moneda} · locale=${locale}`)
      await mongoose.disconnect()
      return
    }
    console.log(`ℹ️  Ya existe "${slug}" (${existing.nombre}). Para actualizarla: UPDATE=true`)
    await mongoose.disconnect()
    return
  }

  const hasGeo = lat != null && !Number.isNaN(lat) && lng != null && !Number.isNaN(lng)
  const app = await App.create({
    slug,
    nombre,
    ciudad,
    provincia,
    pais,
    moneda,
    locale,
    subdomain: slug,
    status: 'active',
    plan: 'founder',
    brand: { primaryColor, accentColor },
    ...(hasGeo ? { geoCenter: { lat, lng } } : {}),
  })

  console.log(`✅ Ciudad creada: ${app.nombre} · slug=${app.slug} · ${app.ciudad}, ${app.provincia}, ${app.pais}`)
  console.log(`   moneda=${app.moneda} · locale=${app.locale}`)
  console.log(`   appId=${app._id} · status=${app.status} · geoCenter=${JSON.stringify(app.geoCenter)}`)
  console.log(`   Arranca VACÍA (0 comercios / 0 cupones / 0 usuarios), aislada por appId.`)
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('[crear-ciudad] FAILED:', err)
  process.exit(1)
})
