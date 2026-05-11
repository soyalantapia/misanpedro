import { Schema, model, Types, type InferSchemaType } from 'mongoose'

/**
 * Token para reset de password de comercios.
 * Hash en DB, plain en email. Single-use, TTL 30 min.
 */
const passwordResetSchema = new Schema(
  {
    merchantUserId: {
      type: Types.ObjectId,
      ref: 'MerchantUser',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    requestedFromIp: { type: String },
    requestedFromUa: { type: String },
  },
  { timestamps: true },
)

// TTL automático: borra los expirados
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type PasswordResetDoc = InferSchemaType<typeof passwordResetSchema> & {
  _id: string
}
export const PasswordReset = model('PasswordReset', passwordResetSchema)
