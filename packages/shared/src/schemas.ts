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
  'otro',
])

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

// ─── Auth comercio ────────────────────────────────────────────────────

export const merchantLoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(3, 'Mínimo 3 caracteres'),
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
    password: z.string().min(3),
  }),
  /** El comercio debe aceptar TyC + Privacidad explícitamente. */
  acceptedTc: z.literal(true, {
    error: 'Tenés que aceptar los términos y condiciones',
  }),
})

// ─── Cupones ──────────────────────────────────────────────────────────

export const couponCreateSchema = z.object({
  titulo: z.string().min(8, 'Mínimo 8 caracteres').max(60),
  descripcion: z.string().min(20, 'Mínimo 20 caracteres').max(280),
  condiciones: z.string().max(280).optional().default(''),
  porcentaje: z
    .number()
    .int()
    .refine((n) => [5, 10, 15, 20, 25, 30, 40, 50].includes(n), {
      message: 'Porcentaje inválido',
    }),
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
  montoTicket: z.number().positive('El monto del ticket es obligatorio'),
})

// ─── Merchant edit ────────────────────────────────────────────────────

export const merchantUpdateSchema = z.object({
  nombre: z.string().min(3).max(80).optional(),
  categoria: categoriaSchema.optional(),
  categoriaOtro: z.string().max(60).optional().nullable(),
  direccion: z.string().min(5).max(160).optional(),
  telefono: phoneSchema.optional(),
  horarios: z.string().max(500).optional(),
  horariosDetalle: horariosSemanaSchema.optional(),
  coverImageUrl: safeImageSrcSchema.optional().nullable(),
  logoUrl: safeImageSrcSchema.optional().nullable(),
  mapsUrl: safeHrefUrlSchema.optional().nullable(),
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
export type OtpRequestInput = z.infer<typeof otpRequestSchema>
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>
export type MerchantLoginInput = z.infer<typeof merchantLoginSchema>
export type MerchantSignupInput = z.infer<typeof merchantSignupSchema>
export type CouponCreateInput = z.infer<typeof couponCreateSchema>
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>
export type ActivateCouponInput = z.infer<typeof activateCouponSchema>
export type RedeemByCodeInput = z.infer<typeof redeemByCodeSchema>
export type RedeemByPayloadInput = z.infer<typeof redeemByPayloadSchema>
export type ConfirmRedemptionInput = z.infer<typeof confirmRedemptionSchema>
export type MerchantUpdateInput = z.infer<typeof merchantUpdateSchema>
