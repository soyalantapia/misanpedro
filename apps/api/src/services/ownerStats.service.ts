/**
 * Estadísticas de negocio del OWNER (cross-tenant). TODO se calcula en vivo con
 * agregaciones de MongoDB ($group) — sin mocks, sin cache stale. El MRR se snapshotea
 * aparte (ownerSnapshot.service) para acumular tendencia.
 *
 * Nada de N+1 por ciudad: una agregación por métrica.
 */
import { App, Merchant, User, Redemption, Subscription } from '@/models'

type IdLike = { toString(): string }

/** MRR cross-tenant: suma de suscripciones autorizadas, por moneda y por ciudad.
 *  Reutilizado por /stats y por el snapshot diario. */
export async function computeMrr(): Promise<{
  byCurrency: Record<string, number>
  byCity: { appId: string; ciudad: string; slug: string; moneda: string; mrr: number; suscripciones: number }[]
  total: { suscripcionesActivas: number }
}> {
  const rows = await Subscription.aggregate<{
    _id: { appId: IdLike | null; currency: string }
    mrr: number
    n: number
  }>([
    { $match: { status: 'authorized' } },
    { $group: { _id: { appId: '$appId', currency: { $ifNull: ['$currency', 'ARS'] } }, mrr: { $sum: '$amountARS' }, n: { $sum: 1 } } },
  ])

  const apps = await App.find({}, 'slug nombre ciudad moneda').lean()
  const appById = new Map(apps.map((a) => [String(a._id), a]))

  const byCurrency: Record<string, number> = {}
  const byCityMap = new Map<string, { appId: string; ciudad: string; slug: string; moneda: string; mrr: number; suscripciones: number }>()
  let suscripcionesActivas = 0
  for (const r of rows) {
    const cur = r._id.currency || 'ARS'
    byCurrency[cur] = (byCurrency[cur] ?? 0) + r.mrr
    suscripcionesActivas += r.n
    const appId = r._id.appId ? String(r._id.appId) : 'sin-ciudad'
    const app = r._id.appId ? appById.get(appId) : undefined
    const cur2 = byCityMap.get(appId)
    if (cur2) {
      cur2.mrr += r.mrr
      cur2.suscripciones += r.n
    } else {
      byCityMap.set(appId, {
        appId,
        ciudad: app?.ciudad ?? app?.nombre ?? 'Sin ciudad',
        slug: app?.slug ?? '—',
        moneda: app?.moneda ?? cur,
        mrr: r.mrr,
        suscripciones: r.n,
      })
    }
  }
  const byCity = [...byCityMap.values()].sort((a, b) => b.mrr - a.mrr)
  return { byCurrency, byCity, total: { suscripcionesActivas } }
}

/** Conteo de comercios por estado (cross-tenant). */
async function comerciosPorEstado(): Promise<Record<string, number>> {
  const rows = await Merchant.aggregate<{ _id: string; n: number }>([
    { $group: { _id: '$estado', n: { $sum: 1 } } },
  ])
  const out: Record<string, number> = { activo: 0, pending_payment: 0, suspendido: 0, cancelado: 0 }
  for (const r of rows) out[r._id ?? 'desconocido'] = r.n
  return out
}

/** Altas por mes (YYYY-MM) de una colección con `createdAt`. */
async function altasPorMes(model: typeof Merchant | typeof User): Promise<{ mes: string; n: number }[]> {
  const rows = await model.aggregate<{ _id: string; n: number }>([
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  return rows.map((r) => ({ mes: r._id, n: r.n }))
}

/** Canjes + ahorro generado por mes (YYYY-MM). */
async function canjesPorMes(): Promise<{ mes: string; canjes: number; ahorro: number }[]> {
  const rows = await Redemption.aggregate<{ _id: string; canjes: number; ahorro: number }>([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$redeemedAt' } },
        canjes: { $sum: 1 },
        ahorro: { $sum: { $ifNull: ['$ahorroEstimado', 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ])
  return rows.map((r) => ({ mes: r._id, canjes: r.canjes, ahorro: r.ahorro }))
}

/** Top ciudades por canjes. */
async function topCiudades(appById: Map<string, { slug?: string; nombre?: string; ciudad?: string }>): Promise<
  { appId: string; ciudad: string; slug: string; canjes: number }[]
> {
  const rows = await Redemption.aggregate<{ _id: IdLike; n: number }>([
    { $group: { _id: '$appId', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 8 },
  ])
  return rows.map((r) => {
    const a = appById.get(String(r._id))
    return { appId: String(r._id), ciudad: a?.ciudad ?? a?.nombre ?? '—', slug: a?.slug ?? '—', canjes: r.n }
  })
}

/** Top comercios por canjes. */
async function topComercios(): Promise<{ merchantId: string; nombre: string; canjes: number }[]> {
  const rows = await Redemption.aggregate<{ _id: IdLike; n: number }>([
    { $group: { _id: '$merchantId', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 8 },
  ])
  const ids = rows.map((r) => r._id)
  const merchants = await Merchant.find({ _id: { $in: ids } }, 'nombre').lean()
  const byId = new Map(merchants.map((m) => [String(m._id), m.nombre as string]))
  return rows.map((r) => ({ merchantId: String(r._id), nombre: byId.get(String(r._id)) ?? '—', canjes: r.n }))
}

/** Estadísticas completas del negocio (cross-tenant, en vivo). */
export async function computeOwnerStats(now = new Date()) {
  const apps = await App.find({}, 'slug nombre ciudad').lean()
  const appById = new Map(apps.map((a) => [String(a._id), a]))

  const [mrr, comercios, altasComercios, altasVecinos, canjes, ciudades, comerciosTop, enTrial, totalVecinos, ahorroTotalRows, comerciosConTrial, comerciosPagando] =
    await Promise.all([
      computeMrr(),
      comerciosPorEstado(),
      altasPorMes(Merchant),
      altasPorMes(User),
      canjesPorMes(),
      topCiudades(appById),
      topComercios(),
      Merchant.countDocuments({ freeTrialUntil: { $gt: now } }),
      User.countDocuments({}),
      Redemption.aggregate<{ _id: null; ahorro: number }>([
        { $group: { _id: null, ahorro: { $sum: { $ifNull: ['$ahorroEstimado', 0] } } } },
      ]),
      // Embudo: comercios que entraron a trial (tienen freeTrialUntil) vs que pagan.
      Merchant.countDocuments({ freeTrialUntil: { $ne: null } }),
      Subscription.distinct('merchantId', { status: 'authorized' }).then((arr) => arr.length),
    ])

  const ahorroTotal = ahorroTotalRows[0]?.ahorro ?? 0
  const appsActivas = await App.countDocuments({ status: 'active' })
  const appsTotal = apps.length

  return {
    ok: true as const,
    resumen: {
      appsActivas,
      appsTotal,
      comerciosActivos: comercios.activo ?? 0,
      vecinos: totalVecinos,
      ahorroTotal,
      suscripcionesActivas: mrr.total.suscripcionesActivas,
    },
    mrr: { byCurrency: mrr.byCurrency, byCity: mrr.byCity },
    comercios: { porEstado: comercios, enTrial },
    altas: { comercios: altasComercios, vecinos: altasVecinos },
    canjesPorMes: canjes,
    topCiudades: ciudades,
    topComercios: comerciosTop,
    embudo: { conTrial: comerciosConTrial, pagando: comerciosPagando },
  }
}
