import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Plus, Trash2, Check, X, Store } from 'lucide-react'
import { PushToggle, MatchFeed } from '@/components/AlertsBell'
import {
  useAlerts,
  addAlert,
  removeAlert,
  toggleAlert,
  couponsForAlert,
  markAllSeen,
  type Alert,
} from '@/lib/alerts'
import { useApiMerchants } from '@/lib/apiQueries'
import { CATEGORIAS, type Categoria } from '@/lib/types'
import { cn } from '@/lib/cn'

const MIN_OPTS = [
  { v: 0, l: 'Cualquiera' },
  { v: 10, l: '10%+' },
  { v: 20, l: '20%+' },
  { v: 30, l: '30%+' },
  { v: 40, l: '40%+' },
  { v: 50, l: '50%+' },
]

function catLabel(id: Categoria): string {
  return CATEGORIAS.find((c) => c.id === id)?.label ?? id
}

function alertTitle(a: Alert): string {
  const cats =
    a.categorias.length === 0
      ? 'Todos los rubros'
      : a.categorias.map(catLabel).join(', ')
  const min = a.minDescuento ? ` · desde ${a.minDescuento}%` : ''
  const com = a.merchantNombre ? ` · ${a.merchantNombre}` : ''
  return cats + min + com
}

export function AlertasPage() {
  const navigate = useNavigate()
  const { alerts, feed } = useAlerts()
  const merchantsRes = useApiMerchants()
  const merchants = merchantsRes.data ?? []
  const [showForm, setShowForm] = useState(false)

  // Ver la página = ver las alertas → marcamos como vistas.
  useEffect(() => {
    const t = setTimeout(markAllSeen, 400)
    return () => clearTimeout(t)
  }, [])

  const open = (id: string) => navigate(`/cupon/${id}`)
  const hasActive = alerts.some((a) => a.activa)

  return (
    <div className="animate-fade-up mx-auto w-full max-w-2xl px-4 py-6 pb-32 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-fin-lime/15 text-fin-lime">
          <Bell size={20} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fin-ink">Alertas</h1>
          <p className="text-sm text-fin-soft">Pactá lo que te interesa y lo tenés a mano.</p>
        </div>
      </header>

      <PushToggle />

      {/* Mis alertas */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">
          Mis alertas
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-fin-lime px-3.5 py-2 text-xs font-bold text-fin-bg shadow-fin-glow transition-transform hover:-translate-y-0.5"
          >
            <Plus size={14} /> Nueva alerta
          </button>
        )}
      </div>

      {showForm && (
        <CreateAlertForm
          merchants={merchants}
          onCancel={() => setShowForm(false)}
          onCreate={(input) => {
            addAlert(input)
            setShowForm(false)
          }}
        />
      )}

      {alerts.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-fin-surface2 px-4 py-10 text-center ring-1 ring-fin-line">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-fin-bg text-fin-lime">
            <Bell size={20} />
          </span>
          <p className="max-w-xs text-sm text-fin-soft">
            Todavía no pactaste alertas. Creá una y te avisamos cuando salga un descuento que te
            interese.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-fin-lime px-4 py-2.5 text-sm font-bold text-fin-bg shadow-fin-glow"
          >
            <Plus size={16} /> Crear mi primera alerta
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </ul>
      )}

      {/* Cupones que coinciden */}
      {hasActive && (
        <div className="mt-8">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
            Cupones para vos
          </h2>
          <MatchFeed
            coupons={feed}
            onOpen={open}
            emptyText="Por ahora no hay cupones que coincidan con tus alertas. Te avisamos cuando salgan."
          />
        </div>
      )}
    </div>
  )
}

function AlertCard({ alert: a }: { alert: Alert }) {
  const count = couponsForAlert(a.id).length
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-fin-line bg-fin-surface p-3.5 shadow-fin-card transition-opacity',
        !a.activa && 'opacity-60',
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fin-lime/15 text-fin-lime">
        <Bell size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-fin-ink">{alertTitle(a)}</p>
        <p className="text-xs text-fin-soft">
          {a.activa
            ? count > 0
              ? `${count} ${count === 1 ? 'cupón coincide' : 'cupones coinciden'} ahora`
              : 'Sin coincidencias por ahora'
            : 'Pausada'}
        </p>
      </div>
      {/* on/off */}
      <button
        type="button"
        role="switch"
        aria-checked={a.activa}
        aria-label={a.activa ? 'Pausar alerta' : 'Activar alerta'}
        onClick={() => toggleAlert(a.id)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
          a.activa ? 'bg-fin-lime' : 'bg-fin-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all duration-200',
            a.activa ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
      <button
        type="button"
        aria-label="Eliminar alerta"
        onClick={() => removeAlert(a.id)}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fin-faint transition-colors hover:bg-fin-surface2 hover:text-fin-danger"
      >
        <Trash2 size={16} />
      </button>
    </li>
  )
}

function CreateAlertForm({
  merchants,
  onCreate,
  onCancel,
}: {
  merchants: { slug: string; nombre: string }[]
  onCreate: (input: {
    categorias: Categoria[]
    minDescuento: number
    merchantSlug?: string
    merchantNombre?: string
  }) => void
  onCancel: () => void
}) {
  const [cats, setCats] = useState<Categoria[]>([])
  const [min, setMin] = useState(0)
  const [merchantSlug, setMerchantSlug] = useState('')

  function toggleCat(id: Categoria) {
    setCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function submit() {
    const m = merchants.find((x) => x.slug === merchantSlug)
    onCreate({
      categorias: cats,
      minDescuento: min,
      merchantSlug: merchantSlug || undefined,
      merchantNombre: m?.nombre,
    })
  }

  return (
    <div className="mb-3 rounded-2xl border border-fin-line bg-fin-surface p-4 shadow-fin-card">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-fin-ink">Nueva alerta</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar"
          className="grid h-7 w-7 place-items-center rounded-full text-fin-faint hover:bg-fin-surface2"
        >
          <X size={15} />
        </button>
      </div>

      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
        Rubros <span className="font-medium normal-case text-fin-soft">(ninguno = todos)</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.map((c) => {
          const active = cats.includes(c.id)
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggleCat(c.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                active
                  ? 'bg-fin-lime text-fin-bg shadow-fin-glow'
                  : 'bg-fin-surface2 text-fin-soft ring-1 ring-fin-line hover:text-fin-ink',
              )}
            >
              {active && <Check size={11} />}
              {c.label}
            </button>
          )
        })}
      </div>

      <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
        Descuento mínimo
      </p>
      <div className="flex flex-wrap gap-2">
        {MIN_OPTS.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={min === o.v}
            onClick={() => setMin(o.v)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200',
              min === o.v
                ? 'bg-fin-lime text-fin-bg shadow-fin-glow'
                : 'bg-fin-surface2 text-fin-soft ring-1 ring-fin-line hover:text-fin-ink',
            )}
          >
            {o.l}
          </button>
        ))}
      </div>

      <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
        Comercio <span className="font-medium normal-case text-fin-soft">(opcional)</span>
      </p>
      <div className="relative">
        <Store
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fin-faint"
        />
        <select
          value={merchantSlug}
          onChange={(e) => setMerchantSlug(e.target.value)}
          className="w-full appearance-none rounded-xl border border-fin-line bg-fin-bg py-2.5 pl-9 pr-3 text-sm text-fin-ink focus:border-fin-lime focus:outline-none"
        >
          <option value="">Cualquier comercio</option>
          {merchants.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={submit}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-fin-lime px-4 py-3 text-sm font-bold text-fin-bg shadow-fin-glow transition-transform hover:-translate-y-0.5"
      >
        <Plus size={16} /> Crear alerta
      </button>
    </div>
  )
}
