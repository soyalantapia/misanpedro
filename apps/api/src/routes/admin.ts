import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'
import { Types } from 'mongoose'
import { env } from '@/env'
import { Merchant, MerchantUser, Redemption, Subscription, User } from '@/models'

export const adminRoutes = new Hono()

/**
 * Super admin (vos como dueño de la plataforma).
 * Auth via header `x-admin-token` que matchea con env.SUPER_ADMIN_TOKEN.
 * En dev podés setear cualquier valor; en prod ROTAR antes de exponer.
 */
const requireSuperAdmin: MiddlewareHandler = async (c, next) => {
  const provided = c.req.header('x-admin-token')
  if (!env.SUPER_ADMIN_TOKEN || env.SUPER_ADMIN_TOKEN.length < 16) {
    return c.json(
      { ok: false, error: 'super admin no configurado (setear SUPER_ADMIN_TOKEN)' },
      503,
    )
  }
  if (provided !== env.SUPER_ADMIN_TOKEN) {
    return c.json({ ok: false, error: 'unauthorized' }, 401)
  }
  await next()
}

// Métricas globales — dashboard del dueño
adminRoutes.get('/metrics', requireSuperAdmin, async (c) => {
  const [merchants, activeMerchants, users, redemptions, activeSubs] = await Promise.all([
    Merchant.countDocuments(),
    Merchant.countDocuments({ estado: 'activo' }),
    User.countDocuments(),
    Redemption.countDocuments(),
    Subscription.countDocuments({ status: 'authorized' }),
  ])

  // MRR estimado (todos los activos pagando el plan estándar)
  const mrrARS = activeSubs * Number(env.PLAN_AMOUNT_ARS ?? 50_000)

  // Total ahorro generado a los vecinos
  const ahorroAggregate = await Redemption.aggregate([
    { $group: { _id: null, total: { $sum: '$ahorroEstimado' } } },
  ])
  const ahorroTotal = ahorroAggregate[0]?.total ?? 0

  // Top comercios por canjes
  const topComercios = await Redemption.aggregate([
    { $group: { _id: '$merchantId', canjes: { $sum: 1 }, ingresos: { $sum: '$montoTicket' } } },
    { $sort: { canjes: -1 } },
    { $limit: 10 },
  ])
  const topIds = topComercios.map((t) => t._id)
  const topMerchants = await Merchant.find({ _id: { $in: topIds } })
  const topMap = new Map(topMerchants.map((m) => [m._id.toString(), m]))

  return c.json({
    ok: true,
    metrics: {
      merchants: {
        total: merchants,
        active: activeMerchants,
        pendingPayment: merchants - activeMerchants,
      },
      users,
      redemptions,
      activeSubscriptions: activeSubs,
      mrrARS,
      ahorroTotal,
      topComercios: topComercios.map((t) => {
        const m = topMap.get(t._id.toString())
        return {
          id: t._id.toString(),
          nombre: m?.nombre ?? '?',
          slug: m?.slug,
          canjes: t.canjes,
          ingresos: t.ingresos,
        }
      }),
    },
  })
})

// Lista de comercios paginada con filtros
adminRoutes.get('/merchants', requireSuperAdmin, async (c) => {
  const estado = c.req.query('estado')
  const q = c.req.query('q')?.toLowerCase()
  const filter: Record<string, any> = {}
  if (estado) filter.estado = estado
  // Escapamos el input antes de meterlo en $regex: evita regex-DoS (catastrophic
  // backtracking) y que un metacaracter cambie la búsqueda. Igual que owner.ts.
  if (q) filter.nombre = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  const list = await Merchant.find(filter).sort({ createdAt: -1 }).limit(200)
  return c.json({
    ok: true,
    merchants: list.map((m) => ({
      id: m._id.toString(),
      slug: m.slug,
      nombre: m.nombre,
      estado: m.estado,
      categoria: m.categoria,
      cuit: m.cuit,
      razonSocial: m.razonSocial,
      direccion: m.direccion,
      createdAt: (m as any).createdAt,
    })),
  })
})

// Suspender / reactivar / cancelar comercio
const updateEstadoSchema = z.object({
  estado: z.enum(['activo', 'suspendido', 'cancelado', 'pending_payment']),
})
adminRoutes.patch('/merchants/:id/estado', requireSuperAdmin, async (c) => {
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'invalid id' }, 400)
  const body = await c.req.json().catch(() => ({}))
  const parsed = updateEstadoSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const merchant = await Merchant.findById(id)
  if (!merchant) return c.json({ ok: false, error: 'not found' }, 404)
  merchant.estado = parsed.data.estado
  await merchant.save()
  return c.json({ ok: true })
})

// Forzar refund (cuando un comercio reclama)
adminRoutes.post('/merchants/:id/refund', requireSuperAdmin, async (c) => {
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'invalid id' }, 400)
  const sub = await Subscription.findOne({ merchantId: id }).sort({ createdAt: -1 })
  if (!sub) return c.json({ ok: false, error: 'sin suscripcion' }, 404)
  sub.status = 'cancelled'
  sub.rawLast = { ...(sub.rawLast as any), refundedAt: new Date().toISOString() }
  await sub.save()
  await Merchant.updateOne({ _id: id }, { estado: 'cancelado' })
  // ⚠️ IMPORTANTE — A2 audit v4 (2026-05-28):
  // Esta ruta marca la suscripción como cancelada y deja un timestamp `refundedAt`
  // en `rawLast`, pero NO dispara el refund real contra la API de MercadoPago.
  // Hasta implementar `mp.service.refundPreapproval(externalReference)`, el operador
  // (Alan, CUIT 20-43316638-9) DEBE entrar a panel.mercadopago.com.ar y hacer el
  // refund manualmente dentro de las 48h posteriores a este POST, para cumplir con
  // los 10 días de arrepentimiento que promete la TyC (Ley 24.240).
  // Workaround documentado en runbook hasta primera versión del refund automático.
  // TODO(A2): implementar refund automático vía POST /v1/payments/:id/refunds
  return c.json({ ok: true })
})

// Historial de un comercio
adminRoutes.get('/merchants/:id', requireSuperAdmin, async (c) => {
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'invalid id' }, 400)
  const merchant = await Merchant.findById(id)
  if (!merchant) return c.json({ ok: false, error: 'not found' }, 404)
  const users = await MerchantUser.find({ merchantId: id })
  const subs = await Subscription.find({ merchantId: id }).sort({ createdAt: -1 })
  const totalCanjes = await Redemption.countDocuments({ merchantId: id })
  return c.json({
    ok: true,
    merchant: {
      id: merchant._id.toString(),
      slug: merchant.slug,
      nombre: merchant.nombre,
      estado: merchant.estado,
      cuit: merchant.cuit,
      razonSocial: merchant.razonSocial,
      condicionFiscal: merchant.condicionFiscal,
      direccionFiscal: merchant.direccionFiscal,
      createdAt: (merchant as any).createdAt,
    },
    staff: users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      lastLoginAt: u.lastLoginAt,
    })),
    subscriptions: subs.map((s) => ({
      id: s._id.toString(),
      status: s.status,
      amountARS: s.amountARS,
      preapprovalId: s.preapprovalId,
      externalReference: s.externalReference,
      nextBillingAt: s.nextBillingAt,
      createdAt: (s as any).createdAt,
    })),
    totalCanjes,
  })
})
