import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    /** Tenant: cada vecino vive dentro de UNA App (ciudad). */
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },

    /** Onboarding sin fricción: la identidad del vecino es NOMBRE + EMAIL. */
    nombre: { type: String, required: true },
    /** La identidad del vecino es el EMAIL: es lo único que puede probar que la
     *  cuenta es suya (le llega un código). El teléfono NO sirve como identidad
     *  porque es público y adivinable. [cazabug S1-01] */
    email: { type: String, required: true, lowercase: true, trim: true },
    /** Dato de CONTACTO (campañas de WhatsApp del comercio), ya no identidad. */
    telefono: { type: String, required: true },

    // ─── Campos legacy / opcionales (ya NO se piden en el alta sin fricción) ───
    dni: { type: String },
    whatsapp: { type: String },
    fechaNacimiento: { type: String }, // YYYY-MM-DD
    acceptedTcAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
)

// Identidad = (ciudad, email), único. El mismo email puede ser vecino en dos
// ciudades distintas sin colisionar.
userSchema.index({ appId: 1, email: 1 }, { unique: true })
// El teléfono se busca (destinatarios de campañas) pero NO es único: una familia
// puede compartir un celular. Antes era el índice de identidad. [cazabug S1-01]
userSchema.index({ appId: 1, telefono: 1 })

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string }
export const User = model('User', userSchema)
