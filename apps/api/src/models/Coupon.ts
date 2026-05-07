import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const couponSchema = new Schema(
  {
    merchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    titulo: { type: String, required: true },
    descripcion: { type: String, required: true },
    condiciones: { type: String, default: '' },
    porcentaje: { type: Number, required: true, min: 1, max: 100 },
    vigenciaHasta: { type: Date, required: true, index: true },
    imagenUrl: { type: String },
    diasAplica: { type: String },
    estado: {
      type: String,
      enum: ['activo', 'pausado', 'agotado', 'vencido'],
      default: 'activo',
      index: true,
    },
    stockMaximo: { type: Number },
    stockUsado: { type: Number, default: 0 },
  },
  { timestamps: true },
)

couponSchema.index({ merchantId: 1, estado: 1 })

export type CouponDoc = InferSchemaType<typeof couponSchema> & { _id: string }
export const Coupon = model('Coupon', couponSchema)
