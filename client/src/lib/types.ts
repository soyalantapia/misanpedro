export type Categoria =
  | 'gastronomia'
  | 'indumentaria'
  | 'salud'
  | 'belleza'
  | 'servicios'
  | 'hogar'

export const CATEGORIAS: { id: Categoria; label: string }[] = [
  { id: 'gastronomia', label: 'Gastronomía' },
  { id: 'indumentaria', label: 'Indumentaria' },
  { id: 'salud', label: 'Salud' },
  { id: 'belleza', label: 'Belleza' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'hogar', label: 'Hogar' },
]

export type Merchant = {
  id: string
  nombre: string
  categoria: Categoria
  direccion: string
  lat: number
  lng: number
  telefono: string
  horarios: string
  cover: string
  logoSeed: string
  destacado?: boolean
}

export type CouponEstado = 'activo' | 'pausado' | 'agotado' | 'vencido'

export type Coupon = {
  id: string
  merchantId: string
  titulo: string
  descripcion: string
  condiciones: string
  porcentaje: number
  vigenciaHasta: string
  imagenSeed: string
  estado: CouponEstado
  diasAplica?: string
}

export type ActivationStatus = 'activo' | 'canjeado' | 'expirado' | 'cancelado'

export type Activation = {
  id: string
  couponId: string
  codigoNumerico: string
  qrPayload: string
  activatedAt: string
  expiresAt: string
  status: ActivationStatus
  redeemedAt?: string
  ahorroEstimado?: number
}

export type MerchantUser = {
  id: string
  merchantId: string
  email: string
  password: string
  nombre: string
  rol: 'admin' | 'cajero'
}

export type MerchantSession = {
  userId: string
  merchantId: string
  loggedAt: string
}

export type User = {
  id: string
  nombre: string
  dni: string
  email: string
  whatsapp: string
  fechaNacimiento: string
  acceptedTcAt: string
  createdAt: string
}
