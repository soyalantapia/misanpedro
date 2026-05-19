import { Schema, model, Types, type InferSchemaType } from 'mongoose'

/**
 * Nota privada del comercio sobre un cliente. No se muestra al vecino.
 * Ej: "Marta es vegana", "Juan siempre con sus hijos", "Allergia al gluten".
 */
const customerNoteSchema = new Schema(
  {
    /** Tenant. */
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    merchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    /** Quién creó la nota (cajero o admin del comercio). */
    createdBy: { type: Types.ObjectId, ref: 'MerchantUser', required: true },
    text: { type: String, required: true, maxlength: 1000 },
    /** Tags opcionales (ej: ['alergia', 'vegano']) */
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
)

customerNoteSchema.index({ merchantId: 1, userId: 1 })

export type CustomerNoteDoc = InferSchemaType<typeof customerNoteSchema> & { _id: string }
export const CustomerNote = model('CustomerNote', customerNoteSchema)
