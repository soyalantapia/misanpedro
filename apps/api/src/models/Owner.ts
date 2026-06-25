import { Schema, model, Types, type InferSchemaType } from 'mongoose'

/**
 * Owner = administrador del SaaS (vos + tu equipo). Acceso al Owner Panel
 * cross-app y al endpoint /api/v1/owner/*.
 *
 * Auth: OTP por email (passwordless), igual que el comercio. Sin contraseña.
 *
 * Multi-admin con ROLES predefinidos (RBAC). El back es la fuente de verdad de
 * los permisos (ver la matriz en routes/owner.ts).
 *
 * No confundir con:
 *   - `User`         = vecino que canjea cupones (por App)
 *   - `MerchantUser` = empleado de un comercio (por Merchant)
 *
 * Owner es global — no se scopea a una App.
 */
export const OWNER_ROLES = ['super', 'admin', 'finanzas', 'soporte', 'viewer'] as const
export type OwnerRol = (typeof OWNER_ROLES)[number]

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
    /** Legacy: ya no se usa (auth OTP-only). Se conserva opcional para no
     *  romper docs viejos; el flujo de login no lo lee. */
    passwordHash: { type: String },
    nombre: { type: String, required: true },

    /** Deprecado (auth OTP-only). Conservados para no romper docs viejos. */
    totpSecret: { type: String, default: '' },
    totpEnabled: { type: Boolean, default: false },

    /**
     * Rol funcional (RBAC). El back enforcea por endpoint:
     *   super    = control total + gestiona el equipo
     *   admin    = apps/comercios/vecinos/pagos (no el equipo)
     *   finanzas = métricas + suscripciones/cobranzas
     *   soporte  = comercios + vecinos (sin pagos)
     *   viewer   = solo lectura
     * Default 'viewer' = mínimo privilegio (un alta sin rol no da poder).
     */
    rol: {
      type: String,
      enum: OWNER_ROLES,
      default: 'viewer',
    },

    /** Si está deshabilitado, no puede loguear (sin borrar el registro). */
    enabled: { type: Boolean, default: true },

    /** Trazabilidad de invitación (quién lo sumó al equipo y cuándo). */
    invitedByOwnerId: { type: Types.ObjectId, ref: 'Owner' },
    invitedAt: { type: Date },

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
