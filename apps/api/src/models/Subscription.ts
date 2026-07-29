import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const subscriptionSchema = new Schema(
  {
    /** Tenant. */
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    merchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    provider: { type: String, enum: ['mercadopago'], default: 'mercadopago' },
    preapprovalId: { type: String, index: true }, // id MP preapproval
    externalReference: { type: String, index: true }, // id propio que mandamos a MP
    status: {
      type: String,
      enum: ['pending', 'authorized', 'paused', 'cancelled', 'rejected'],
      default: 'pending',
      index: true,
    },
    plan: { type: String, default: 'standard' },
    amountARS: { type: Number, required: true },
    currency: { type: String, default: 'ARS' },
    cycle: { type: String, enum: ['monthly'], default: 'monthly' },
    nextBillingAt: { type: Date },
    initPoint: { type: String }, // URL de checkout de MP
    rawLast: { type: Schema.Types.Mixed }, // último payload recibido del webhook
  },
  { timestamps: true },
)

/**
 * Un comercio no puede tener DOS suscripciones vivas a la vez.
 *
 * `POST /billing/preapproval` acuñaba una suscripción y un preapproval de Mercado
 * Pago en cada llamada. El camino real no es el doble clic (el botón se
 * deshabilita) sino abandonar el checkout y volver a intentar: cada intento
 * dejaba un link de pago VIVO en MP, y si el comercio completaba dos, le
 * debitaban el doble todos los meses. Encima /billing/me y /billing/cancel miran
 * `.sort({createdAt:-1})`, o sea sólo la última: la duplicada quedaba cobrando
 * sin aparecer en el panel.
 *
 * El guard principal vive en la ruta (reusa la suscripción viva en vez de crear
 * otra); este índice es la red de abajo, para la carrera de dos requests
 * simultáneos que pasan el chequeo a la vez. 'cancelled'/'rejected' quedan fuera
 * del filtro a propósito: el comercio tiene que poder volver a suscribirse.
 */
subscriptionSchema.index(
  { appId: 1, merchantId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'authorized'] } } },
)

export type SubscriptionDoc = InferSchemaType<typeof subscriptionSchema> & {
  _id: string
}
export const Subscription = model('Subscription', subscriptionSchema)
