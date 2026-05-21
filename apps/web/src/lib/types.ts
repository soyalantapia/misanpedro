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
  /** Horarios detallados por día (si está, reemplaza al string `horarios`) */
  horariosDetalle?: HorariosSemana
  cover?: string
  /** URL o dataURL de imagen de portada custom (si está, reemplaza el gradient) */
  coverImageUrl?: string
  /** Link directo a Google Maps (si está, reemplaza la búsqueda generada) */
  mapsUrl?: string
  logoSeed?: string
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
  /** ID del User vecino que activó este cupón. */
  userId: string
  codigoNumerico: string
  qrPayload: string
  activatedAt: string
  /**
   * @deprecated Los códigos ya no expiran por tiempo. Campo legacy
   * mantenido por compatibilidad con activations viejas. Opcional para
   * que las nuevas no lo seteen.
   */
  expiresAt?: string
  status: ActivationStatus
  redeemedAt?: string
  ahorroEstimado?: number
  /** Monto del ticket que registró el cajero al confirmar el canje. */
  montoTicket?: number
}

export type Merchant_ = Merchant // re-export for type narrowing

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
