import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  Lock,
  Users,
  Download,
  ScanLine,
  Search,
  AlertTriangle,
  X,
  WifiOff,
  RotateCw,
} from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useClientsForMerchant } from '@/lib/merchantQueries'
import { formatRedeemedDate, formatMoney } from '@/lib/format'
import { useToast } from '@/components/Toast'
import { useApiMerchantClientes } from '@/lib/apiQueries'

type Client = {
  user: { id: string; nombre: string; dni: string; email: string; whatsapp: string }
  count: number
  totalAhorro: number
  firstRedeemedAt: string
  lastRedeemedAt: string
}

export function AdminClientesPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const localClients = useClientsForMerchant(merchantId)
  const apiClients = useApiMerchantClientes()
  const [search, setSearch] = useState('')
  const [showExportConfirm, setShowExportConfirm] = useState(false)
  const toast = useToast()

  // Normalizamos: el API trae los campos planos; el local tiene `user` anidado
  const clients: Client[] = apiClients.data
    ? apiClients.data.map((c: any) => ({
        user: {
          id: c.userId,
          nombre: c.nombre ?? 'Vecino',
          dni: c.dni ?? '',
          email: c.email ?? '',
          whatsapp: c.whatsapp ?? '',
        },
        count: c.canjes,
        totalAhorro: c.ahorroTotal,
        firstRedeemedAt: c.primerCanjeAt,
        lastRedeemedAt: c.ultimoCanjeAt,
      }))
    : (localClients as unknown as Client[])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) =>
        c.user.nombre.toLowerCase().includes(q) ||
        c.user.email.toLowerCase().includes(q) ||
        c.user.dni.includes(q),
    )
  }, [clients, search])

  const apiError = apiClients.error
  // Sin conexión: el API falló y no tenemos clientes para mostrar.
  if (apiError && clients.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-ink-soft ring-1 ring-line">
          <WifiOff size={24} />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-ink">Sin conexión</h2>
          <p className="text-sm text-ink-soft">
            No pudimos cargar tus clientes. Revisá tu conexión y reintentá.
          </p>
        </div>
        <button
          type="button"
          onClick={() => apiClients.refetch()}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
        >
          <RotateCw size={16} /> Reintentar
        </button>
      </div>
    )
  }

  // Flash de vacío: mientras carga la primera vez no hay datos todavía;
  // mostramos un skeleton en lugar de renderizar todo en cero.
  if (apiClients.loading && clients.length === 0) {
    return <LoadingState />
  }

  if (!apiClients.loading && clients.length === 0) {
    return <LockedState />
  }

  const totalUnique = clients.length
  const totalCanjes = clients.reduce((s, c) => s + c.count, 0)
  const totalAhorro = clients.reduce((s, c) => s + c.totalAhorro, 0)

  function doExport() {
    try {
      const rows = [
        [
          'Nombre',
          'DNI',
          'Email',
          'WhatsApp',
          'Primer canje',
          'Último canje',
          'Cantidad de canjes',
          'Ahorro generado',
        ],
        ...clients.map((c) => [
          c.user.nombre,
          c.user.dni,
          c.user.email,
          c.user.whatsapp,
          c.firstRedeemedAt,
          c.lastRedeemedAt,
          String(c.count),
          String(c.totalAhorro),
        ]),
      ]
      const csv = rows
        .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clientes-${merchantId}-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setShowExportConfirm(false)
      toast.success(
        'CSV descargado',
        `${clients.length} ${clients.length === 1 ? 'cliente exportado' : 'clientes exportados'}.`,
      )
    } catch {
      setShowExportConfirm(false)
      toast.error('No se pudo exportar', 'Volvé a intentarlo en unos segundos.')
    }
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-strong">
          <Users size={12} /> Mis clientes
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Vecinos que canjearon en tu comercio
        </h1>
        <p className="text-sm text-ink-soft">
          Esta base es exclusiva de los vecinos que pasaron por tu local. La base general de la
          plataforma nunca se entrega.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl bg-ink text-on-brand shadow-card">
        <div className="flex items-start justify-between gap-3 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">
              Ahorro generado a clientes
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
              {formatMoney(totalAhorro)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowExportConfirm(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-brand to-brand-strong px-3.5 py-2 text-xs font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
          >
            <Download size={13} /> CSV
          </button>
        </div>
        <div className="grid grid-cols-2 border-t border-white/10">
          <div className="border-r border-white/10 px-5 py-3.5">
            <p className="text-xl font-bold tabular-nums leading-tight">{totalUnique}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">
              {totalUnique === 1 ? 'Cliente único' : 'Clientes únicos'}
            </p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-xl font-bold tabular-nums leading-tight">{totalCanjes}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">
              {totalCanjes === 1 ? 'Canje total' : 'Canjes totales'}
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          type="search"
          id="clientes-search"
          name="clientes-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o DNI…"
          aria-label="Buscar clientes"
          className="w-full rounded-2xl bg-surface py-3 pl-10 pr-4 text-sm shadow-card ring-1 ring-line placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((c, i) => {
          const initials = c.user.nombre
            .split(' ')
            .map((p) => p[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()
          return (
            <Link
              key={c.user.id}
              to={`/admin/clientes/${c.user.id}`}
              style={{ animationDelay: `${i * 40}ms` }}
              className="animate-fade-up flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-card ring-1 ring-line transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-strong text-on-brand text-sm font-bold shadow-cta">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold text-ink">{c.user.nombre}</p>
                <p className="truncate text-xs text-ink-soft">
                  {formatRedeemedDate(c.lastRedeemedAt)}{' '}
                  {c.count > 1 ? `· ${c.count} canjes en total` : '· 1ra visita'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold text-status-success-fg tabular-nums">
                  {formatMoney(c.totalAhorro)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">
                  ahorrado
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p role="status" aria-live="polite" className="text-center text-sm text-ink-faint">
          No hay clientes que coincidan con "{search}".
        </p>
      )}

      <div className="rounded-2xl bg-brand-soft p-4 text-brand-strong ring-1 ring-line">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-strong">
          Próximo paso
        </p>
        <p className="mt-1 text-xs font-medium">
          Mandá un mensaje masivo a tu base via WhatsApp Business.{' '}
          <Link to="/admin/whatsapp" className="font-bold underline-offset-2 hover:underline">
            Ir al composer
          </Link>
        </p>
      </div>

      {/* Modal de confirmación para exportar PII */}
      {showExportConfirm && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-dialog-title"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowExportConfirm(false)}
          />
          <div className="relative z-10 mx-4 w-full max-w-md rounded-3xl bg-surface p-6 shadow-floating ring-1 ring-line sm:mx-auto">
            <button
              type="button"
              onClick={() => setShowExportConfirm(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink"
            >
              <X size={16} />
            </button>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-600">
              <AlertTriangle size={22} />
            </div>
            <h2
              id="export-dialog-title"
              className="text-lg font-bold text-ink"
            >
              Exportar datos de clientes
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              El CSV incluye <span className="font-semibold text-ink">nombre, DNI, email y WhatsApp</span> de{' '}
              <span className="font-semibold text-ink">{clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}</span>.
              Guardalo de forma segura y usalo solo para comunicaciones relacionadas con tu comercio.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowExportConfirm(false)}
                className="flex-1 rounded-2xl bg-surface-2 px-4 py-3 text-sm font-bold text-ink transition-all hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doExport}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-4 py-3 text-sm font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
              >
                <Download size={14} /> Descargar CSV
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}


function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10"
    >
      <span className="sr-only">Cargando tus clientes…</span>
      <div className="flex flex-col gap-2">
        <div className="h-6 w-40 animate-pulse rounded-full bg-surface-2" />
        <div className="h-9 w-3/4 animate-pulse rounded-2xl bg-surface-2" />
      </div>
      <div className="h-36 animate-pulse rounded-3xl bg-surface-2" />
      <div className="h-12 animate-pulse rounded-2xl bg-surface-2" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-3xl bg-surface-2" />
        ))}
      </div>
    </div>
  )
}

function LockedState() {
  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 pt-12 pb-8 text-center sm:px-6 sm:pt-16">
      {/* N8: chip ARRIBA del candado para seguir la convención visual del
          resto del panel (chip → ícono → título → descripción → CTA). Antes
          el chip estaba debajo del candado, rompiendo la jerarquía esperada. */}
      <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-strong">
        <Users size={12} /> Mis clientes
      </div>
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-surface-2 text-ink-soft shadow-card">
        <Lock size={36} />
      </div>
      <div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
          Acá vas a ver a tus clientes de Mi San Pedro
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Esta sección se desbloquea cuando valides tu primer descuento. Cada cliente que canjee en
          tu local va a aparecer acá con sus datos de contacto.
        </p>
      </div>
      <Link
        to="/admin/validar"
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand to-brand-strong px-6 py-3 text-sm font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
      >
        <ScanLine size={16} /> Ir a validar un descuento
      </Link>
    </div>
  )
}
