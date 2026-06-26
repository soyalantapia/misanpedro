import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import { couponCreateSchema, couponUpdateSchema } from '@misanpedro/shared'
import { Coupon } from '@/models'
import { serializeCoupon } from './coupons'

/**
 * Regresión del "Asesor de cupones". Cubre los bugs encontrados + arreglados:
 *  - franja horaria validada como hora real (no solo formato)  → bug 25:99
 *  - `null` = limpiar un opcional al editar (nullable)          → "no se podía borrar"
 *  - `precioReferencia` NO es nullable (campo del planificador) → no romper la otra feature
 *  - regla dura: costoReferencia/objetivo NUNCA salen al vecino → privacidad
 *  - limpiar un campo = $unset real en Mongoose                 → mecanismo del fix
 */

const futuro = new Date(Date.now() + 86_400_000).toISOString()
const base = {
  titulo: 'Cupón de prueba largo',
  descripcion: 'x'.repeat(25),
  porcentaje: 30,
  vigenciaHasta: futuro,
}

describe('couponCreateSchema / couponUpdateSchema — asesor', () => {
  it('acepta null para limpiar mis opcionales (create)', () => {
    const r = couponCreateSchema.safeParse({
      ...base,
      costoReferencia: null,
      objetivo: null,
      dias: null,
      franjaDesde: null,
      franjaHasta: null,
      productoGancho: null,
    })
    expect(r.success).toBe(true)
  })

  it('acepta null para limpiar (update parcial)', () => {
    const r = couponUpdateSchema.safeParse({
      costoReferencia: null,
      objetivo: null,
      dias: null,
      franjaDesde: null,
      franjaHasta: null,
      productoGancho: null,
    })
    expect(r.success).toBe(true)
  })

  it('RECHAZA null en precioReferencia (campo del planner, NO nullable)', () => {
    expect(couponUpdateSchema.safeParse({ precioReferencia: null }).success).toBe(false)
  })

  it('valida la franja como HORA real, no solo formato', () => {
    expect(couponUpdateSchema.safeParse({ franjaDesde: '25:99' }).success).toBe(false)
    expect(couponUpdateSchema.safeParse({ franjaHasta: '09:60' }).success).toBe(false)
    expect(couponUpdateSchema.safeParse({ franjaDesde: '00:00', franjaHasta: '23:59' }).success).toBe(true)
  })

  it('rechaza franja con "desde" >= "hasta" (consistencia, no solo formato)', () => {
    expect(couponUpdateSchema.safeParse({ franjaDesde: '18:00', franjaHasta: '09:00' }).success).toBe(false)
    expect(couponUpdateSchema.safeParse({ franjaDesde: '12:00', franjaHasta: '12:00' }).success).toBe(false)
    expect(couponUpdateSchema.safeParse({ franjaDesde: '09:00', franjaHasta: '18:00' }).success).toBe(true)
  })

  it('rechaza objetivo inválido y costo negativo', () => {
    expect(couponUpdateSchema.safeParse({ objetivo: 'no_existe' }).success).toBe(false)
    expect(couponUpdateSchema.safeParse({ costoReferencia: -5 }).success).toBe(false)
  })

  it('acepta cualquier porcentaje entero 1..100 (incluye 35) y rechaza 0/101', () => {
    expect(couponUpdateSchema.safeParse({ porcentaje: 35 }).success).toBe(true)
    expect(couponUpdateSchema.safeParse({ porcentaje: 0 }).success).toBe(false)
    expect(couponUpdateSchema.safeParse({ porcentaje: 101 }).success).toBe(false)
  })

  it('stockMaximo: acepta entero >=1 y null (sin tope); rechaza 0/negativo/decimal', () => {
    expect(couponCreateSchema.safeParse({ ...base, stockMaximo: 2 }).success).toBe(true)
    expect(couponUpdateSchema.safeParse({ stockMaximo: 50 }).success).toBe(true)
    expect(couponUpdateSchema.safeParse({ stockMaximo: null }).success).toBe(true) // quitar tope
    expect(couponUpdateSchema.safeParse({ stockMaximo: 0 }).success).toBe(false)
    expect(couponUpdateSchema.safeParse({ stockMaximo: -5 }).success).toBe(false)
    expect(couponUpdateSchema.safeParse({ stockMaximo: 2.5 }).success).toBe(false)
  })
})

describe('imagenUrl — validación de imagen segura (anti-XSS)', () => {
  it('acepta https y data:image', () => {
    expect(couponCreateSchema.safeParse({ ...base, imagenUrl: 'https://cdn.x.com/a.jpg' }).success).toBe(true)
    expect(
      couponCreateSchema.safeParse({ ...base, imagenUrl: 'data:image/png;base64,iVBORw0KGgo=' }).success,
    ).toBe(true)
  })

  it('RECHAZA esquemas peligrosos (javascript:, data:text/html)', () => {
    expect(couponCreateSchema.safeParse({ ...base, imagenUrl: 'javascript:alert(1)' }).success).toBe(false)
    expect(
      couponCreateSchema.safeParse({ ...base, imagenUrl: 'data:text/html,<script>x</script>' }).success,
    ).toBe(false)
  })

  it('acepta null para limpiar la imagen al editar (update)', () => {
    expect(couponUpdateSchema.safeParse({ imagenUrl: null }).success).toBe(true)
  })

  it('RECHAZA data: URL gigante (tope ~5 MB) y acepta una chica', () => {
    const chica = 'data:image/png;base64,' + 'A'.repeat(1000)
    const gigante = 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024) // ~6 MB decodificado
    expect(couponCreateSchema.safeParse({ ...base, imagenUrl: chica }).success).toBe(true)
    expect(couponCreateSchema.safeParse({ ...base, imagenUrl: gigante }).success).toBe(false)
  })
})

describe('serializeCoupon — privacidad (regla dura)', () => {
  const doc = {
    _id: new Types.ObjectId(),
    merchantId: new Types.ObjectId(),
    titulo: 'X',
    descripcion: 'Y',
    porcentaje: 30,
    precioReferencia: 6000,
    costoReferencia: 2500,
    objetivo: 'llenar_flojos',
    tipoOferta: 'porcentaje',
    exclusiva: true,
    dias: ['mar'],
    franjaDesde: '15:00',
    franjaHasta: '18:00',
    productoGancho: 'pizza',
    vigenciaHasta: new Date(),
    estado: 'activo',
  }

  it('público NUNCA expone costoReferencia ni objetivo', () => {
    const pub = serializeCoupon(doc)
    expect(pub).not.toHaveProperty('costoReferencia')
    expect(pub).not.toHaveProperty('objetivo')
    // Los públicos del asesor SÍ viajan
    expect(pub.precioReferencia).toBe(6000)
    expect(pub.exclusiva).toBe(true)
    expect(pub.dias).toEqual(['mar'])
  })

  it('includePrivate=true SÍ los incluye (panel del propio comercio)', () => {
    const priv = serializeCoupon(doc, undefined, { includePrivate: true })
    expect(priv.costoReferencia).toBe(2500)
    expect(priv.objetivo).toBe('llenar_flojos')
  })

  it('expone imagenUrl en público (la foto del cupón sí viaja al vecino)', () => {
    const withImg = { ...doc, imagenUrl: 'https://cdn.x.com/cupon.jpg' }
    expect(serializeCoupon(withImg).imagenUrl).toBe('https://cdn.x.com/cupon.jpg')
  })
})

describe('Coupon model — limpiar un campo emite $unset (mecanismo del PATCH con null)', () => {
  it('asignar undefined en un doc hidratado genera $unset', () => {
    const doc = Coupon.hydrate({
      _id: new Types.ObjectId(),
      merchantId: new Types.ObjectId(),
      titulo: 'X',
      descripcion: 'Y',
      porcentaje: 30,
      vigenciaHasta: new Date(),
      estado: 'activo',
      costoReferencia: 2500,
      objetivo: 'llenar_flojos',
      dias: ['mar'],
      franjaDesde: '15:00',
      franjaHasta: '18:00',
      productoGancho: 'pizza',
    })
    // Igual que el backend: `coupon.x = data.x ?? undefined` con data.x === null
    const d = doc as unknown as Record<string, unknown>
    for (const k of ['costoReferencia', 'objetivo', 'dias', 'franjaDesde', 'franjaHasta', 'productoGancho']) {
      d[k] = undefined
    }
    const changes = doc.getChanges() as { $unset?: Record<string, unknown> }
    const unset = changes.$unset ?? {}
    for (const k of ['costoReferencia', 'objetivo', 'dias', 'franjaDesde', 'franjaHasta', 'productoGancho']) {
      expect(unset).toHaveProperty(k)
    }
  })
})
