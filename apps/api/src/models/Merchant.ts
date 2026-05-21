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
    logoSeed: { type: String },
    destacado: { type: Boolean, default: false },
    foundingMember: { type: Boolean, default: false },
    nivel: { type: String, enum: ['standard', 'premium'], default: 'standard' },
    estado: {
      type: String,
      enum: ['pending_payment', 'activo', 'suspendido', 'cancelado'],
      default: 'activo',
    },
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
  },
  { timestamps: true },
)

// Compound uniques scoped al tenant
merchantSchema.index({ appId: 1, slug: 1 }, { unique: true })
merchantSchema.index({ location: '2dsphere' })

export type MerchantDoc = InferSchemaType<typeof merchantSchema> & {
  _id: string
  categoria: Categoria
}
export const Merchant = model('Merchant', merchantSchema)
