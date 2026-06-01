import { Schema, model, Types, type InferSchemaType } from 'mongoose'

/**
 * Suscripción Web Push de un vecino (PushSubscription del browser).
 * Una por endpoint (cada navegador/dispositivo tiene el suyo).
 */
const pushSubscriptionSchema = new Schema(
  {
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    /** Categorías que la vecina sigue. Vacío = todas. */
    categories: { type: [String], default: [] },
    /** Vecino logueado (opcional — puede suscribirse sin sesión). */
    userId: { type: Types.ObjectId, ref: 'User' },
    userAgent: { type: String },
  },
  { timestamps: true },
)

export type PushSubscriptionDoc = InferSchemaType<typeof pushSubscriptionSchema> & { _id: string }
export const PushSubscription = model('PushSubscription', pushSubscriptionSchema)
