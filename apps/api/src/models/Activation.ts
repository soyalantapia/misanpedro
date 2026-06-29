import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const activationSchema = new Schema(
  {
    /** Tenant: la app del cupón activado. */
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    couponId: { type: Types.ObjectId, ref: 'Coupon', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    codigoNumerico: { type: String, required: true },
    qrPayload: { type: String, required: true },
    activatedAt: { type: Date, required: true, default: Date.now },
    /**
     * @deprecated Los códigos ya no tienen TTL. Campo legacy mantenido por
     * compatibilidad con activations viejas. NUEVAS activations NO lo setean.
     * El código vale mientras el cupón (Coupon) esté activo + dentro de vigencia
     * + stock disponible. Se cancela manualmente desde el vecino o al canjearse.
     */
    expiresAt: { type: Date, index: true },
    status: {
      type: String,
      enum: ['activo', 'canjeado', 'expirado', 'cancelado'],
      default: 'activo',
      index: true,
    },
    redeemedAt: { type: Date },
    ahorroEstimado: { type: Number },
    montoTicket: { type: Number },
    /**
     * Snapshot del cupón/comercio al confirmar el canje (bug #3). El historial
     * "Canjeados" del vecino resuelve título/% aunque el cupón se borre, pause
     * o venza (sale del catálogo activo). Solo se setean al canjear.
     */
    couponTituloSnapshot: { type: String },
    couponPorcentajeSnapshot: { type: Number },
    merchantNombreSnapshot: { type: String },
    merchantCategoriaSnapshot: { type: String },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
  },
  { timestamps: true },
)

// Código numérico único por tenant — distintas apps pueden tener el mismo código.
activationSchema.index({ appId: 1, codigoNumerico: 1 }, { unique: true })
activationSchema.index({ appId: 1, status: 1 })
activationSchema.index({ couponId: 1, userId: 1, status: 1 })
// Garantía a nivel DB: un usuario solo puede tener UN cupón activo a la vez
// por tenant. Protege contra race conditions de double-tap / requests simultáneos.
// Permite múltiples activaciones en estado canjeado/expirado/cancelado (historial).
activationSchema.index(
  { appId: 1, couponId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: 'activo' } },
)

export type ActivationDoc = InferSchemaType<typeof activationSchema> & {
  _id: string
}
export const Activation = model('Activation', activationSchema)
