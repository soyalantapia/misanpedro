import { Link } from 'react-router-dom'
import { Lock, Users, Download, ScanLine } from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useRedemptionsForMerchant } from '@/lib/merchantQueries'
import { useUser } from '@/lib/stores'
import { getCoupon } from '@/data/mockData'
import { formatRedeemedDate, formatMoney } from '@/lib/format'

export function AdminClientesPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const redemptions = useRedemptionsForMerchant(merchantId)
  const user = useUser()

  if (redemptions.length === 0) {
    return <LockedState />
  }

  // En el MVP demo solo hay un user (el vecino del browser actual)
  const totalAhorro = redemptions.reduce((s, r) => s + (r.ahorroEstimado ?? 0), 0)
  const firstAt = redemptions[redemptions.length - 1]?.redeemedAt
  const lastAt = redemptions[0]?.redeemedAt

  function handleExport() {
    const rows = [
      ['Nombre', 'DNI', 'Email', 'WhatsApp', 'Primer canje', 'Último canje', 'Cantidad de canjes'],
      [
        user?.nombre ?? 'Sin datos',
        user?.dni ?? '',
        user?.email ?? '',
        user?.whatsapp ?? '',
        firstAt ?? '',
        lastAt ?? '',
        String(redemptions.length),
      ],
    ]
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes-${merchantId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <Users size={12} /> Mis clientes
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Vecinos que canjearon en tu comercio
        </h1>
        <p className="text-sm text-neutral-500">
          Esta base es exclusiva de los vecinos que ya pasaron por tu local. La base general de Mi
          San Pedro nunca se entrega.
        </p>
      </header>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-900 p-4 text-white">
        <div>
          <p className="text-2xl font-bold tabular-nums">1</p>
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
            Cliente único
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-4 py-2 text-xs font-bold text-white shadow-cta transition-all hover:-translate-y-0.5"
        >
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      {user && (
        <Link
          to="#"
          className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card ring-1 ring-neutral-100 transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-white text-sm font-bold shadow-cta">
            {user.nombre
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-bold text-neutral-900">{user.nombre}</p>
            <p className="truncate text-xs text-neutral-500">
              Último canje · {lastAt ? formatRedeemedDate(lastAt) : '—'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-bold text-status-success-fg tabular-nums">
              {formatMoney(totalAhorro)}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              {redemptions.length} {redemptions.length === 1 ? 'canje' : 'canjes'}
            </p>
          </div>
        </Link>
      )}

      <div className="rounded-2xl bg-accent-50 p-4 text-accent-800 ring-1 ring-accent-100">
        <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">
          Próximo paso
        </p>
        <p className="mt-1 text-xs font-medium">
          La campaña masiva por WhatsApp Business llega en la próxima fase. Vas a poder mandar hasta
          4 mensajes por mes a tu base.
        </p>
      </div>

      <h3 className="mt-4 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
        Historial de canjes
      </h3>
      <div className="flex flex-col gap-2">
        {redemptions.map((r) => {
          const c = getCoupon(r.couponId)
          if (!c || !r.redeemedAt) return null
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-neutral-100"
            >
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent-50 text-accent-700 text-xs font-bold tabular-nums">
                {c.porcentaje}%
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold text-neutral-900">{c.titulo}</p>
                <p className="text-xs text-neutral-500">{formatRedeemedDate(r.redeemedAt)}</p>
              </div>
              <p className="shrink-0 text-xs font-bold text-status-success-fg tabular-nums">
                {formatMoney(r.ahorroEstimado ?? 0)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LockedState() {
  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 pt-12 pb-8 text-center sm:px-6 sm:pt-16">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-primary-100 text-neutral-500 shadow-card">
        <Lock size={36} />
      </div>
      <div>
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <Users size={12} /> Mis clientes
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          Acá vas a ver a tus clientes Mi San Pedro
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Esta sección se desbloquea cuando valides tu primer cupón. Cada cliente que canjee en tu
          local va a aparecer acá con sus datos de contacto.
        </p>
      </div>
      <Link
        to="/admin/validar"
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3 text-sm font-bold text-white shadow-cta transition-all hover:-translate-y-0.5"
      >
        <ScanLine size={16} /> Ir a validar un cupón
      </Link>
    </div>
  )
}
