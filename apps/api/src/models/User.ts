import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    /** Tenant: cada vecino vive dentro de UNA App (ciudad). */
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },

    /** Onboarding sin fricción: la identidad del vecino es NOMBRE + TELÉFONO. */
    nombre: { type: String, required: true },
    /** El TELÉFONO es la identidad (normalizado, solo dígitos). Mismo teléfono
     *  en otro dispositivo → recupera la cuenta y el ahorro. */
    telefono: { type: String, required: true },

    // ─── Campos legacy / opcionales (ya NO se piden en el alta sin fricción) ───
    dni: { type: String },
    email: { type: String, lowercase: true },
    whatsapp: { type: String },
    fechaNacimiento: { type: String }, // YYYY-MM-DD
    acceptedTcAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
)

// Identidad = (tenant, teléfono), único. PARCIAL: solo indexa docs cuyo telefono
// es string, así convive con cuentas viejas sin teléfono (null) sin romper el
// build del índice. Sacamos los unique de dni/email/whatsapp (ahora opcionales).
// Pre-lanzamiento: correr `scripts/sync-user-indexes.ts` para limpiar los índices
// viejos en dev. (No hace falta migrar datos.)
userSchema.index(
  { appId: 1, telefono: 1 },
  { unique: true, partialFilterExpression: { telefono: { $type: 'string' } } },
)

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string }
export const User = model('User', userSchema)
