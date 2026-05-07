import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const subscriptionSchema = new Schema(
  {
    merchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    provider: { type: String, enum: ['mercadopago'], default: 'mercadopago' },
    preapprovalId: { type: String, index: true }, // id MP preapproval
    externalReference: { type: String, index: true }, // id propio que mandamos a MP
    status: {
      type: String,
      enum: ['pending', 'authorized', 'paused', 'cancelled', 'rejected'],
      default: 'pending',
      index: true,
    },
    plan: { type: String, default: 'standard' },
    amountARS: { type: Number, required: true },
    cycle: { type: String, enum: ['monthly'], default: 'monthly' },
    nextBillingAt: { type: Date },
    initPoint: { type: String }, // URL de checkout de MP
    rawLast: { type: Schema.Types.Mixed }, // último payload recibido del webhook
  },
  { timestamps: true },
)

export type SubscriptionDoc = InferSchemaType<typeof subscriptionSchema> & {
  _id: string
}
export const Subscription = model('Subscription', subscriptionSchema)
