import { Schema, model, Types, type InferSchemaType } from 'mongoose'

/**
 * Token para reset de password.
 * Hash en DB, plain en email. Single-use, TTL 30 min.
 *
 * Cubre dos tipos de subject:
 *   - merchantUserId: tabla MerchantUser (comerciantes)
 *   - ownerId:        tabla Owner       (owners del SaaS)
 *
 * Exactly-one debe estar seteado; el route handler valida.
 */
const passwordResetSchema = new Schema(
  {
    merchantUserId: {
      type: Types.ObjectId,
      ref: 'MerchantUser',
      index: true,
    },
    ownerId: {
      type: Types.ObjectId,
      ref: 'Owner',
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
