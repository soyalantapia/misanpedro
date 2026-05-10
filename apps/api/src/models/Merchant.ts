import { Schema, model, type InferSchemaType } from 'mongoose'
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
    slug: { type: String, required: true, unique: true, index: true },
    nombre: { type: String, required: true },
    categoria: {
      type: String,
      enum: ['gastronomia', 'indumentaria', 'salud', 'belleza', 'servicios', 'hogar'],
      required: true,
    },
    direccion: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    telefono: { type: String, required: true },
    horarios: { type: String, required: true },
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

merchantSchema.index({ location: '2dsphere' })

export type MerchantDoc = InferSchemaType<typeof merchantSchema> & {
  _id: string
  categoria: Categoria
}
export const Merchant = model('Merchant', merchantSchema)
