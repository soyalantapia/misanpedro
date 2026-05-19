import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    /** Tenant: cada vecino vive dentro de UNA App (ciudad). */
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },

    dni: { type: String, required: true },
    nombre: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    whatsapp: { type: String, required: true },
    fechaNacimiento: { type: String, required: true }, // YYYY-MM-DD
    acceptedTcAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
)

// Unique scoped al tenant — un email puede usarse en distintas ciudades.
userSchema.index({ appId: 1, dni: 1 }, { unique: true })
userSchema.index({ appId: 1, email: 1 }, { unique: true })
userSchema.index({ appId: 1, whatsapp: 1 }, { unique: true })

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string }
export const User = model('User', userSchema)
