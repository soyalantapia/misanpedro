import { z } from 'zod'

// Schemas de validación reusables. Se importan tanto desde el frontend
// (formularios) como desde el backend (endpoints) — single source of truth.

export const categoriaSchema = z.enum([
  'gastronomia',
  'cafeteria',
  'panaderia',
  'supermercado',
  'kiosco',
  'indumentaria',
  'calzado',
  'belleza',
  'salud',
  'farmacia',
  'hogar',
  'libreria',
  'ferreteria',
  'tecnologia',
  'mascotas',
  'deporte',
  'servicios',
  'inmobiliaria',
  'otro',
])

/**
 * Servicios/comodidades que el comercio puede destacar en su ficha pública
 * (micro-sitio). Los ids son canónicos; las etiquetas legibles viven en el
 * frontend (SERVICIOS en apps/web/src/lib/types.ts) — mismo patrón que las
 * categorías. Sirven para mostrar chips en la ficha y, a futuro, para filtrar.
 */
export const SERVICIO_IDS = [
  'delivery',
  'retira',
  'tarjeta',
  'mercadopago',
  'wifi',
  'estacionamiento',
  'accesible',
  'pet_friendly',
  'aire',
  'reservas',
] as const

export const servicioSchema = z.enum(SERVICIO_IDS)

export const diaSemanaSchema = z.enum(['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'])

export const horarioDiaSchema = z.discriminatedUnion('abierto', [
  z.object({ abierto: z.literal(false) }),
  z.object({
    abierto: z.literal(true),
    desde: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
    hasta: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  }),
])

export const horariosSemanaSchema = z.record(diaSemanaSchema, horarioDiaSchema)

// ─── Auth vecino ─────────────────────────────────────────────────────

export const userRegisterSchema = z.object({
  dni: z
    .string()
    .regex(/^\d{7,8}$/, 'DNI: 7 u 8 dígitos sin puntos'),
  nombre: z.string().min(3, 'Mínimo 3 caracteres').max(80, 'Máximo 80 caracteres'),
  email: z.string().email('Email inválido').toLowerCase(),
  whatsapp: z.string().min(10, 'Número con código de área'),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  acceptedTc: z.literal(true, {
    error: 'Necesitamos que aceptes los términos',
  }),
})

export const otpRequestSchema = z.object({
  email: z.string().email().optional(),
  whatsapp: z.string().min(10).optional(),
}).refine((data) => data.email || data.whatsapp, {
  message: 'Email o WhatsApp requerido',
})

export const otpVerifySchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().regex(/^\d{6}$/, 'Código de 6 dígitos'),
})

// ─── Onboarding sin fricción (vecino): claim por teléfono ───────────────

/** Normaliza un teléfono argentino a su forma canónica (solo dígitos, sin
 *  código de país 54, sin prefijo móvil 9, sin trunk 0) para que el match sea
 *  consistente entre dispositivos: "+54 9 3329 555444" y "3329 555444" caen
 *  al mismo valor. El teléfono ES la identidad del vecino. */
export function normalizeTelefono(raw: string): string {
  let d = (raw || '').replace(/\D/g, '')
  if (d.startsWith('54')) d = d.slice(2) // país
  if (d.startsWith('9')) d = d.slice(1) // móvil
  if (d.startsWith('0')) d = d.slice(1) // trunk
  return d
}

/** Captura LIVIANA al primer canje: nombre + teléfono + T&C. SIN OTP ni email.
 *  La verificación la hace el cajero en persona (compra presencial). */
export const userClaimSchema = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  telefono: z
    .string()
    .transform((s) => normalizeTelefono(s))
    .pipe(z.string().regex(/^\d{8,13}$/, 'Poné tu celular con código de área')),
  acceptedTc: z.literal(true, { error: 'Necesitamos que aceptes los términos' }),
})

// ─── Auth comercio ────────────────────────────────────────────────────

export const merchantLoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(3, 'Mínimo 3 caracteres'),
})

// ─── Login OTP del comercio (passwordless) ────────────────────────────
// El comercio entra con un código de 6 dígitos al email (igual que el vecino),
// sin contraseña. `purpose: 'merchant'` separa estos OTP de los del vecino.
export const merchantOtpRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
})

export const merchantOtpVerifySchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().regex(/^\d{6}$/, 'Código de 6 dígitos'),
})

/**
 * URL para usar en <a href=...> — sólo esquemas seguros que el browser
 * NO ejecuta como código. Bloquea `javascript:`, `data:` (cuando va a
 * href puede ser HTML), `vbscript:`, etc.
 */
const safeHrefUrlSchema = z
  .string()
  .refine(
    (u) => /^(https?|geo|mailto|tel):/i.test(u.trim()),
    { message: 'URL inválida (solo se permite http://, https://, geo:, mailto:, tel:)' },
  )

/**
 * URL para usar en <img src=...>. Permite http/https y data:image/* (porque
 * el browser sólo decodifica esos como imagen, no ejecuta JS). Bloquea data:
 * con MIME peligroso como text/html y los esquemas javascript:, vbscript:.
 */
const safeImageSrcSchema = z
  .string()
  .refine(
    (u) => /^(https?:|data:image\/(png|jpe?g|gif|webp|svg\+xml);)/i.test(u.trim()),
    { message: 'URL de imagen inválida (solo http/https o data:image/*)' },
  )

/**
 * Teléfono: dígitos, espacios, guiones, paréntesis, +. No permitimos HTML
 * ni caracteres especiales para evitar inyección si el frontend renderea
 * el campo sin escape (defensa en profundidad — React escapa por default).
 */
const phoneSchema = z
  .string()
  .min(6)
  .max(40)
  .regex(/^[\d\s\-+()\.]+$/, 'Teléfono solo puede tener dígitos, espacios, guiones, paréntesis y +')

export const merchantSignupSchema = z.object({
  comercio: z.object({
    nombre: z.string().min(3),
    categoria: categoriaSchema,
    /** Si categoria === 'otro', acá va el rubro real (free text). */
    categoriaOtro: z.string().max(60).optional(),
    direccion: z.string().min(5).max(160),
    /**
     * Coordenadas reales del comercio (las marca en un mapa al registrarse).
     * Opcionales: si no vienen, el backend cae al centro del tenant. El
     * frontend las exige para que cada comercio caiga en su punto real y no
     * todos apilados en el centro de la ciudad.
     */
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    telefono: phoneSchema,
    /** Horarios ahora es OPCIONAL — se completa después en el panel. */
    horarios: z.string().optional().default(''),
    /**
     * CUIT como texto libre (sin regex). El comercio lo carga como pueda;
     * lo normalizamos en backoffice cuando facturamos.
     */
    cuit: z.string().optional(),
    razonSocial: z.string().min(3).optional(),
    condicionFiscal: z
      .enum(['monotributo', 'responsable_inscripto', 'consumidor_final'])
      .optional(),
    direccionFiscal: z.string().min(5).optional(),
  }),
  admin: z.object({
    nombre: z.string().min(3),
    email: z.string().email().toLowerCase(),
    // OTP-only: el alta ya no exige contraseña. Se mantiene opcional por
    // compatibilidad con clientes viejos que todavía la manden (se ignora).
    password: z.string().min(8, 'Mínimo 8 caracteres').optional(),
  }),
  /** Código de referido (opcional): el comercio que invitó a este. */
  ref: z.string().trim().max(40).optional(),
  /** El comercio debe aceptar TyC + Privacidad explícitamente. */
  acceptedTc: z.literal(true, {
    error: 'Tenés que aceptar los términos y condiciones',
  }),
})

// ─── Cupones ──────────────────────────────────────────────────────────

/**
 * Texto plano sin HTML. Bloquea `<` y `>` para evitar inyección de tags
 * en campos que el frontend renderea. Defensa en profundidad — React
 * escapa text nodes, pero igual no aceptamos basura en la DB.
 */
const plainTextSchema = (min: number, max: number, label: string) =>
  z
    .string()
    .min(min, `Mínimo ${min} caracteres`)
    .max(max)
    .refine((s) => !/[<>]/.test(s), {
      message: `${label} no puede contener < ni >`,
    })

export const couponCreateSchema = z.object({
  titulo: plainTextSchema(8, 60, 'Título'),
  descripcion: plainTextSchema(20, 280, 'Descripción'),
  condiciones: plainTextSchema(0, 280, 'Condiciones').optional().default(''),
  // Antes era una lista fija [5,10,15,20,25,30,40,50] — pero el form ya dejaba
  // tipear % libres y el slider del asesor necesita continuo. Relajado a entero
  // 1–100 (los valores viejos quedan dentro del rango → backward-compatible).
  porcentaje: z.number().int().min(1, 'Mínimo 1%').max(100, 'Máximo 100%'),
  vigenciaHasta: z
    .string()
    .refine(
      (s) => {
        const d = new Date(s)
        return !isNaN(d.getTime()) && d.getTime() > Date.now()
      },
      { message: 'La vigencia tiene que ser una fecha futura' },
    ),
  diasAplica: z.string().max(80).optional(),
  /** Precio normal aproximado por persona (ARS). Opcional — alimenta el
   *  planificador del vecino. */
  precioReferencia: z.number().positive().optional(),
  /** Precio FINAL con el cupón (ARS) — solo para tipoOferta 'precio_fijo'. Público. */
  precioFijo: z.number().positive().nullable().optional(),
  /** Imagen del cupón (data:image/* base64 o URL http/https). Se muestra en la
   *  tarjeta que ve el vecino. Opcional. */
  imagenUrl: safeImageSrcSchema.optional().nullable(),
  // ─── Asesor de cupones (todos opcionales, backward-compatible) ───────
  // `.nullable()`: enviar null en un PATCH = LIMPIAR el campo (volverlo a vacío).
  // `undefined`/omitido = no tocar. Permite "deshacer" un opcional al editar.
  /** Costo aprox del comercio (PRIVADO — el backend nunca lo devuelve al vecino). */
  costoReferencia: z.number().positive().nullable().optional(),
  /** Objetivo comercial (guía al asesor; PRIVADO). */
  objetivo: z.enum(['traer_nuevos', 'llenar_flojos', 'vaciar_stock', 'fidelizar']).nullable().optional(),
  /** Tipo de oferta. */
  tipoOferta: z.enum(['porcentaje', 'dos_por_uno', 'precio_fijo', 'happy_hour']).optional(),
  /** Exclusivo de la app. */
  exclusiva: z.boolean().optional(),
  /** Días estructurados (además del string diasAplica para display). */
  dias: z.array(diaSemanaSchema).max(7).nullable().optional(),
  /** Franja horaria HH:MM (00:00–23:59). */
  franjaDesde: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora válida HH:MM').nullable().optional(),
  franjaHasta: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora válida HH:MM').nullable().optional(),
  /** Producto estrella / gancho (sobre qué aplica). */
  productoGancho: z.string().max(60).nullable().optional(),
  /** Alcance: 'puntual' (un producto) | 'categoria' (varios). Para %/happy_hour. */
  alcance: z.enum(['puntual', 'categoria']).optional(),
  /** Mostrar el ahorro en pesos al vecino (default true). Si false → solo el %. */
  mostrarAhorroVecino: z.boolean().optional(),
  // ─── Límite de uso por persona ───────────────────────────────────────
  /** Cuántas veces puede usarlo cada persona dentro de la ventana. Default 1. */
  usoMaxPorPersona: z.number().int().min(1, 'Mínimo 1').max(99, 'Máximo 99').optional().default(1),
  /** Ventana del límite. Default 'devida' (una vez en el historial). */
  usoVentana: z
    .enum(['devida', 'semana', 'quincena', 'mes', 'ilimitado'])
    .optional()
    .default('devida'),
  estado: z.enum(['activo', 'pausado']).default('activo'),
})

export const couponUpdateSchema = couponCreateSchema.partial()

// ─── Activación / canje ───────────────────────────────────────────────

export const activateCouponSchema = z.object({
  couponId: z.string(),
})

export const redeemByCodeSchema = z.object({
  // Normalizamos antes de validar: el UI muestra el código formateado "123 456"
  // pero el regex pide 6 dígitos pelados. Stripeamos cualquier whitespace
  // (espacios, guiones, etc.) para que copy-paste y typos suaves no rompan
  // la validación del cajero.
  codigoNumerico: z
    .string()
    .transform((s) => s.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, 'Código de 6 dígitos')),
})

export const redeemByPayloadSchema = z.object({
  qrPayload: z.string(),
})

export const confirmRedemptionSchema = z.object({
  activationId: z.string(),
  // montoTicket es OBLIGATORIO: si el cajero confirma sin meter el monto,
  // las stats del comercio quedan contaminadas (canje cuenta pero ahorro
  // e ingresos=0). Mejor forzar a que lo ingrese — son 2 segundos extras
  // de typing y la data del comercio queda limpia.
  // Tope máximo $10M: el frontend ya lo valida (AdminConfirmarCanjePage), pero
  // el backend es la fuente de verdad — sin este .max() un request directo al
  // API (o un typo de ceros) registra montos absurdos que inflan las métricas
  // del comercio (ingresos/ahorro). Audit v11: encontrado probando $999.999.999.
  montoTicket: z
    .number()
    .positive('El monto del ticket es obligatorio')
    .max(10_000_000, 'El monto parece demasiado alto — revisalo'),
})

// ─── Merchant edit ────────────────────────────────────────────────────

/** Producto/ítem destacado de la carta del comercio (micro-sitio). */
export const productoSchema = z.object({
  nombre: plainTextSchema(1, 60, 'Nombre del producto'),
  /** Precio como texto libre ("$3.500", "desde $2.000", "2x1"). */
  precio: plainTextSchema(0, 24, 'Precio').optional().nullable(),
  descripcion: plainTextSchema(0, 140, 'Descripción').optional().nullable(),
})

export const merchantUpdateSchema = z.object({
  nombre: z.string().min(3).max(80).optional(),
  categoria: categoriaSchema.optional(),
  categoriaOtro: z.string().max(60).optional().nullable(),
  direccion: z.string().min(5).max(160).optional(),
  /**
   * Coordenadas reales del comercio. Permiten corregir el pin DESPUÉS del alta
   * (el comercio movió de local, o quedó en el placeholder del centro). Mismo
   * rango que merchantSignupSchema; el backend sólo toca location si vienen.
   */
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  telefono: phoneSchema.optional(),
  horarios: z.string().max(500).optional(),
  horariosDetalle: horariosSemanaSchema.optional(),
  coverImageUrl: safeImageSrcSchema.optional().nullable(),
  logoUrl: safeImageSrcSchema.optional().nullable(),
  mapsUrl: safeHrefUrlSchema.optional().nullable(),
  // ─── Micro-sitio: la ficha del vecino como "carta de presentación" ──────
  /** Frase corta del hero (ej: "Pizzería a la piedra desde 1998"). */
  tagline: plainTextSchema(0, 90, 'Frase').optional().nullable(),
  /** Texto "Sobre el comercio" (historia, qué ofrece). */
  descripcion: plainTextSchema(0, 600, 'Descripción').optional().nullable(),
  /** Servicios/comodidades destacadas (chips en la ficha). */
  servicios: z.array(servicioSchema).max(SERVICIO_IDS.length).optional(),
  /**
   * Redes y contacto extra. instagram/whatsapp se guardan como texto libre
   * (handle o número) y el frontend construye un href seguro; facebook/web
   * deben ser URLs http(s) válidas.
   */
  redes: z
    .object({
      instagram: z.string().trim().max(120).optional().nullable(),
      facebook: safeHrefUrlSchema.optional().nullable(),
      web: safeHrefUrlSchema.optional().nullable(),
      whatsapp: z.string().trim().max(40).optional().nullable(),
    })
    .partial()
    .optional()
    .nullable(),
  /**
   * Galería de fotos del comercio (data URLs base64 o URLs http). Tope chico
   * (4) porque por ahora viajan en base64 en el body; migrar a CDN para subir
   * el límite (ver TODO BD01 en AdminComercioPage).
   */
  galeria: z.array(safeImageSrcSchema).max(4).optional(),
  /** Carta / productos destacados (nombre + precio + descripción). */
  productos: z.array(productoSchema).max(20).optional(),
  cuit: z.string().optional().nullable(),
  razonSocial: z.string().min(3).optional().nullable(),
  condicionFiscal: z
    .enum(['monotributo', 'responsable_inscripto', 'consumidor_final'])
    .optional()
    .nullable(),
  direccionFiscal: z.string().min(5).optional().nullable(),
  notasInternas: z.string().max(2000).optional().nullable(),
})

// ─── Tipos derivados ──────────────────────────────────────────────────

export type UserRegisterInput = z.infer<typeof userRegisterSchema>
export type UserClaimInput = z.infer<typeof userClaimSchema>
export type OtpRequestInput = z.infer<typeof otpRequestSchema>
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>
export type MerchantLoginInput = z.infer<typeof merchantLoginSchema>
export type MerchantOtpRequestInput = z.infer<typeof merchantOtpRequestSchema>
export type MerchantOtpVerifyInput = z.infer<typeof merchantOtpVerifySchema>
export type MerchantSignupInput = z.infer<typeof merchantSignupSchema>
export type CouponCreateInput = z.infer<typeof couponCreateSchema>
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>
export type ActivateCouponInput = z.infer<typeof activateCouponSchema>
export type RedeemByCodeInput = z.infer<typeof redeemByCodeSchema>
export type RedeemByPayloadInput = z.infer<typeof redeemByPayloadSchema>
export type ConfirmRedemptionInput = z.infer<typeof confirmRedemptionSchema>
export type MerchantUpdateInput = z.infer<typeof merchantUpdateSchema>
export type Servicio = z.infer<typeof servicioSchema>
export type Producto = z.infer<typeof productoSchema>
