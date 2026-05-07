import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const redemptionSchema = new Schema(
  {
    activationId: {
      type: Types.ObjectId,
      ref: 'Activation',
      required: true,
      unique: true,
      index: true,
    },
    couponId: { type: Types.ObjectId, ref: 'Coupon', required: true, index: true },
    merchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    merchantUserId: {
      type: Types.ObjectId,
      ref: 'MerchantUser',
      required: true,
    },
    montoTicket: { type: Number },
    ahorroEstimado: { type: Number, required: true },
    redeemedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
)

redemptionSchema.index({ merchantId: 1, redeemedAt: -1 })
redemptionSchema.index({ merchantId: 1, userId: 1 })

export type RedemptionDoc = InferSchemaType<typeof redemptionSchema> & {
  _id: string
}
export const Redemption = model('Redemption', redemptionSchema)
