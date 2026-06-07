// Tipos de dominio compartidos entre frontend y backend.
// Cualquier cambio acá impacta a ambos lados.

export type Categoria =
  | 'gastronomia'
  | 'cafeteria'
  | 'panaderia'
  | 'supermercado'
  | 'kiosco'
  | 'indumentaria'
  | 'calzado'
  | 'belleza'
  | 'salud'
  | 'farmacia'
  | 'hogar'
  | 'libreria'
  | 'ferreteria'
  | 'tecnologia'
  | 'mascotas'
  | 'deporte'
  | 'servicios'
  | 'otro'

export const CATEGORIAS: { id: Categoria; label: string }[] = [
  { id: 'gastronomia', label: 'Gastronomía' },
  { id: 'cafeteria', label: 'Cafetería' },
  { id: 'panaderia', label: 'Panadería' },
  { id: 'supermercado', label: 'Supermercado / Almacén' },
  { id: 'kiosco', label: 'Kiosco' },
  { id: 'indumentaria', label: 'Indumentaria' },
  { id: 'calzado', label: 'Calzado' },
  { id: 'belleza', label: 'Belleza' },
  { id: 'salud', label: 'Salud' },
  { id: 'farmacia', label: 'Farmacia' },
  { id: 'hogar', label: 'Hogar y deco' },
  { id: 'libreria', label: 'Librería' },
  { id: 'ferreteria', label: 'Ferretería' },
  { id: 'tecnologia', label: 'Tecnología' },
  { id: 'mascotas', label: 'Mascotas' },
  { id: 'deporte', label: 'Deporte' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'otro', label: 'Otro · completar' },
]

export type DiaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom'

export const DIAS_SEMANA: { id: DiaSemana; label: string; corto: string }[] = [
  { id: 'lun', label: 'Lunes', corto: 'Lun' },
  { id: 'mar', label: 'Martes', corto: 'Mar' },
  { id: 'mie', label: 'Miércoles', corto: 'Mié' },
  { id: 'jue', label: 'Jueves', corto: 'Jue' },
  { id: 'vie', label: 'Viernes', corto: 'Vie' },
  { id: 'sab', label: 'Sábado', corto: 'Sáb' },
  { id: 'dom', label: 'Domingo', corto: 'Dom' },
]

export type HorarioDia =
  | { abierto: false }
  | { abierto: true; desde: string; hasta: string }

export type HorariosSemana = Record<DiaSemana, HorarioDia>

export type Merchant = {
  id: string
  nombre: string
  categoria: Categoria
  direccion: string
  lat: number
  lng: number
  telefono: string
  horarios: string
  horariosDetalle?: HorariosSemana
  cover: string
  coverImageUrl?: string
  mapsUrl?: string
  logoSeed: string
  destacado?: boolean
}

export type CouponEstado = 'activo' | 'pausado' | 'agotado' | 'vencido'

/** Objetivo comercial del cupón. Guía al asesor; es PRIVADO (no se muestra al vecino). */
export type CuponObjetivo = 'traer_nuevos' | 'llenar_flojos' | 'vaciar_stock' | 'fidelizar'

/** Tipo de oferta. La cuponera arranca en 'porcentaje'. */
export type TipoOferta = 'porcentaje' | 'dos_por_uno' | 'precio_fijo' | 'happy_hour'

export type Coupon = {
  id: string
  merchantId: string
  titulo: string
  descripcion: string
  condiciones: string
  porcentaje: number
  /** Precio normal aproximado por persona (ARS, opcional). */
  precioReferencia?: number
  vigenciaHasta: string
  imagenSeed: string
  estado: CouponEstado
  diasAplica?: string
  // ─── Asesor de cupones (todos opcionales, backward-compatible) ───────
  /** Costo aprox del comercio (PRIVADO — nunca se serializa al vecino). */
  costoReferencia?: number
  /** Objetivo comercial (PRIVADO). */
  objetivo?: CuponObjetivo
  /** Tipo de oferta (default 'porcentaje'). */
  tipoOferta?: TipoOferta
  /** Exclusivo de la app (no se consigue en la puerta). */
  exclusiva?: boolean
  /** Días en que aplica (estructurado). `diasAplica` queda para display/compat. */
  dias?: DiaSemana[]
  /** Franja horaria (HH:MM). */
  franjaDesde?: string
  franjaHasta?: string
  /** Producto estrella / gancho (para el copy). */
  productoGancho?: string
}

export type ActivationStatus = 'activo' | 'canjeado' | 'expirado' | 'cancelado'

export type Activation = {
  id: string
  couponId: string
  userId: string
  codigoNumerico: string
  qrPayload: string
  activatedAt: string
  expiresAt: string
  status: ActivationStatus
  redeemedAt?: string
  ahorroEstimado?: number
}

export type MerchantUserRol = 'admin' | 'cajero'

export type MerchantUserPublic = {
  id: string
  merchantId: string
  email: string
  nombre: string
  rol: MerchantUserRol
}

export type MerchantSession = {
  userId: string
  merchantId: string
  loggedAt: string
}

export type User = {
  id: string
  nombre: string
  /** El teléfono ES la identidad del vecino (onboarding sin fricción). */
  telefono: string
  // ─── Legacy / opcionales (ya no se piden en el alta) ───
  dni?: string
  email?: string
  whatsapp?: string
  fechaNacimiento?: string
  acceptedTcAt?: string
  createdAt?: string
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}
