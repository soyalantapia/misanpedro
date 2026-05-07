import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const activationSchema = new Schema(
  {
    couponId: { type: Types.ObjectId, ref: 'Coupon', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    codigoNumerico: { type: String, required: true, unique: true, index: true },
    qrPayload: { type: String, required: true },
    activatedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['activo', 'canjeado', 'expirado', 'cancelado'],
      default: 'activo',
      index: true,
    },
    redeemedAt: { type: Date },
    ahorroEstimado: { type: Number },
    montoTicket: { type: Number },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
  },
  { timestamps: true },
)

activationSchema.index({ couponId: 1, userId: 1, status: 1 })
activationSchema.index({ status: 1, expiresAt: 1 })

export type ActivationDoc = InferSchemaType<typeof activationSchema> & {
  _id: string
}
export const Activation = model('Activation', activationSchema)
