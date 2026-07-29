import { Schema, model, Types, type InferSchemaType } from 'mongoose'

/**
 * Auditoría completa del panel de gestión: QUÉ admin hizo QUÉ, cuándo y sobre qué.
 * Con multi-admin hace falta trazabilidad real (Owner.recentActions sólo guarda las
 * últimas 20 por owner). Colección append-only, indexada para los filtros de
 * GET /owner/audit (por admin / acción / recurso / fecha).
 */
const ownerAuditLogSchema = new Schema(
  {
    /**
     * Qué admin la hizo. VACÍO cuando la acción la hizo el SISTEMA y no una
     * persona — por ejemplo el sweep que suspende comercios con la suscripción
     * vencida. Esas acciones también tienen que quedar registradas: antes el
     * owner veía "Reactivó comercio" y después nada, y no encontraba quién lo
     * había suspendido porque no había sido nadie. [cazabug loop2]
     */
    ownerId: { type: Types.ObjectId, ref: 'Owner', index: true },
    ownerEmail: { type: String }, // desnormalizado (sobrevive si el owner se borra)
    action: { type: String, required: true, index: true }, // 'app.create', 'merchant.suspend', 'admin.invite', 'auth.login', …
    recurso: { type: String }, // 'app' | 'merchant' | 'subscription' | 'admin' | 'auth'
    recursoId: { type: String },
    detail: { type: String },
    ip: { type: String },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
)

ownerAuditLogSchema.index({ ownerId: 1, at: -1 })
ownerAuditLogSchema.index({ action: 1, at: -1 })
ownerAuditLogSchema.index({ at: -1 })

export type OwnerAuditLogDoc = InferSchemaType<typeof ownerAuditLogSchema> & { _id: string }
export const OwnerAuditLog = model('OwnerAuditLog', ownerAuditLogSchema)
