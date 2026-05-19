import { Schema, model, Types, type InferSchemaType } from 'mongoose'

// Códigos OTP para login del vecino. TTL 5 min.
// Scoped por App: el mismo email puede usarse en distintas ciudades.
const otpSchema = new Schema(
  {
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    email: { type: String, required: true, lowercase: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true },
)

otpSchema.index({ appId: 1, email: 1 })
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type OtpDoc = InferSchemaType<typeof otpSchema> & { _id: string }
export const Otp = model('Otp', otpSchema)
