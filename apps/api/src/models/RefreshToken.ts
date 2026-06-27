import { Schema, model, Types, type InferSchemaType } from 'mongoose'

// Refresh tokens hasheados (sha256). El token plano vive solo en el cliente.
const refreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    subjectType: { type: String, enum: ['user', 'merchant_user', 'owner'], required: true },
    subjectId: { type: Types.ObjectId, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    userAgent: { type: String },
    ip: { type: String },
    /** Sesión de SOPORTE (owner impersonando al comercio): id del owner que
     *  entró. El access que se mintea en cada /refresh lo re-incluye, y permite
     *  revocar SOLO las sesiones de soporte de un comercio. */
    impersonatedBy: { type: Types.ObjectId, index: true },
  },
  { timestamps: true },
)

// TTL index para limpiar tokens expirados
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema> & {
  _id: string
}
export const RefreshToken = model('RefreshToken', refreshTokenSchema)
