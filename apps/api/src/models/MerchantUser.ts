import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const merchantUserSchema = new Schema(
  {
    /** Tenant: scoped por app (un mismo email puede ser MerchantUser en distintas ciudades). */
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    merchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    email: { type: String, required: true, lowercase: true },
    passwordHash: { type: String, required: true },
    nombre: { type: String, required: true },
    rol: { type: String, enum: ['admin', 'cajero'], default: 'admin' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
)

merchantUserSchema.index({ appId: 1, email: 1 }, { unique: true })

export type MerchantUserDoc = InferSchemaType<typeof merchantUserSchema> & {
  _id: string
}
export const MerchantUser = model('MerchantUser', merchantUserSchema)
