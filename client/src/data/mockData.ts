import type { Coupon, Merchant, MerchantUser } from '@/lib/types'

const SAN_PEDRO = { lat: -33.6797, lng: -59.6669 }

function offset(latDelta: number, lngDelta: number) {
  return { lat: SAN_PEDRO.lat + latDelta, lng: SAN_PEDRO.lng + lngDelta }
}

export const MERCHANTS: Merchant[] = [
  {
    id: 'la-esquina',
    nombre: 'La Esquina',
    categoria: 'gastronomia',
    direccion: 'Mitre 1247, San Pedro',
    ...offset(0.001, -0.0008),
    telefono: '(03329) 425-678',
    horarios: 'Mar a Dom · 19 a 24 hs',
    cover: 'la-esquina',
    logoSeed: 'LE',
    destacado: true,
  },
  {
    id: 'carmen-vintage',
    nombre: 'Carmen Vintage',
    categoria: 'indumentaria',
    direccion: 'Pellegrini 458, San Pedro',
    ...offset(-0.0012, 0.0006),
    telefono: '(03329) 422-901',
    horarios: 'Lun a Sáb · 10 a 13 y 17 a 20:30 hs',
    cover: 'carmen',
    logoSeed: 'CV',
  },
  {
    id: 'vivero-pampero',
    nombre: 'Vivero El Pampero',
    categoria: 'hogar',
    direccion: 'Av. 3 de Febrero 2104, San Pedro',
    ...offset(0.0034, 0.0021),
    telefono: '(03329) 428-110',
    horarios: 'Lun a Sáb · 9 a 13 y 16 a 19 hs',
    cover: 'pampero',
    logoSeed: 'VP',
  },
  {
    id: 'farmacia-centro',
    nombre: 'Farmacia del Centro',
    categoria: 'salud',
    direccion: 'Mitre 980, San Pedro',
    ...offset(0.0006, -0.0003),
    telefono: '(03329) 423-444',
    horarios: 'Todos los días · 8 a 22 hs',
    cover: 'farmacia',
    logoSeed: 'FC',
  },
  {
    id: 'almendra-belleza',
    nombre: 'Almendra Belleza',
    categoria: 'belleza',
    direccion: 'Pellegrini 712, San Pedro',
    ...offset(-0.0008, 0.0014),
    telefono: '(03329) 15-498-201',
    horarios: 'Mar a Sáb · 10 a 19 hs',
    cover: 'almendra',
    logoSeed: 'AB',
  },
  {
    id: 'estacion-25',
    nombre: 'Estación 25',
    categoria: 'gastronomia',
    direccion: 'Bv. 25 de Mayo 1402, San Pedro',
    ...offset(0.0021, -0.0017),
    telefono: '(03329) 426-700',
    horarios: 'Mar a Dom · 9 a 23 hs',
    cover: 'estacion',
    logoSeed: 'E25',
  },
  {
    id: 'servimax',
    nombre: 'Servimax',
    categoria: 'servicios',
    direccion: 'Belgrano 1518, San Pedro',
    ...offset(-0.0024, -0.0011),
    telefono: '(03329) 427-330',
    horarios: 'Lun a Vie · 8 a 18 hs',
    cover: 'servimax',
    logoSeed: 'SM',
  },
  {
    id: 'hogar-parana',
    nombre: 'Hogar Río Paraná',
    categoria: 'hogar',
    direccion: 'San Martín 220, San Pedro',
    ...offset(0.0042, 0.0008),
    telefono: '(03329) 424-820',
    horarios: 'Lun a Sáb · 9 a 13 y 15:30 a 20 hs',
    cover: 'parana',
    logoSeed: 'HP',
  },
]

const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

export const COUPONS: Coupon[] = [
  {
    id: 'c-esquina-pizza',
    merchantId: 'la-esquina',
    titulo: 'Pizzas martes y miércoles a la noche',
    descripcion:
      'Llevate tu pizza favorita con 20% de descuento todos los martes y miércoles después de las 20 hs. Aplicable a la carta completa, incluyendo las especiales de la casa.',
    condiciones:
      'Válido solo de 20 a 23 hs. No acumulable con otras promociones. Excluye bebidas alcohólicas.',
    porcentaje: 20,
    vigenciaHasta: inDays(45),
    imagenSeed: 'pizza',
    estado: 'activo',
    diasAplica: 'Martes y miércoles · 20 a 23 hs',
  },
  {
    id: 'c-esquina-pasta',
    merchantId: 'la-esquina',
    titulo: '15% en pastas caseras los jueves',
    descripcion:
      'Pastas caseras con 15% de descuento todos los jueves al mediodía y a la noche. Salsas incluidas.',
    condiciones: 'Válido todos los jueves. No acumulable con otras promociones.',
    porcentaje: 15,
    vigenciaHasta: inDays(45),
    imagenSeed: 'pasta',
    estado: 'activo',
    diasAplica: 'Jueves · todo el día',
  },
  {
    id: 'c-carmen-otono',
    merchantId: 'carmen-vintage',
    titulo: '25% en colección otoño/invierno',
    descripcion:
      'Toda la colección otoño/invierno con 25% de descuento. Tapados, camperas, sweaters y accesorios seleccionados.',
    condiciones: 'Hasta agotar stock. Sólo prendas marcadas con el sticker MSP.',
    porcentaje: 25,
    vigenciaHasta: inDays(28),
    imagenSeed: 'carmen-otono',
    estado: 'activo',
    diasAplica: 'Lun a Sáb · horario comercial',
  },
  {
    id: 'c-pampero-plantas',
    merchantId: 'vivero-pampero',
    titulo: '15% en plantas de interior y exterior',
    descripcion:
      'Plantas de interior y exterior, macetas y sustrato con 15% de descuento. Asesoramiento técnico incluido.',
    condiciones: 'No incluye herramientas ni insumos premium importados.',
    porcentaje: 15,
    vigenciaHasta: inDays(60),
    imagenSeed: 'plantas',
    estado: 'activo',
    diasAplica: 'Todos los días',
  },
  {
    id: 'c-farmacia-cuidado',
    merchantId: 'farmacia-centro',
    titulo: '10% en cuidado personal de marca propia',
    descripcion:
      'Línea completa de cuidado personal: cremas, jabones, champús y desodorantes de marca propia con 10% de descuento.',
    condiciones: 'Lunes a viernes hasta las 20 hs. No incluye medicamentos recetados.',
    porcentaje: 10,
    vigenciaHasta: inDays(90),
    imagenSeed: 'farmacia',
    estado: 'activo',
    diasAplica: 'Lun a Vie · hasta 20 hs',
  },
  {
    id: 'c-almendra-tratamiento',
    merchantId: 'almendra-belleza',
    titulo: '30% en tratamiento facial premium',
    descripcion:
      'Tratamiento facial premium de 60 minutos con 30% de descuento. Limpieza profunda, hidratación y masaje. Productos veganos.',
    condiciones: 'Solo con turno previo. Válido para clientes nuevos del mes.',
    porcentaje: 30,
    vigenciaHasta: inDays(35),
    imagenSeed: 'almendra',
    estado: 'activo',
    diasAplica: 'Mar a Sáb · con turno',
  },
  {
    id: 'c-almendra-corte',
    merchantId: 'almendra-belleza',
    titulo: '20% en corte + brushing',
    descripcion: 'Corte y peinado con 20% de descuento. Cepillo y producto de styling incluidos.',
    condiciones: 'Solo con turno previo. No acumulable con tratamientos de color.',
    porcentaje: 20,
    vigenciaHasta: inDays(35),
    imagenSeed: 'corte',
    estado: 'activo',
  },
  {
    id: 'c-estacion-brunch',
    merchantId: 'estacion-25',
    titulo: '20% en brunch de fin de semana',
    descripcion:
      'Brunch de sábado y domingo con 20% de descuento. Café o jugo + tostones + huevos al gusto + frutas + dulce.',
    condiciones: 'Sáb y Dom de 9:30 a 13 hs. Por persona, máximo 4 cubiertos por mesa.',
    porcentaje: 20,
    vigenciaHasta: inDays(50),
    imagenSeed: 'brunch',
    estado: 'activo',
    diasAplica: 'Sáb y Dom · 9:30 a 13 hs',
  },
  {
    id: 'c-servimax-cambio',
    merchantId: 'servimax',
    titulo: '15% en cambio de aceite y filtros',
    descripcion:
      'Cambio de aceite + filtro de aceite + revisión general gratuita con 15% de descuento. Aceite multigrade incluido.',
    condiciones: 'Sólo turnos lunes a jueves. Excluye marcas premium importadas.',
    porcentaje: 15,
    vigenciaHasta: inDays(60),
    imagenSeed: 'taller',
    estado: 'activo',
    diasAplica: 'Lun a Jue · con turno',
  },
  {
    id: 'c-parana-deco',
    merchantId: 'hogar-parana',
    titulo: '20% en línea de deco y textil',
    descripcion:
      'Cortinas, almohadones, alfombras y accesorios de decoración con 20% de descuento. Selección curada de productos nacionales.',
    condiciones: 'Hasta agotar stock. No acumulable con liquidaciones de temporada.',
    porcentaje: 20,
    vigenciaHasta: inDays(40),
    imagenSeed: 'deco',
    estado: 'activo',
  },
  {
    id: 'c-parana-iluminacion',
    merchantId: 'hogar-parana',
    titulo: '10% en iluminación LED',
    descripcion: 'Toda la línea de iluminación LED de bajo consumo con 10% de descuento.',
    condiciones: 'No acumulable con promociones de marca.',
    porcentaje: 10,
    vigenciaHasta: inDays(40),
    imagenSeed: 'iluminacion',
    estado: 'activo',
  },
]

export const MERCHANT_USERS: MerchantUser[] = [
  {
    id: 'mu-esquina-1',
    merchantId: 'la-esquina',
    email: 'cajero@laesquina.com',
    password: 'demo123',
    nombre: 'Mario Pizza',
    rol: 'admin',
  },
  {
    id: 'mu-carmen-1',
    merchantId: 'carmen-vintage',
    email: 'admin@carmenvintage.com',
    password: 'demo123',
    nombre: 'Carmen R.',
    rol: 'admin',
  },
  {
    id: 'mu-pampero-1',
    merchantId: 'vivero-pampero',
    email: 'jose@vivero-pampero.com',
    password: 'demo123',
    nombre: 'José',
    rol: 'admin',
  },
]

export function findMerchantUser(email: string, password: string): MerchantUser | undefined {
  const e = email.trim().toLowerCase()
  return MERCHANT_USERS.find((u) => u.email.toLowerCase() === e && u.password === password)
}

export function getMerchant(id: string): Merchant | undefined {
  return MERCHANTS.find((m) => m.id === id)
}

export function getCoupon(id: string): Coupon | undefined {
  return COUPONS.find((c) => c.id === id)
}

export function couponsByMerchant(merchantId: string): Coupon[] {
  return COUPONS.filter((c) => c.merchantId === merchantId && c.estado === 'activo')
}
