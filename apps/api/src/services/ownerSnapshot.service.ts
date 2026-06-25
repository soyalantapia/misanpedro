/**
 * Snapshot diario del MRR para acumular tendencia. In-process (sin cron externo),
 * mismo patrón que expiry.service. Idempotente por fecha (UTC): cada corrida hace
 * UPSERT del doc de HOY, así múltiples corridas/reinicios por día no duplican.
 */
import { MrrSnapshot, Merchant } from '@/models'
import { computeMrr } from './ownerStats.service'

const SNAPSHOT_TICK_MS = 6 * 60 * 60 * 1000 // cada 6h: cubre "el de hoy" con margen ante reinicios
let timer: ReturnType<typeof setInterval> | null = null

/** Fecha YYYY-MM-DD en UTC (clave estable de idempotencia). */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function runMrrSnapshot(): Promise<{ date: string } | null> {
  try {
    const mrr = await computeMrr()
    const comerciosActivos = await Merchant.countDocuments({ estado: 'activo' })
    const date = todayUtc()
    await MrrSnapshot.updateOne(
      { date },
      {
        $set: {
          mrrByCurrency: mrr.byCurrency,
          mrrByCity: mrr.byCity,
          comerciosActivos,
          suscripcionesActivas: mrr.total.suscripcionesActivas,
          capturedAt: new Date(),
        },
      },
      { upsert: true },
    )
    return { date }
  } catch (err) {
    console.error('[mrr-snapshot]', (err as Error)?.message)
    return null
  }
}

export function startSnapshotLoop(): void {
  if (timer) return
  void runMrrSnapshot() // primera foto al boot, sin bloquear
  timer = setInterval(() => {
    void runMrrSnapshot()
  }, SNAPSHOT_TICK_MS)
}

export function stopSnapshotLoop(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
