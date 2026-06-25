import { Schema, model, Types, type InferSchemaType } from 'mongoose'

// Códigos OTP para login. TTL 5 min.
// Scoped por App: el mismo email puede usarse en distintas ciudades.
// `purpose` separa el OTP del vecino del del comercio del del owner: un mismo
// email puede ser vecino Y admin de comercio en el mismo tenant, y sus códigos
// no deben pisarse. Default 'user' → backward-compatible con OTPs ya emitidos.
// El OWNER es cross-tenant (no tiene App), por eso `appId` es opcional para
// purpose:'owner' — su OTP se busca por { email, purpose:'owner' } sin appId.
const otpSchema = new Schema(
  {
    appId: { type: Types.ObjectId, ref: 'App', index: true },
    email: { type: String, required: true, lowercase: true, index: true },
    purpose: { type: String, enum: ['user', 'merchant', 'owner'], default: 'user' },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true },
)

otpSchema.index({ appId: 1, email: 1, purpose: 1 })
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type OtpDoc = InferSchemaType<typeof otpSchema> & { _id: string }
export const Otp = model('Otp', otpSchema)
