/**
 * Crea una ciudad/tenant (App). Idempotente: si el slug ya existe, no la pisa.
 *
 * Uso (carga el .env del API para el MONGODB_URI):
 *   SLUG=narino NOMBRE="Mi Nariño" CIUDAD="Nariño" \
 *   node --import tsx --env-file=.env scripts/crear-ciudad.ts
 *
 * Opcionales: PROVINCIA, PAIS, MONEDA, LOCALE, SUBDOMAIN, LAT, LNG (geoCenter),
 *   PRIMARY_COLOR, ACCENT_COLOR.
 *   SUBDOMAIN = label en micuidad.com (default mi<slug>). Acepta IDN: SUBDOMAIN=minariño.
 *   MONEDA = código ISO-4217 (ARS, COP, CLP, MXN, UYU, PEN, USD) · default ARS.
 *   LOCALE = BCP-47 para Intl (es-AR, es-CO, es-CL, …) · default es-AR.
 * Para crear varias, corré el comando una vez por ciudad (o un wrapper en bash).
 */
import mongoose from 'mongoose'
import { App } from '../src/models'
import { toAsciiLabel } from '../src/middleware/tenant'

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
const hasGeo = lat != null && !Number.isNaN(lat) && lng != null && !Number.isNaN(lng)
const hasColor = !!(process.env.PRIMARY_COLOR || process.env.ACCENT_COLOR)
// Subdominio en micuidad.com. Default = convención mi<slug>. Normalizado a ASCII
// (punycode) para IDN como 'minariño'. SUBDOMAIN lo overridea (ej. SUBDOMAIN=minariño).
const subdomain = toAsciiLabel(process.env.SUBDOMAIN?.trim() || `mi${slug ?? ''}`)

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
      // Actualiza localización de una ciudad existente (no toca sus datos).
      existing.set({ nombre, ciudad, provincia, pais, moneda, locale })
      // Solo pisamos brand/geo si se proveyeron explícitamente; si no, conservamos
      // los colores y el centro que la ciudad ya tenía.
      if (hasColor) {
        existing.brand = {
          ...existing.brand,
          ...(process.env.PRIMARY_COLOR ? { primaryColor } : {}),
          ...(process.env.ACCENT_COLOR ? { accentColor } : {}),
        }
      }
      if (hasGeo) existing.set({ geoCenter: { lat, lng } })
      if (process.env.SUBDOMAIN) existing.set({ subdomain })
      await existing.save()
      console.log(
        `✏️  Actualizada "${slug}" → ${nombre} · ${ciudad}, ${pais} · moneda=${moneda} · locale=${locale}` +
          `${hasColor ? ' · brand actualizado' : ''}${hasGeo ? ` · geo=${lat},${lng}` : ''}`,
      )
      await mongoose.disconnect()
      return
    }
    console.log(`ℹ️  Ya existe "${slug}" (${existing.nombre}). Para actualizarla: UPDATE=true`)
    await mongoose.disconnect()
    return
  }

  const app = await App.create({
    slug,
    nombre,
    ciudad,
    provincia,
    pais,
    moneda,
    locale,
    subdomain,
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
