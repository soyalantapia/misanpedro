import bcrypt from 'bcryptjs'
import { App, Coupon, Merchant, MerchantUser } from '@/models'

const SAN_PEDRO = { lat: -33.6797, lng: -59.6669 }
const offset = (latDelta: number, lngDelta: number) => ({
  lat: SAN_PEDRO.lat + latDelta,
  lng: SAN_PEDRO.lng + lngDelta,
})

const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

const SEED_MERCHANTS = [
  {
    slug: 'la-esquina',
    nombre: 'La Esquina',
    categoria: 'gastronomia' as const,
    direccion: 'Mitre 1247, San Pedro',
    coords: offset(0.001, -0.0008),
    telefono: '(03329) 425-678',
    horarios: 'Mar a Dom · 19 a 24 hs',
    cover: 'la-esquina',
    logoSeed: 'LE',
    destacado: true,
  },
  {
    slug: 'carmen-vintage',
    nombre: 'Carmen Vintage',
    categoria: 'indumentaria' as const,
    direccion: 'Pellegrini 458, San Pedro',
    coords: offset(-0.0012, 0.0006),
    telefono: '(03329) 422-901',
    horarios: 'Lun a Sáb · 10 a 13 y 17 a 20:30 hs',
    cover: 'carmen',
    logoSeed: 'CV',
  },
  {
    slug: 'vivero-pampero',
    nombre: 'Vivero El Pampero',
    categoria: 'hogar' as const,
    direccion: 'Av. 3 de Febrero 2104, San Pedro',
    coords: offset(0.0034, 0.0021),
    telefono: '(03329) 428-110',
    horarios: 'Lun a Sáb · 9 a 13 y 16 a 19 hs',
    cover: 'pampero',
    logoSeed: 'VP',
  },
  {
    slug: 'farmacia-centro',
    nombre: 'Farmacia del Centro',
    categoria: 'salud' as const,
    direccion: 'Mitre 980, San Pedro',
    coords: offset(0.0006, -0.0003),
    telefono: '(03329) 423-444',
    horarios: 'Todos los días · 8 a 22 hs',
    cover: 'farmacia',
    logoSeed: 'FC',
  },
  {
    slug: 'almendra-belleza',
    nombre: 'Almendra Belleza',
    categoria: 'belleza' as const,
    direccion: 'Pellegrini 712, San Pedro',
    coords: offset(-0.0008, 0.0014),
    telefono: '(03329) 15-498-201',
    horarios: 'Mar a Sáb · 10 a 19 hs',
    cover: 'almendra',
    logoSeed: 'AB',
  },
  {
    slug: 'estacion-25',
    nombre: 'Estación 25',
    categoria: 'gastronomia' as const,
    direccion: 'Bv. 25 de Mayo 1402, San Pedro',
    coords: offset(0.0021, -0.0017),
    telefono: '(03329) 426-700',
    horarios: 'Mar a Dom · 9 a 23 hs',
    cover: 'estacion',
    logoSeed: 'E25',
  },
  {
    slug: 'servimax',
    nombre: 'Servimax',
    categoria: 'servicios' as const,
    direccion: 'Belgrano 1518, San Pedro',
    coords: offset(-0.0024, -0.0011),
    telefono: '(03329) 427-330',
    horarios: 'Lun a Vie · 8 a 18 hs',
    cover: 'servimax',
    logoSeed: 'SM',
  },
  {
    slug: 'hogar-parana',
    nombre: 'Hogar Río Paraná',
    categoria: 'hogar' as const,
    direccion: 'San Martín 220, San Pedro',
    coords: offset(0.0042, 0.0008),
    telefono: '(03329) 424-820',
    horarios: 'Lun a Sáb · 9 a 13 y 15:30 a 20 hs',
    cover: 'parana',
    logoSeed: 'HP',
  },
]

const SEED_COUPONS = [
  {
    merchantSlug: 'la-esquina',
    titulo: 'Pizzas martes y miércoles a la noche',
    descripcion:
      'Llevate tu pizza favorita con 20% de descuento todos los martes y miércoles después de las 20 hs. Aplicable a la carta completa, incluyendo las especiales de la casa.',
    condiciones:
      'Válido solo de 20 a 23 hs. No acumulable con otras promociones. Excluye bebidas alcohólicas.',
    porcentaje: 20,
    diasOffset: 45,
    diasAplica: 'Martes y miércoles · 20 a 23 hs',
  },
  {
    merchantSlug: 'la-esquina',
    titulo: '15% en pastas caseras los jueves',
    descripcion:
      'Pastas caseras con 15% de descuento todos los jueves al mediodía y a la noche. Salsas incluidas.',
    condiciones: 'Válido todos los jueves. No acumulable con otras promociones.',
    porcentaje: 15,
    diasOffset: 45,
    diasAplica: 'Jueves · todo el día',
  },
  {
    merchantSlug: 'carmen-vintage',
    titulo: '25% en colección otoño/invierno',
    descripcion:
      'Toda la colección otoño/invierno con 25% de descuento. Tapados, camperas, sweaters y accesorios seleccionados.',
    condiciones: 'Hasta agotar stock. Sólo prendas marcadas con el sticker MSP.',
    porcentaje: 25,
    diasOffset: 28,
    diasAplica: 'Lun a Sáb · horario comercial',
  },
  {
    merchantSlug: 'vivero-pampero',
    titulo: '15% en plantas de interior y exterior',
    descripcion:
      'Plantas de interior y exterior, macetas y sustrato con 15% de descuento. Asesoramiento técnico incluido.',
    condiciones: 'No incluye herramientas ni insumos premium importados.',
    porcentaje: 15,
    diasOffset: 60,
    diasAplica: 'Todos los días',
  },
  {
    merchantSlug: 'farmacia-centro',
    titulo: '10% en cuidado personal de marca propia',
    descripcion:
      'Línea completa de cuidado personal: cremas, jabones, champús y desodorantes de marca propia con 10% de descuento.',
    condiciones: 'Lunes a viernes hasta las 20 hs. No incluye medicamentos recetados.',
    porcentaje: 10,
    diasOffset: 90,
    diasAplica: 'Lun a Vie · hasta 20 hs',
  },
  {
    merchantSlug: 'almendra-belleza',
    titulo: '30% en tratamiento facial premium',
    descripcion:
      'Tratamiento facial premium de 60 minutos con 30% de descuento. Limpieza profunda, hidratación y masaje. Productos veganos.',
    condiciones: 'Solo con turno previo. Válido para clientes nuevos del mes.',
    porcentaje: 30,
    diasOffset: 35,
    diasAplica: 'Mar a Sáb · con turno',
  },
  {
    merchantSlug: 'almendra-belleza',
    titulo: '20% en corte + brushing',
    descripcion: 'Corte y peinado con 20% de descuento. Cepillo y producto de styling incluidos.',
    condiciones: 'Solo con turno previo. No acumulable con tratamientos de color.',
    porcentaje: 20,
    diasOffset: 35,
  },
  {
    merchantSlug: 'estacion-25',
    titulo: '20% en brunch de fin de semana',
    descripcion:
      'Brunch de sábado y domingo con 20% de descuento. Café o jugo + tostones + huevos al gusto + frutas + dulce.',
    condiciones: 'Sáb y Dom de 9:30 a 13 hs. Por persona, máximo 4 cubiertos por mesa.',
    porcentaje: 20,
    diasOffset: 50,
    diasAplica: 'Sáb y Dom · 9:30 a 13 hs',
  },
  {
    merchantSlug: 'servimax',
    titulo: '15% en cambio de aceite y filtros',
    descripcion:
      'Cambio de aceite + filtro de aceite + revisión general gratuita con 15% de descuento. Aceite multigrade incluido.',
    condiciones: 'Sólo turnos lunes a jueves. Excluye marcas premium importadas.',
    porcentaje: 15,
    diasOffset: 60,
    diasAplica: 'Lun a Jue · con turno',
  },
  {
    merchantSlug: 'hogar-parana',
    titulo: '20% en línea de deco y textil',
    descripcion:
      'Cortinas, almohadones, alfombras y accesorios de decoración con 20% de descuento. Selección curada de productos nacionales.',
    condiciones: 'Hasta agotar stock. No acumulable con liquidaciones de temporada.',
    porcentaje: 20,
    diasOffset: 40,
  },
  {
    merchantSlug: 'hogar-parana',
    titulo: '10% en iluminación LED',
    descripcion: 'Toda la línea de iluminación LED de bajo consumo con 10% de descuento.',
    condiciones: 'No acumulable con promociones de marca.',
    porcentaje: 10,
    diasOffset: 40,
  },
]

const SEED_MERCHANT_USERS = [
  { merchantSlug: 'la-esquina', email: 'cajero@laesquina.com', nombre: 'Pablo Caja', rol: 'cajero' as const },
  { merchantSlug: 'carmen-vintage', email: 'admin@carmenvintage.com', nombre: 'Carmen', rol: 'admin' as const },
  { merchantSlug: 'vivero-pampero', email: 'jose@vivero-pampero.com', nombre: 'José Pampero', rol: 'admin' as const },
]

const DEMO_PASSWORD = 'demo123'

/**
 * Asegura que exista la App "sanpedro" (tenant default).
 * Idempotente — no falla si ya existe.
 */
async function ensureSanpedroApp() {
  // Backfill idempotente del brand: el doc de sanpedro fue sembrado con el violeta
  // legacy (#695ede) antes del rebrand a naranja. Como applyBrandingToDom ahora pisa
  // --color-brand en runtime con el primaryColor del tenant, ese doc viejo forzaba a
  // la PWA a mostrar violeta. Lo corregimos a naranja. Self-limiting: solo matchea el
  // violeta, así que tras correr una vez es no-op. Corre dentro de Railway (Mongo interno).
  await App.updateOne(
    { slug: 'sanpedro', 'brand.primaryColor': '#695ede' },
    { $set: { 'brand.primaryColor': '#ea580c', 'brand.accentColor': '#c2410c' } },
  )
  // Backfill de moneda/locale: el doc fue sembrado antes de existir estos campos, así
  // que no los tiene y lean() no aplica defaults → endpoints los omitían. Self-limiting.
  await App.updateOne(
    { slug: 'sanpedro', moneda: { $exists: false } },
    { $set: { moneda: 'ARS', locale: 'es-AR' } },
  )
  const existing = await App.findOne({ slug: 'sanpedro' })
  if (existing) return existing
  return await App.create({
    slug: 'sanpedro',
    nombre: 'Mi San Pedro',
    ciudad: 'San Pedro',
    provincia: 'Buenos Aires',
    pais: 'Argentina',
    subdomain: 'sanpedro',
    status: 'active',
    plan: 'founder',
    brand: { primaryColor: '#ea580c', accentColor: '#c2410c' },
  })
}

export async function seedIfEmpty(): Promise<void> {
  // El seed automático está desactivado por default. Para reactivarlo,
  // setear `SEED_DEMO_DATA=true` en el .env.
  if (process.env.SEED_DEMO_DATA !== 'true') {
    console.log('[seed] desactivado (set SEED_DEMO_DATA=true para reactivar)')
    // Igual aseguramos que exista la App sanpedro para que el sistema
    // multi-tenant tenga un tenant default funcional desde el primer boot.
    await ensureSanpedroApp().catch((err) =>
      console.warn('[seed] no se pudo asegurar App sanpedro:', err?.message),
    )
    return
  }
  const merchantCount = await Merchant.countDocuments()
  if (merchantCount > 0) {
    console.log(`[seed] skipped — ${merchantCount} merchants ya existen`)
    await ensureSanpedroApp()
    return
  }

  console.log('[seed] DB vacía, sembrando datos demo en App sanpedro…')
  const app = await ensureSanpedroApp()
  const appId = app._id

  const slugToId = new Map<string, string>()
  for (const m of SEED_MERCHANTS) {
    const doc = await Merchant.create({
      appId,
      slug: m.slug,
      nombre: m.nombre,
      categoria: m.categoria,
      direccion: m.direccion,
      location: { type: 'Point', coordinates: [m.coords.lng, m.coords.lat] },
      telefono: m.telefono,
      horarios: m.horarios,
      cover: m.cover,
      logoSeed: m.logoSeed,
      destacado: m.destacado ?? false,
      foundingMember: true,
      nivel: 'standard',
      estado: 'activo',
    })
    slugToId.set(m.slug, doc._id.toString())
  }
  console.log(`[seed] ${SEED_MERCHANTS.length} merchants creados`)

  for (const c of SEED_COUPONS) {
    const merchantId = slugToId.get(c.merchantSlug)
    if (!merchantId) continue
    await Coupon.create({
      appId,
      merchantId,
      titulo: c.titulo,
      descripcion: c.descripcion,
      condiciones: c.condiciones,
      porcentaje: c.porcentaje,
      vigenciaHasta: inDays(c.diasOffset),
      diasAplica: c.diasAplica,
      estado: 'activo',
    })
  }
  console.log(`[seed] ${SEED_COUPONS.length} cupones creados`)

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  for (const u of SEED_MERCHANT_USERS) {
    const merchantId = slugToId.get(u.merchantSlug)
    if (!merchantId) continue
    await MerchantUser.create({
      appId,
      merchantId,
      email: u.email,
      passwordHash,
      nombre: u.nombre,
      rol: u.rol,
    })
  }
  console.log(`[seed] ${SEED_MERCHANT_USERS.length} merchant users creados (password: ${DEMO_PASSWORD})`)
  console.log('[seed] OK')
}
