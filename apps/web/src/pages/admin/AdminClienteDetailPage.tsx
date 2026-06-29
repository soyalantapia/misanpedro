import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Mail,
  Phone,
  IdCard,
  Cake,
  Clock,
  TrendingUp,
  Calendar,
  ShieldCheck,
  Sparkles,
  MessageCircle,
  StickyNote,
  Trash2,
  Plus,
} from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useTenant } from '@/lib/tenant'
import { useClientForMerchant } from '@/lib/merchantQueries'
import { useCoupons } from '@/lib/couponsStore'
import { formatMoney, formatRedeemedDate, formatBirthdate } from '@/lib/format'
import {
  useApiMerchantClientes,
  useApiRecentRedemptions,
  useApiMyCoupons,
} from '@/lib/apiQueries'
import { customerNotes, ApiError } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Activation } from '@/lib/types'

export function AdminClienteDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const { session } = useMerchantSession()
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi Ciudad'
  const merchantId = session?.merchantId ?? ''
  const localClient = useClientForMerchant(merchantId, userId)
  const localCoupons = useCoupons()
  const apiClientes = useApiMerchantClientes()
  const apiRedemptions = useApiRecentRedemptions(500)
  const apiCoupons = useApiMyCoupons()

  // Si tenemos data del API, construimos el cliente desde la API
  const apiClient = useMemo(() => {
    if (!apiClientes.data || !apiRedemptions.data) return null
    const c: any = apiClientes.data.find((cl: any) => cl.userId === userId)
    if (!c) return null
    const userRedemptions = apiRedemptions.data.filter(
      (r: any) => r.userId === userId,
    )
    return {
      user: {
        id: c.userId,
        nombre: c.nombre ?? 'Vecino',
        dni: c.dni ?? '',
        email: c.email ?? '',
        whatsapp: c.whatsapp ?? '',
        fechaNacimiento: c.fechaNacimiento ?? '',
        acceptedTcAt: '',
        createdAt: '',
      },
      redemptions: userRedemptions.map(
        (r: any): Activation => ({
          id: r.id,
          couponId: String(r.couponId),
          userId: String(r.userId),
          codigoNumerico: '',
          qrPayload: '',
          activatedAt: r.redeemedAt,
          expiresAt: r.redeemedAt,
          status: 'canjeado' as const,
          redeemedAt: r.redeemedAt,
          ahorroEstimado: r.ahorroEstimado,
          montoTicket: r.montoTicket,
        }),
      ),
      totalAhorro: c.ahorroTotal,
      firstRedeemedAt: c.primerCanjeAt,
      lastRedeemedAt: c.ultimoCanjeAt,
      count: c.canjes,
    }
  }, [apiClientes.data, apiRedemptions.data, userId])

  // Mergeamos cupones para que los couponId de Mongo se resuelvan.
  const couponMap = useMemo(() => {
    const m = new Map<string, { id: string; titulo: string; porcentaje: number; merchantId: string }>()
    // Bugs #2/LTV/favorito: sembramos PRIMERO con el snapshot que viene embebido
    // en cada canje (/recent → r.coupon), para que un cupón borrado/pausado/
    // vencido (ausente del catálogo activo) igual resuelva título + %. El catálogo
    // vivo de abajo lo pisa con el dato más fresco cuando el cupón aún existe.
    apiRedemptions.data?.forEach((r: any) => {
      if (r.coupon && !m.has(String(r.couponId))) {
        m.set(String(r.couponId), {
          id: String(r.couponId),
          titulo: r.coupon.titulo,
          porcentaje: r.coupon.porcentaje ?? 0,
          merchantId: '',
        })
      }
    })
    localCoupons.forEach((c) =>
      m.set(c.id, {
        id: c.id,
        titulo: c.titulo,
        porcentaje: c.porcentaje,
        merchantId: c.merchantId,
      }),
    )
    apiCoupons.data?.forEach((c) =>
      m.set(c.id, {
        id: c.id,
        titulo: c.titulo,
        porcentaje: c.porcentaje,
        merchantId: c.merchantId,
      }),
    )
    return m
  }, [localCoupons, apiCoupons.data, apiRedemptions.data])

  const client = apiClient ?? localClient

  // Si todavía está cargando del API, no redirigir
  const stillLoading = apiClientes.loading || apiRedemptions.loading
  if (!client && !stillLoading && !localClient) {
    return <Navigate to="/admin/clientes" replace />
  }
  if (!client) return null

  const { user, redemptions, totalAhorro, firstRedeemedAt, lastRedeemedAt, count } = client
  const sortedDesc = [...redemptions].sort(
    (a, b) =>
      new Date(b.redeemedAt!).getTime() - new Date(a.redeemedAt!).getTime(),
  )

  const monthsActive = monthsSince(firstRedeemedAt)
  const avgPerMonth =
    monthsActive > 0 ? Math.round((count / monthsActive) * 10) / 10 : count

  // LTV (Lifetime Value): suma estimada de los tickets que el cliente gastó
  // en este comercio. Para cada canje:
  //   ticket_estimado = ahorro / (porcentaje / 100)
  // Es una estimación porque solo registramos el ahorro, no el ticket exacto.
  // LTV: con el snapshot del cupón (arriba) hoy resuelven todos los canjes;
  // para canjes legacy sin snapshot ni cupón vivo, contamos cuántos entraron
  // al LTV y dividimos por ESE total (no por `count`), así LTV y ticket promedio
  // quedan consistentes entre sí (bug LTV/ticket subestimado).
  let ltvCount = 0
  const ltv = redemptions.reduce((s, r) => {
    const c = couponMap.get(r.couponId)
    if (!c || !r.ahorroEstimado || c.porcentaje === 0) return s
    ltvCount += 1
    return s + (r.ahorroEstimado * 100) / c.porcentaje
  }, 0)
  const avgTicket = ltvCount > 0 ? Math.round(ltv / ltvCount) : 0

  const dayCount = new Map<number, number>()
  redemptions.forEach((r) => {
    if (!r.redeemedAt) return
    const d = new Date(r.redeemedAt).getDay()
    dayCount.set(d, (dayCount.get(d) ?? 0) + 1)
  })
  const topDay = [...dayCount.entries()].sort((a, b) => b[1] - a[1])[0]
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  const couponCount = new Map<string, number>()
  redemptions.forEach((r) => {
    couponCount.set(r.couponId, (couponCount.get(r.couponId) ?? 0) + 1)
  })
  const topCoupon = [...couponCount.entries()].sort((a, b) => b[1] - a[1])[0]
  const topCouponData = topCoupon ? couponMap.get(topCoupon[0]) : undefined

  const initials = user.nombre
    .split(' ')
    .map((p: string) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const edad = ageFrom(user.fechaNacimiento)

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/admin/clientes"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ChevronLeft size={16} /> Mis clientes
      </Link>

      <header className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-2xl font-bold text-on-brand shadow-cta">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
            {user.nombre}
          </h1>
          <p className="text-xs text-ink-soft">
            Cliente {appName} · desde {formatRedeemedDate(firstRedeemedAt)}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2.5">
        <BigStat
          label="Dinero ahorrado"
          value={formatMoney(totalAhorro)}
          icon={TrendingUp}
          accent
        />
        <BigStat label="Total de canjes" value={String(count)} icon={Calendar} />
      </section>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-emerald-50 to-brand-soft p-5 ring-1 ring-emerald-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200">
              <TrendingUp size={11} /> LTV · valor del cliente
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-ink sm:text-4xl">
              {formatMoney(ltv)}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-ink-soft">
              Ticket promedio:{' '}
              <span className="font-bold text-ink tabular-nums">
                {formatMoney(avgTicket)}
              </span>
            </p>
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-surface/70 p-3 text-[11px] leading-snug text-ink ring-1 ring-emerald-100/60">
          <span className="font-bold text-ink">¿Qué significa?</span> El LTV (Lifetime
          Value) es la suma estimada de todo lo que este cliente gastó en tu comercio. Lo
          calculamos a partir del ahorro generado y el porcentaje de cada descuento canjeado.
          Cuanto más alto, más valioso es el cliente para tu negocio.
        </p>
      </section>

      <section className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Datos personales
        </h2>
        <div className="mt-3 flex flex-col gap-2.5 text-sm">
          <Row icon={IdCard} label="DNI">
            {user.dni}
          </Row>
          <Row icon={Mail} label="Email">
            <a href={`mailto:${user.email}`} className="text-brand-strong hover:underline">
              {user.email}
            </a>
          </Row>
          <Row icon={Phone} label="WhatsApp">
            <a
              href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-brand-strong hover:underline"
            >
              {user.whatsapp} <MessageCircle size={11} />
            </a>
          </Row>
          <Row icon={Cake} label="Nacimiento">
            {formatBirthdate(user.fechaNacimiento)}
            {edad !== null && <span className="ml-1 text-ink-faint">· {edad} años</span>}
          </Row>
        </div>
      </section>

      {userId && <NotesSection userId={userId} />}

      <section>
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Patrones de visita
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <PatternCard
            icon={Calendar}
            label="Día más visitado"
            value={topDay ? dayNames[topDay[0]] : '—'}
            sub={topDay ? `${topDay[1]} ${topDay[1] === 1 ? 'visita' : 'visitas'}` : undefined}
          />
          <PatternCard
            icon={TrendingUp}
            label="Frecuencia"
            // Bug #16: un cliente recién llegado (monthsActive===0) no tiene
            // cadencia mensual — mostramos cantidad de canjes, no "N/mes".
            value={
              monthsActive > 0
                ? `${avgPerMonth}/mes`
                : `${count} ${count === 1 ? 'canje' : 'canjes'}`
            }
            sub={
              monthsActive > 0
                ? `${monthsActive} ${monthsActive === 1 ? 'mes' : 'meses'} de actividad`
                : 'Cliente nuevo'
            }
          />
          <PatternCard
            icon={Sparkles}
            label="Descuento favorito"
            value={topCouponData?.titulo ?? '—'}
            sub={topCoupon ? `${topCoupon[1]}× usado` : undefined}
          />
          <PatternCard
            icon={Clock}
            label="Última visita"
            value={formatRedeemedDate(lastRedeemedAt)}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Historial completo · {count} {count === 1 ? 'canje' : 'canjes'}
        </h2>
        <div className="flex flex-col gap-2">
          {sortedDesc.map((r, i) => {
            const c = couponMap.get(r.couponId)
            if (!c || !r.redeemedAt) return null
            return (
              <div
                key={r.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className="animate-fade-up flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-line"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong font-bold tabular-nums">
                  {c.porcentaje}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{c.titulo}</p>
                  <p className="text-xs text-ink-soft">{formatRedeemedDate(r.redeemedAt)}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-status-success-fg tabular-nums">
                  {formatMoney(r.ahorroEstimado ?? 0)}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex items-start gap-2.5 rounded-2xl bg-status-info-bg p-4 text-status-info-fg">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <p className="text-xs font-medium">
          Estos datos son tuyos para gestionar tu relación con el cliente. No los compartas con
          terceros sin consentimiento expreso (Ley 25.326).
        </p>
      </div>

      {user.whatsapp && createPortal(
        <div
          className="fixed inset-x-0 bottom-24 z-30 border-t border-line bg-bg shadow-floating md:bottom-0"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6">
            <a
              href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer noopener"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-6 py-3.5 text-base font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
            >
              <MessageCircle size={16} /> Escribir por WhatsApp
            </a>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function BigStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: typeof TrendingUp
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-card ring-1 ring-line ${
        accent ? 'bg-gradient-to-br from-brand to-brand-strong text-on-brand' : 'bg-surface'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={accent ? 'text-on-brand' : 'text-brand'} />
        <p
          className={`text-[10px] font-bold uppercase tracking-widest ${accent ? 'text-on-brand/90' : 'text-ink-soft'}`}
        >
          {label}
        </p>
      </div>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${accent ? 'text-on-brand' : 'text-ink'}`}
      >
        {value}
      </p>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">
        <Icon size={14} />
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="text-right text-ink font-semibold">{children}</span>
      </div>
    </div>
  )
}

function PatternCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Calendar
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-card ring-1 ring-line">
      <div className="flex items-center gap-1.5 text-brand">
        <Icon size={12} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">{label}</p>
      </div>
      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
      {sub && <p className="text-[11px] text-ink-faint">{sub}</p>}
    </div>
  )
}

/** Meses (redondeados) desde la fecha dada. Bug #16: NO forzamos piso de 1 —
 *  un cliente con su primer (y único) canje hoy debe dar 0, así la card de
 *  Frecuencia cae en la rama 'Cliente nuevo' en vez de mostrar '1/mes · 1 mes
 *  de actividad', que insinúa una cadencia mensual inexistente. */
export function monthsSince(iso: string | undefined, nowMs = Date.now()): number {
  if (!iso) return 0
  const months = (nowMs - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30)
  return Math.max(0, Math.round(months))
}

function ageFrom(iso: string): number | null {
  if (!iso) return null
  const dob = new Date(iso)
  if (Number.isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

function NotesSection({ userId }: { userId: string }) {
  type Note = { id: string; text: string; tags: string[]; createdAt: string }
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null)
  const toast = useToast()

  async function refresh() {
    try {
      setLoading(true)
      const r = await customerNotes.list(userId)
      setNotes(r.notes)
    } catch (err) {
      // En modo offline o sin sesión API el endpoint no existe → silencioso
      if (!(err instanceof ApiError)) {
        // ignore
      }
      setNotes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (text.trim().length < 2) return
    setSubmitting(true)
    try {
      await customerNotes.create(userId, text.trim())
      setText('')
      toast.success('Nota guardada')
      refresh()
    } catch (err) {
      toast.error(
        'No se pudo guardar',
        err instanceof ApiError ? err.message : 'Sin conexión',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await customerNotes.delete(id)
      refresh()
    } catch {
      toast.error('No se pudo borrar')
    }
  }

  return (
    <section className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
        <StickyNote size={11} /> Notas internas
      </p>
      <p className="mt-1 text-[11px] text-ink-faint">
        Privadas para tu comercio. El cliente no las ve.
      </p>

      <form onSubmit={handleAdd} className="mt-3 flex items-stretch gap-2">
        <input
          type="text"
          id="nota-interna"
          name="nota-interna"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej: cliente VIP, preferencia café cortado…"
          aria-label="Nueva nota interna"
          maxLength={500}
          className="flex-1 rounded-2xl bg-bg px-4 py-2.5 text-sm ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={submitting || text.trim().length < 2}
          className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-3 py-2.5 text-xs font-bold text-on-brand shadow-cta disabled:opacity-50"
        >
          <Plus size={13} /> Guardar
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {loading ? (
          <p className="text-xs text-ink-faint">Cargando…</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-ink-faint">Sin notas todavía.</p>
        ) : (
          notes.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-2 rounded-2xl bg-bg p-3 ring-1 ring-line"
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-strong">
                <StickyNote size={10} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink">{n.text}</p>
                <p className="text-[10px] text-ink-faint">
                  {new Date(n.createdAt).toLocaleString('es-AR')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoteToDelete(n.id)}
                aria-label="Borrar nota"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-status-error-bg hover:text-status-error-fg"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!noteToDelete}
        title="¿Borrar esta nota?"
        description="La nota se eliminará permanentemente y no se podrá recuperar."
        confirmLabel="Sí, borrar"
        cancelLabel="Volver"
        variant="danger"
        onCancel={() => setNoteToDelete(null)}
        onConfirm={() => {
          if (noteToDelete) {
            void handleDelete(noteToDelete)
            setNoteToDelete(null)
          }
        }}
      />
    </section>
  )
}
