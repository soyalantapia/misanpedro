import { Schema, model, type InferSchemaType } from 'mongoose'

/**
 * Foto diaria del MRR para acumular la TENDENCIA (el negocio sube/baja en el
 * tiempo). UPSERT idempotente por `date` (YYYY-MM-DD, en UTC) — correr N veces el
 * mismo día pisa el mismo doc. Lo escribe ownerSnapshot.service (loop in-process).
 */
const mrrSnapshotSchema = new Schema(
  {
    date: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD (UTC)
    mrrByCurrency: { type: Schema.Types.Mixed }, // { ARS: number, COP: number, … }
    mrrByCity: { type: Schema.Types.Mixed }, // [{ appId, ciudad, slug, moneda, mrr, suscripciones }]
    comerciosActivos: { type: Number, default: 0 },
    suscripcionesActivas: { type: Number, default: 0 },
    capturedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

export type MrrSnapshotDoc = InferSchemaType<typeof mrrSnapshotSchema> & { _id: string }
export const MrrSnapshot = model('MrrSnapshot', mrrSnapshotSchema)
