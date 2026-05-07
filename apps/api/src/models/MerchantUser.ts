import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const merchantUserSchema = new Schema(
  {
    merchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    nombre: { type: String, required: true },
    rol: { type: String, enum: ['admin', 'cajero'], default: 'admin' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
)

export type MerchantUserDoc = InferSchemaType<typeof merchantUserSchema> & {
  _id: string
}
export const MerchantUser = model('MerchantUser', merchantUserSchema)
