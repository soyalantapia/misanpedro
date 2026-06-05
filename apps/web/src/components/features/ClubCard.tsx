import { useNavigate } from 'react-router-dom'
import { Gift, Flame, PiggyBank } from 'lucide-react'
import { useApiMyActivations } from '@/lib/apiQueries'
import { tokens } from '@/lib/api'
import { computeClub, PREMIO_DEL_MES } from '@/lib/club'
import { Button } from '@/components/ui'

/**
 * EL CLUB — niveles MENSUALES del vecino (Bronce/Plata/Oro) en PerfilPage.
 *
 * Solo MOSTRAR: el sorteo lo corre el operador a mano; acá se ven las entradas
 * (= cupones usados este mes) y el premio. Todo client-side desde los canjes
 * que la app ya baja (lib/club). El nivel es por CANJES del mes — distinto del
 * número de ahorro ($) de la billetera (SavingsWallet). Conviven, no se mezclan.
 */

function ars(n: number) {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

export function ClubCard() {
  const navigate = useNavigate()
  const loggedIn = !!(tokens.get('user').access || tokens.get('user').refresh)
  const { data, loading } = useApiMyActivations('canjeado', loggedIn)

  if (!loggedIn) return null
  if (loading && !data) {
    return <div className="h-44 w-full animate-pulse rounded-3xl bg-fin-surface ring-1 ring-fin-line" />
  }

  const now = new Date()
  const mesNombre = now.toLocaleDateString('es-AR', { month: 'long' })
  const { canjesEsteMes, entradas, nivel, faltan, progress, ahorroTotal, racha } = computeClub(
    data ?? [],
    now,
  )

  return (
    <section className="overflow-hidden rounded-3xl bg-fin-surface p-5 ring-1 ring-fin-line shadow-fin-card">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-fin-lime">El Club</p>
        <span className="text-[11px] font-semibold text-fin-faint">Socios de San Pedro</span>
      </div>

      {/* Nivel del mes */}
      <div className="mt-2.5 flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-fin-surface2 text-3xl leading-none ring-1 ring-fin-line">
          {nivel.medal}
        </span>
        <div className="min-w-0">
          <p className="text-lg font-extrabold leading-tight text-fin-ink">
            {nivel.label ? (
              <>
                Socio {nivel.label} <span className="font-semibold text-fin-soft">· este mes</span>
              </>
            ) : (
              <>
                Todavía sin nivel <span className="font-semibold text-fin-soft">este mes</span>
              </>
            )}
          </p>
          <p className="text-xs text-fin-soft">
            {canjesEsteMes} {canjesEsteMes === 1 ? 'cupón usado' : 'cupones usados'} en {mesNombre}
          </p>
        </div>
      </div>

      {canjesEsteMes === 0 ? (
        // Reset en positivo (mes nuevo / sin canjes todavía).
        <div className="mt-4 rounded-2xl bg-fin-lime/10 p-4 ring-1 ring-fin-lime/20">
          <p className="text-sm font-semibold text-fin-ink">
            Arrancó un mes nuevo. Usá un cupón y entrás al Club y al sorteo de {mesNombre}. 🎁
          </p>
          <Button fullWidth className="mt-3" onClick={() => navigate('/')}>
            Ver descuentos
          </Button>
        </div>
      ) : (
        <>
          {/* Progreso al siguiente nivel */}
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-fin-surface2">
              <div
                className="h-full rounded-full bg-fin-lime transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-fin-soft">
              {nivel.next ? (
                <>
                  Te faltan <span className="font-bold text-fin-ink">{faltan}</span>{' '}
                  {faltan === 1 ? 'canje' : 'canjes'} para{' '}
                  <span className="font-bold text-fin-ink">{nivel.next.label}</span>
                </>
              ) : (
                <span className="font-bold text-fin-lime">¡Llegaste al nivel máximo del mes! 🎉</span>
              )}
            </p>
          </div>

          {/* Entradas al sorteo */}
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-fin-surface2 p-3.5 ring-1 ring-fin-line">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fin-lime text-fin-bg shadow-fin-glow">
              <Gift size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-fin-ink">
                Llevás {entradas} {entradas === 1 ? 'entrada' : 'entradas'} al sorteo de {mesNombre}
              </p>
              <p className="mt-0.5 text-[11px] text-fin-soft">{PREMIO_DEL_MES}</p>
            </div>
          </div>
        </>
      )}

      {/* Permanentes */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fin-soft">
        <span className="inline-flex items-center gap-1.5">
          <PiggyBank size={13} className="text-fin-up" />
          Ahorro total: <span className="font-bold text-fin-up">${ars(ahorroTotal)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Flame size={13} className="text-fin-lime" />
          Racha: <span className="font-bold text-fin-ink">{racha} {racha === 1 ? 'mes' : 'meses'}</span>
        </span>
      </div>
    </section>
  )
}
