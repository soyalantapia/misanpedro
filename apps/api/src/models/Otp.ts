import { Schema, model, type InferSchemaType } from 'mongoose'

// Códigos OTP para login del vecino. TTL 5 min.
const otpSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true },
)

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type OtpDoc = InferSchemaType<typeof otpSchema> & { _id: string }
export const Otp = model('Otp', otpSchema)
