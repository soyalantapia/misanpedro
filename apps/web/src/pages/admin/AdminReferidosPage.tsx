import { useState } from 'react'
import {
  Gift,
  Sparkles,
  Copy,
  Check,
  MessageCircle,
  Clock,
  Users,
  CheckCircle2,
  CalendarClock,
  Store,
  ShieldCheck,
} from 'lucide-react'
import { useReferralsMe, useReferralsMine } from '@/lib/apiQueries'
import { useToast } from '@/components/Toast'
import { useTenant } from '@/lib/tenant'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'
import { TOTAL_CUPOS } from '@/lib/launch'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function AdminReferidosPage() {
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi Ciudad'
  const { data, loading, error, refetch } = useReferralsMe()
  const referidos = useReferralsMine()
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const link = data?.link ?? ''
  const shareText = `¡Sumá tu comercio a ${appName}! Gratis hasta los primeros ${TOTAL_CUPOS} comercios, sin tarjeta, y si entrás con mi link te llevás 15 días extra 👉 ${link}`
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Link copiado', 'Pegalo donde quieras compartirlo.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No pudimos copiar', 'Copialo manualmente desde el campo.')
    }
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-strong">
          <Gift size={12} /> Recomendá y ganá
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Sumá comercios y ganá semanas gratis
        </h1>
        <p className="text-sm text-ink-soft">
          Por cada comercio que invites y publique su primer descuento, te regalamos{' '}
          <strong className="text-ink">1 semana gratis</strong> (hasta {data?.cap ?? 8}). Y
          tu colega arranca con <strong className="text-ink">15 días extra</strong>.
        </p>
      </header>

      {loading && <ReferidosSkeleton />}

      {!loading && error && (
        <div className="flex flex-col items-start gap-3 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
          <p className="text-sm text-ink-soft">
            No pudimos cargar tu link de referido. Revisá tu conexión e intentá de nuevo.
          </p>
          <button
            type="button"
            onClick={refetch}
            className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-on-brand shadow-cta hover:-translate-y-0.5"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Card del link */}
          <div className="overflow-hidden rounded-3xl bg-surface shadow-floating ring-1 ring-line">
            <div className="bg-gradient-to-br from-brand to-brand-strong px-5 py-5 text-on-brand">
              <p className="text-[11px] font-bold uppercase tracking-widest text-on-brand">
                Tu código de referido
              </p>
              <p className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{data.code}</p>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  id="referral-link"
                  name="referral-link"
                  readOnly
                  value={link}
                  aria-label="Tu link de referido"
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-2xl bg-bg px-4 py-3 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label="Copiar link"
                  className={cn(
                    'grid w-12 shrink-0 place-items-center rounded-2xl ring-1 transition-colors',
                    copied
                      ? 'bg-status-success-bg text-status-success-fg ring-status-success/30'
                      : 'bg-surface-2 text-ink-soft ring-line hover:bg-surface-2',
                  )}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-6 py-3.5 text-base font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
              >
                <MessageCircle size={18} /> Compartir por WhatsApp
              </a>
            </div>
          </div>

          {/* Premio de dos lados */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-strong">
                <Gift size={10} /> Vos ganás
              </span>
              <p className="text-xl font-bold leading-tight text-ink">1 semana gratis</p>
              <p className="text-[11px] leading-snug text-ink-soft">por cada comercio (hasta 8 = 2 meses)</p>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-status-success-fg">
                <Sparkles size={10} /> Tu colega
              </span>
              <p className="text-xl font-bold leading-tight text-ink">15 días extra</p>
              <p className="text-[11px] leading-snug text-ink-soft">al publicar su primer descuento</p>
            </div>
          </div>

          {/* Recomendá tranquilo: el colega no arriesga nada */}
          <div className="flex items-start gap-3 rounded-2xl bg-status-success-bg/60 p-4 ring-1 ring-status-success/20">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-status-success-fg ring-1 ring-status-success/20">
              <ShieldCheck size={18} />
            </span>
            <p className="text-xs leading-relaxed text-status-success-fg">
              <strong>Recomendá tranquilo.</strong> Tu colega entra gratis, igual que vos, hasta que se
              completen los primeros {TOTAL_CUPOS} comercios, sin tarjeta ni compromiso: si no le
              sirve, no paga nada. Vos no arriesgás nada y sumás semanas.
            </p>
          </div>

          {/* Progreso */}
          <section className="flex flex-col gap-2.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
              Tu progreso
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat icon={Clock} label="Pendientes" value={String(data.pendientes)} />
              <Stat icon={Users} label="Confirmados" value={String(data.confirmados)} />
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-brand to-brand-strong p-4 text-on-brand shadow-cta">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-on-brand">
                  <CheckCircle2 size={12} /> Semanas ganadas
                </span>
                <span className="text-sm font-bold tabular-nums">
                  {data.weeksEarned} / {data.cap}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface/25">
                <div
                  className="h-full rounded-full bg-surface transition-all duration-500"
                  style={{ width: `${Math.min(100, (data.weeksEarned / Math.max(1, data.cap)) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-on-brand/90">
                {data.weeksEarned >= data.cap
                  ? '¡Llegaste al tope! Gracias por sumar comercios.'
                  : `Te quedan ${pluralize(data.cap - data.weeksEarned, 'semana')} por ganar.`}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                <CalendarClock size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
                  Tu período gratis llega hasta
                </p>
                <p className="text-base font-bold text-ink">{formatDate(data.freeTrialUntil)}</p>
              </div>
            </div>
          </section>

          {/* Tus referidos */}
          {referidos.data && (
            <section className="flex flex-col gap-2.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
                Tus referidos
              </p>
              {referidos.data.length === 0 ? (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/60 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                    <Users size={16} />
                  </span>
                  <p className="text-xs leading-snug text-ink-soft">
                    Todavía no invitaste a nadie.{' '}
                    <strong className="text-ink">Compartí tu link</strong> y acá vas a ver a
                    cada comercio que sumes.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {referidos.data.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-line"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                      <Store size={16} />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                      {r.nombre}
                    </p>
                    {r.status === 'confirmed' ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-success-bg px-2.5 py-1 text-[11px] font-bold text-status-success-fg">
                        <CheckCircle2 size={11} /> Activó · +1 semana
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-info-bg px-2.5 py-1 text-[11px] font-bold text-status-info-fg">
                        <Clock size={11} /> Se registró
                      </span>
                    )}
                  </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Cómo funciona */}
          <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
              <Sparkles size={12} className="text-brand" /> Cómo funciona
            </p>
            <Step n={1} title="Compartí tu link">
              Mandáselo por WhatsApp a otro comercio del barrio que quieras invitar.
            </Step>
            <Step n={2} title="Se registra con tu link">
              Cuando entra desde tu link, queda asociado a tu cuenta automáticamente.
            </Step>
            <Step n={3} title="Publica su primer descuento">
              Ahí se confirma: vos ganás 1 semana y tu colega arranca con 15 días extra de prueba.
            </Step>
            <p className="mt-1 text-[11px] leading-snug text-ink-faint">
              Por cada comercio que se registra con tu link y publica su primer descuento: vos
              ganás 1 semana (tope {data.cap}) y el referido, 15 días extra. No vale referirte a
              vos mismo.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Clock
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-2xl px-3 py-3.5 text-center shadow-card ring-1 ring-line',
        accent ? 'bg-gradient-to-br from-brand to-brand-strong text-on-brand' : 'bg-surface',
      )}
    >
      <Icon size={16} className={cn('mx-auto', accent ? 'text-on-brand' : 'text-brand')} />
      <p
        className={cn(
          'text-2xl font-bold tabular-nums leading-none',
          accent ? 'text-on-brand' : 'text-ink',
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          'text-[10px] font-bold uppercase tracking-widest leading-tight',
          accent ? 'text-on-brand' : 'text-ink-soft',
        )}
      >
        {label}
      </p>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">
        {n}
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="text-xs leading-snug text-ink-soft">{children}</p>
      </div>
    </div>
  )
}

function ReferidosSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-44 w-full animate-pulse rounded-3xl bg-surface shadow-card" />
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface shadow-card" />
        ))}
      </div>
    </div>
  )
}
