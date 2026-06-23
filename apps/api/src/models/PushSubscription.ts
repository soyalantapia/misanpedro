import { Schema, model, Types, type InferSchemaType } from 'mongoose'

/**
 * Suscripción Web Push de un vecino (PushSubscription del browser).
 * Una por endpoint (cada navegador/dispositivo tiene el suyo).
 */
const pushSubscriptionSchema = new Schema(
  {
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    // No es único global: el mismo endpoint (browser) puede existir en varias
    // ciudades. La unicidad real es por (appId, endpoint) — ver índice compuesto.
    endpoint: { type: String, required: true },
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

// Unicidad por ciudad: un endpoint (browser) puede estar suscripto en varias
// ciudades, pero solo una vez por ciudad. Reemplaza al unique global de endpoint.
pushSubscriptionSchema.index({ appId: 1, endpoint: 1 }, { unique: true })

export type PushSubscriptionDoc = InferSchemaType<typeof pushSubscriptionSchema> & { _id: string }
export const PushSubscription = model('PushSubscription', pushSubscriptionSchema)
