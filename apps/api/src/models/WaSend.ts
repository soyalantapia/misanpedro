import { Schema, model, Types, type InferSchemaType } from 'mongoose'

/**
 * Registro de cada mensaje individual enviado via WhatsApp Web.
 * Usado para rate-limit (4 campañas/mes por comercio).
 */
const waSendSchema = new Schema(
  {
    /** Tenant. */
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    merchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    to: { type: String, required: true },
    text: { type: String, required: true },
    sentAt: { type: Date, required: true, default: Date.now, index: true },
    ok: { type: Boolean, default: true },
    error: { type: String },
    /** ID de la campaña (cuando se envía masivamente, para agrupar). */
    campaignId: { type: String, index: true },
  },
  { timestamps: true },
)

waSendSchema.index({ merchantId: 1, sentAt: -1 })

export type WaSendDoc = InferSchemaType<typeof waSendSchema> & { _id: string }
export const WaSend = model('WaSend', waSendSchema)
