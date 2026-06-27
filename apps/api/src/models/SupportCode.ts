import { Schema, model, Types, type InferSchemaType } from 'mongoose'

/**
 * Código de un solo uso para el handoff de "modo soporte". El owner lo genera
 * en su panel (POST /owner/merchants/:id/support-session) y el panel del comercio
 * lo canjea por una sesión de soporte (POST /merchant/auth/support-exchange).
 * Vence rápido (minutos) y se consume una sola vez. Guardamos el HASH; el plano
 * solo viaja en la URL del handoff.
 */
const supportCodeSchema = new Schema(
  {
    codeHash: { type: String, required: true, unique: true, index: true },
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    merchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    /** El MerchantUser admin del comercio que se va a impersonar. */
    merchantUserId: { type: Types.ObjectId, ref: 'MerchantUser', required: true },
    /** Quién pidió el soporte (owner) — el rastro de la impersonación. */
    ownerId: { type: Types.ObjectId, ref: 'Owner', required: true },
    ownerEmail: { type: String },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true },
)

// TTL: Mongo limpia los códigos vencidos solo.
supportCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type SupportCodeDoc = InferSchemaType<typeof supportCodeSchema> & { _id: string }
export const SupportCode = model('SupportCode', supportCodeSchema)
