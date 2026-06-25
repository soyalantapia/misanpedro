import mongoose from 'mongoose'
import { env } from '@/env'
import { App, User, Owner, PushSubscription } from '@/models'

let connectingPromise: Promise<typeof mongoose> | null = null

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose
  if (connectingPromise) return connectingPromise

  console.log('[db] connecting to MongoDB…')
  connectingPromise = mongoose
    .connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      // Database name se infiere del URI o usa 'misanpedro' por default
      dbName: 'misanpedro',
    })
    .then(async (m) => {
      console.log('[db] connected:', m.connection.host)
      // Reconciliación de índices de User (idempotente, NO fatal): el onboarding
      // sin fricción cambió la identidad a `telefono`. Dropea los unique viejos
      // (dni/email) que rompen el alta por dup-key en null, y crea el parcial
      // {appId,telefono}. Cuando ya está alineado es no-op. Corre dentro de
      // Railway, donde el Mongo interno sí resuelve (no se puede desde local).
      try {
        const dropped = await User.syncIndexes()
        if (dropped.length) console.log('[db] User indexes reconciliados, dropeados:', dropped)
      } catch (err) {
        console.error('[db] User.syncIndexes (no fatal):', (err as Error)?.message)
      }
      // Garantizamos el índice unique de Owner.email ANTES del bootstrap, para que
      // la creación del owner no pueda dejar duplicados si el índice aún no existía
      // (BD nueva). Idempotente, no fatal — mismo patrón que User.syncIndexes().
      try {
        await Owner.syncIndexes()
      } catch (err) {
        console.error('[db] Owner.syncIndexes (no fatal):', (err as Error)?.message)
      }
      // PushSubscription cambió de unique global {endpoint} a unique por ciudad
      // {appId,endpoint}. syncIndexes dropea el `endpoint_1` viejo (que impedía
      // que un mismo browser se suscriba a 2 ciudades) y crea el compuesto.
      try {
        const dropped = await PushSubscription.syncIndexes()
        if (dropped.length) console.log('[db] PushSubscription indexes reconciliados, dropeados:', dropped)
      } catch (err) {
        console.error('[db] PushSubscription.syncIndexes (no fatal):', (err as Error)?.message)
      }
      // Bootstrap one-time del Owner (super-admin). Corre DENTRO de Railway, donde
      // el Mongo interno sí resuelve (no se puede crear desde local). Idempotente.
      try {
        await bootstrapOwner()
      } catch (err) {
        console.error('[db] bootstrapOwner (no fatal):', (err as Error)?.message)
      }
      // Seed one-time de una ciudad vía SEED_CITY_JSON (idempotente). Sirve para
      // crear una ciudad en prod sin loguearse al panel ni alcanzar la DB interna.
      try {
        await seedCityFromEnv()
      } catch (err) {
        console.error('[db] seedCityFromEnv (no fatal):', (err as Error)?.message)
      }
      return m
    })
    .catch((err) => {
      connectingPromise = null
      throw err
    })

  return connectingPromise
}

/**
 * Crea el Owner (super-admin) si se setearon OWNER_BOOTSTRAP_EMAIL +
 * OWNER_BOOTSTRAP_PASSWORD y todavía no existe. Idempotente: si ya existe, no hace
 * nada. Pensado para correr una vez en prod y luego borrar OWNER_BOOTSTRAP_PASSWORD.
 * El primer login del Owner pide configurar el 2FA (si OWNER_2FA_REQUIRED=true).
 */
async function bootstrapOwner(): Promise<void> {
  // Auth OTP-only: el owner se crea SIN contraseña. Solo necesita
  // OWNER_BOOTSTRAP_EMAIL. Entra pidiendo un código a su email. Idempotente.
  const email = env.OWNER_BOOTSTRAP_EMAIL?.toLowerCase().trim()
  if (!email) return
  const existing = await Owner.findOne({ email })
  if (existing) {
    console.log(`[bootstrap-owner] ya existe ${email} — skip`)
    return
  }
  const owner = await Owner.create({
    email,
    nombre: env.OWNER_BOOTSTRAP_NOMBRE || email.split('@')[0],
    rol: 'super',
    enabled: true,
  })
  console.log(
    `[bootstrap-owner] ✅ Owner creado: ${owner.email} (rol super, OTP-only). ` +
      `Entrá pidiendo un código a tu email.`,
  )
}

/**
 * Seed idempotente de UNA ciudad vía env `SEED_CITY_JSON` (objeto JSON con
 * slug/nombre/ciudad/provincia/pais/moneda/locale/subdomain/primaryColor/accentColor).
 * Corre DENTRO de Railway (donde el Mongo interno resuelve), para crear una ciudad en
 * prod sin poder loguearse al panel ni alcanzar la DB desde local. Si el slug ya
 * existe, no hace nada. Tras usarlo, borrá SEED_CITY_JSON del env.
 */
async function seedCityFromEnv(): Promise<void> {
  const raw = process.env.SEED_CITY_JSON?.trim()
  if (!raw) return
  let data: Record<string, string>
  try {
    data = JSON.parse(raw)
  } catch {
    console.error('[seed-city] SEED_CITY_JSON no es JSON válido — skip')
    return
  }
  if (!data.slug || !data.nombre || !data.ciudad) {
    console.error('[seed-city] faltan slug/nombre/ciudad — skip')
    return
  }
  const existing = await App.findOne({ slug: data.slug })
  if (existing) {
    // Update opcional: con SEED_CITY_UPDATE=true pisamos los campos provistos
    // (sirve para corregir datos de una ciudad ya creada, ej. color/moneda).
    if (process.env.SEED_CITY_UPDATE === 'true') {
      existing.set({ nombre: data.nombre, ciudad: data.ciudad })
      if (data.provincia) existing.set('provincia', data.provincia)
      if (data.pais) existing.set('pais', data.pais)
      if (data.moneda) existing.set('moneda', data.moneda)
      if (data.locale) existing.set('locale', data.locale)
      if (data.subdomain) existing.set('subdomain', data.subdomain.toLowerCase())
      if (data.primaryColor) existing.set('brand.primaryColor', data.primaryColor)
      if (data.accentColor) existing.set('brand.accentColor', data.accentColor)
      await existing.save()
      console.log(`[seed-city] ✏️ "${data.slug}" actualizada. Borrá SEED_CITY_JSON + SEED_CITY_UPDATE.`)
      return
    }
    console.log(`[seed-city] ya existe "${data.slug}" — skip (podés borrar SEED_CITY_JSON)`)
    return
  }
  const app = await App.create({
    slug: data.slug,
    nombre: data.nombre,
    ciudad: data.ciudad,
    provincia: data.provincia ?? '',
    pais: data.pais ?? 'Argentina',
    moneda: data.moneda ?? 'ARS',
    locale: data.locale ?? 'es-AR',
    subdomain: (data.subdomain ?? `mi${data.slug}`).toLowerCase(),
    status: 'active',
    plan: 'founder',
    brand: {
      primaryColor: data.primaryColor ?? '#ea580c',
      accentColor: data.accentColor ?? '#c2410c',
    },
  })
  console.log(
    `[seed-city] ✅ ciudad creada: ${app.nombre} (${app.slug}) · ${app.pais} · ` +
      `${app.moneda}/${app.locale} · subdomain=${app.subdomain}. Borrá SEED_CITY_JSON del env.`,
  )
}

mongoose.connection.on('disconnected', () => {
  console.warn('[db] disconnected')
  connectingPromise = null
})

mongoose.connection.on('error', (err) => {
  console.error('[db] error:', err.message)
})
