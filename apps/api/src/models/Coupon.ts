import { Schema, model, Types, type InferSchemaType } from 'mongoose'

const couponSchema = new Schema(
  {
    /** Tenant: la app del comercio dueño del cupón. */
    appId: { type: Types.ObjectId, ref: 'App', required: true, index: true },
    merchantId: { type: Types.ObjectId, ref: 'Merchant', required: true, index: true },
    titulo: { type: String, required: true },
    descripcion: { type: String, required: true },
    condiciones: { type: String, default: '' },
    porcentaje: { type: Number, required: true, min: 1, max: 100 },
    /** Precio normal aproximado POR PERSONA (ARS, opcional) — alimenta el
     *  planificador "Armá tu plan" del vecino para estimar cuánto le queda. */
    precioReferencia: { type: Number, min: 0 },
    /** Precio FINAL con el cupón (ARS) — solo para tipoOferta 'precio_fijo'. Público. */
    precioFijo: { type: Number, min: 0 },
    vigenciaHasta: { type: Date, required: true, index: true },
    imagenUrl: { type: String },
    diasAplica: { type: String },
    estado: {
      type: String,
      enum: ['activo', 'pausado', 'agotado', 'vencido'],
      default: 'activo',
      index: true,
    },
    stockMaximo: { type: Number },
    stockUsado: { type: Number, default: 0 },
    // ─── Asesor de cupones (todos opcionales, backward-compatible) ───────
    /** Costo aprox del comercio (PRIVADO — nunca se serializa al vecino). */
    costoReferencia: { type: Number, min: 0 },
    /** Objetivo comercial (PRIVADO): traer_nuevos|llenar_flojos|vaciar_stock|fidelizar. */
    objetivo: { type: String },
    /** Tipo de oferta. Default porcentaje. */
    tipoOferta: { type: String, default: 'porcentaje' },
    /** Exclusivo de la app (no se consigue en la puerta). */
    exclusiva: { type: Boolean, default: false },
    /** Días estructurados (ids DiaSemana). `diasAplica` (string) queda para display. */
    dias: { type: [String], default: undefined },
    /** Franja horaria (HH:MM). */
    franjaDesde: { type: String },
    franjaHasta: { type: String },
    /** Sobre QUÉ aplica: el producto (si es puntual) o la categoría (si 'categoria'). */
    productoGancho: { type: String },
    /** Alcance del descuento: 'puntual' (un producto) | 'categoria' (varios). */
    alcance: { type: String, default: 'puntual' },
    /** Si false, el vecino NO ve pesos (solo el %), aunque haya precio. Público. */
    mostrarAhorroVecino: { type: Boolean, default: true },
  },
  { timestamps: true },
)

couponSchema.index({ appId: 1, estado: 1 })
couponSchema.index({ merchantId: 1, estado: 1 })

export type CouponDoc = InferSchemaType<typeof couponSchema> & { _id: string }
export const Coupon = model('Coupon', couponSchema)
