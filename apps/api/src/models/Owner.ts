import { Schema, model, type InferSchemaType } from 'mongoose'

/**
 * Owner = dueño del SaaS (vos + tu equipo futuro).
 * Tiene acceso al Owner Panel cross-app y al endpoint /api/v1/owner/*.
 *
 * Auth: email + password (bcrypt) + 2FA TOTP obligatorio.
 *
 * No confundir con:
 *   - `User`         = vecino que canjea cupones (por App)
 *   - `MerchantUser` = empleado de un comercio (por Merchant)
 *
 * Owner es global — no se scopea a una App.
 */
const ownerSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true },
    nombre: { type: String, required: true },

    /**
     * 2FA TOTP secret (base32). Generado en alta y solo el owner lo conoce
     * (via QR escaneado por Google Authenticator / Authy / 1Password).
     * Si está vacío, el owner aún no completó el setup de 2FA.
     */
    totpSecret: { type: String, default: '' },
    totpEnabled: { type: Boolean, default: false },

    /** Rol funcional (sólo 'super' por ahora; más adelante: 'finance', 'ops'). */
    rol: {
      type: String,
      enum: ['super'],
      default: 'super',
    },

    /** Si está deshabilitado, no puede loguear (sin borrar el registro). */
    enabled: { type: Boolean, default: true },

    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },

    /**
     * Audit log mini: últimas 20 acciones del owner.
     * Para auditoría completa usar un modelo OwnerAuditLog (TODO Fase 2).
     */
    recentActions: [
      {
        action: { type: String },
        at: { type: Date, default: Date.now },
        ip: { type: String },
        detail: { type: String },
      },
    ],
  },
  { timestamps: true },
)

export type OwnerDoc = InferSchemaType<typeof ownerSchema> & { _id: string }
export const Owner = model('Owner', ownerSchema)
