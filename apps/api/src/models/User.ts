import { Schema, model, type InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    dni: { type: String, required: true, unique: true, index: true },
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    whatsapp: { type: String, required: true, unique: true, index: true },
    fechaNacimiento: { type: String, required: true }, // YYYY-MM-DD
    acceptedTcAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
)

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string }
export const User = model('User', userSchema)
