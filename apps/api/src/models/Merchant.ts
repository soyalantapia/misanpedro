import { Schema, model, Types, type InferSchemaType } from 'mongoose'
import type { Categoria } from '@misanpedro/shared'

const horarioDiaSchema = new Schema(
  {
    abierto: { type: Boolean, required: true },
    desde: { type: String }, // HH:MM
    hasta: { type: String },
  },
  { _id: false },
)

const merchantSchema = new Schema(
  {
    /** Tenant: cada comercio pertenece a UNA App (ciudad). */
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },

    slug: { type: String, required: true },
    nombre: { type: String, required: true },
    categoria: {
      type: String,
      enum: [
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
      ],
      required: true,
    },
    /** Si categoria === 'otro', el comercio especifica acá su rubro real. */
    categoriaOtro: { type: String, maxlength: 60 },
    direccion: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    telefono: { type: String, required: true },
    /** Horarios libres en texto. Opcional al signup; se completa en el panel. */
    horarios: { type: String, default: '' },
    horariosDetalle: {
      lun: horarioDiaSchema,
      mar: horarioDiaSchema,
      mie: horarioDiaSchema,
      jue: horarioDiaSchema,
      vie: horarioDiaSchema,
      sab: horarioDiaSchema,
      dom: horarioDiaSchema,
    },
    cover: { type: String },
    coverImageUrl: { type: String },
    /** URL del logo subido por el comercio (PNG/JPG cuadrado). */
    logoUrl: { type: String },
    mapsUrl: { type: String },
    // ─── Micro-sitio (ficha pública como carta de presentación) ─────────
    /** Frase corta del hero. */
    tagline: { type: String },
    /** Descripción / "sobre el comercio". */
    descripcion: { type: String },
    /** Servicios/comodidades destacadas (ids de SERVICIO_IDS en shared). */
    servicios: { type: [String], default: [] },
    /** Galería de fotos (data URLs base64 o URLs). Máx 4 hasta migrar a CDN. */
    galeria: { type: [String], default: [] },
    /** Carta / productos destacados (nombre + precio + descripción). */
    productos: {
      type: [
        new Schema(
          { nombre: String, precio: String, descripcion: String },
          { _id: false },
        ),
      ],
      default: [],
    },
    /** Redes y contacto extra. instagram/whatsapp como texto libre. */
    redes: {
      instagram: { type: String },
      facebook: { type: String },
      web: { type: String },
      whatsapp: { type: String },
    },
    logoSeed: { type: String },
    destacado: { type: Boolean, default: false },
    foundingMember: { type: Boolean, default: false },
    nivel: { type: String, enum: ['standard', 'premium'], default: 'standard' },
    estado: {
      type: String,
      enum: ['pending_payment', 'activo', 'suspendido', 'cancelado'],
      default: 'activo',
    },
    /**
     * Cuándo un HUMANO (el owner) fijó el estado a mano. Mientras esté seteado,
     * el reconciliador automático de suscripciones no lo toca.
     *
     * Existe porque el estado tiene dos escritores: el owner desde el panel y el
     * sweep de expiración. Sin distinguirlos, el owner reactivaba un comercio
     * —porque pagó por transferencia, por ejemplo— y diez minutos después el
     * sweep lo volvía a suspender en silencio. Cuando una persona decide, la
     * automatización no la pisa. [cazabug loop2]
     */
    estadoManualAt: { type: Date },
    /** Qué owner lo decidió (para poder preguntarle). */
    estadoManualPor: { type: Types.ObjectId, ref: 'Owner' },
    // ─── Datos fiscales (para facturar la suscripción) ──────────────────
    razonSocial: { type: String },
    cuit: { type: String, index: true },
    /** 'monotributo' | 'responsable_inscripto' | 'consumidor_final' */
    condicionFiscal: { type: String },
    direccionFiscal: { type: String },
    // ─── Notas internas + customizaciones ───────────────────────────────
    /** Notas privadas del comercio sobre operación (no se muestran al vecino). */
    notasInternas: { type: String },
    aceptedTcAt: { type: Date },
    /** Día de aceptación del derecho de arrepentimiento (defensa al consumidor). */
    arrepentimientoExpiraEn: { type: Date },
    arrepentido: { type: Boolean, default: false },
    /**
     * Fin de los 3 meses gratis (informativo). El comercio nace `activo` y
     * gratis al registrarse — no se cobra ni se corta nada al vencer (por ahora
     * el trial es indefinido en la práctica). Sirve para mostrar "gratis hasta X".
     */
    freeTrialUntil: { type: Date },
    // ─── Programa de referidos ──────────────────────────────────────────
    /** Código de referido propio (único por tenant). Se genera al signup / lazy. */
    referralCode: { type: String },
    /** Código con el que ESTE comercio fue referido (crudo, para auditoría). */
    referredByCode: { type: String },
    /** Comercio que lo refirió (resuelto: mismo appId, no self). */
    referredByMerchantId: { type: Types.ObjectId, ref: 'Merchant' },
    /** Semanas gratis ya acreditadas por referir (el tope se aplica en la lógica). */
    referralWeeksEarned: { type: Number, default: 0 },
    /** Fecha del primer cupón activo — hace idempotente el trigger del referido. */
    firstCouponAt: { type: Date },
    /** Fecha en que ESTE comercio, como referido, cobró su premio de días gratis. One-time. */
    referredRewardGrantedAt: { type: Date },
  },
  { timestamps: true },
)

// Compound uniques scoped al tenant
merchantSchema.index({ appId: 1, slug: 1 }, { unique: true })
merchantSchema.index({ appId: 1, referralCode: 1 }, { unique: true, sparse: true })
merchantSchema.index({ location: '2dsphere' })

export type MerchantDoc = InferSchemaType<typeof merchantSchema> & {
  _id: string
  categoria: Categoria
}
export const Merchant = model('Merchant', merchantSchema)
