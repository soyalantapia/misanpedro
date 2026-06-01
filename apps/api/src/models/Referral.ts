import { Schema, model, Types, type InferSchemaType } from 'mongoose'

/**
 * Referral = un evento de referido comercio→comercio dentro de UN tenant.
 *
 * Ciclo: se crea `pending` cuando el comercio referido se registra con un
 * código válido; pasa a `confirmed` cuando publica su primer cupón activo
 * (ahí se acredita 1 semana gratis al referidor, salvo tope/abuso).
 *
 * El índice único { appId, referredMerchantId } garantiza que un comercio
 * referido cuenta UNA sola vez (idempotencia natural del crédito).
 */
const referralSchema = new Schema(
  {
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    referrerMerchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    referredMerchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    referredByCode: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected'],
      default: 'pending',
      index: true,
    },
    /** Por qué no acreditó (cuando status no suma semana). */
    rejectedReason: {
      type: String,
      enum: ['self', 'duplicate_contact', 'cap_reached', null],
      default: null,
    },
    /** Semanas otorgadas al referidor por este referido (0 ó 1). */
    weeksGranted: { type: Number, default: 0 },
    /** Días gratis otorgados al REFERIDO por activarse (0 ó 15). */
    referredDaysGranted: { type: Number, default: 0 },
    confirmedAt: { type: Date },
  },
  { timestamps: true },
)

// Un referido cuenta una sola vez por tenant → idempotencia del crédito.
referralSchema.index({ appId: 1, referredMerchantId: 1 }, { unique: true })

export type ReferralDoc = InferSchemaType<typeof referralSchema> & { _id: string }
export const Referral = model('Referral', referralSchema)
