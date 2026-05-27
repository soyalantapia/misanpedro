import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Users, Download, ScanLine, Search } from 'lucide-react'
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

  if (clients.length === 0) {
    return <LockedState />
  }

  const totalUnique = clients.length
  const totalCanjes = clients.reduce((s, c) => s + c.count, 0)
  const totalAhorro = clients.reduce((s, c) => s + c.totalAhorro, 0)

  function handleExport() {
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
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes-${merchantId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV descargado', `${clients.length} ${clients.length === 1 ? "cliente exportado" : "clientes exportados"}.`)
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
          Esta base es exclusiva de los vecinos que pasaron por tu local. La base general de Mi
          San Pedro nunca se entrega.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl bg-neutral-900 text-white shadow-card">
        <div className="flex items-start justify-between gap-3 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Ahorro generado a clientes
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
              {formatMoney(totalAhorro)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold text-white shadow-cta transition-all hover:-translate-y-0.5"
          >
            <Download size={13} /> CSV
          </button>
        </div>
        <div className="grid grid-cols-2 border-t border-white/10">
          <div className="border-r border-white/10 px-5 py-3.5">
            <p className="text-xl font-bold tabular-nums leading-tight">{totalUnique}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              {totalUnique === 1 ? 'Cliente único' : 'Clientes únicos'}
            </p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-xl font-bold tabular-nums leading-tight">{totalCanjes}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              {totalCanjes === 1 ? 'Canje total' : 'Canjes totales'}
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o DNI…"
          aria-label="Buscar clientes"
          className="w-full rounded-2xl bg-white py-3 pl-10 pr-4 text-sm shadow-card ring-1 ring-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
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
              className="animate-fade-up flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card ring-1 ring-neutral-100 transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-white text-sm font-bold shadow-cta">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold text-neutral-900">{c.user.nombre}</p>
                <p className="truncate text-xs text-neutral-500">
                  {formatRedeemedDate(c.lastRedeemedAt)}{' '}
                  {c.count > 1 ? `· ${c.count} canjes en total` : '· 1ra visita'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold text-status-success-fg tabular-nums">
                  {formatMoney(c.totalAhorro)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  ahorrado
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-neutral-400">
          No hay clientes que coincidan con "{search}".
        </p>
      )}

      <div className="rounded-2xl bg-accent-50 p-4 text-accent-800 ring-1 ring-accent-100">
        <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">
          Próximo paso
        </p>
        <p className="mt-1 text-xs font-medium">
          Mandá un mensaje masivo a tu base via WhatsApp Business.{' '}
          <Link to="/admin/whatsapp" className="font-bold underline-offset-2 hover:underline">
            Ir al composer
          </Link>
        </p>
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
