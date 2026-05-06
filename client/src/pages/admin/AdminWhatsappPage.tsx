import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Send, ChevronDown, Users, Sparkles, Check } from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useRedemptionsForMerchant } from '@/lib/merchantQueries'
import { useUser } from '@/lib/stores'
import { whatsappActions, useWhatsappCampaigns } from '@/lib/whatsappStore'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatRedeemedDate } from '@/lib/format'
import { cn } from '@/lib/cn'

const MAX_PER_MONTH = 4

const TEMPLATES = [
  {
    id: 'tpl-promo',
    name: 'Nueva promoción',
    body: '¡Hola {{nombre}}! En {{comercio}} lanzamos un nuevo descuento del {{porcentaje}}% válido hasta el {{vigencia}}. Activá tu cupón y vení a vernos. {{link}}',
  },
  {
    id: 'tpl-recordatorio',
    name: 'Recordatorio de cupón',
    body: 'Hola {{nombre}}, te queda hasta el {{vigencia}} para usar tu descuento del {{porcentaje}}% en {{comercio}}. ¡No te lo pierdas! {{link}}',
  },
  {
    id: 'tpl-evento',
    name: 'Invitación a evento',
    body: '{{nombre}}, este {{vigencia}} hacemos evento especial en {{comercio}} con {{porcentaje}}% off para clientes Mi San Pedro. Te esperamos. {{link}}',
  },
] as const

const AUDIENCIAS = [
  { id: 'todos', label: 'Todos mis clientes', desc: 'Vecinos que canjearon al menos una vez' },
  { id: 'recurrentes', label: 'Recurrentes', desc: '2 o más canjes en el último mes' },
  { id: 'nuevos', label: 'Nuevos esta semana', desc: 'Primer canje en los últimos 7 días' },
] as const

type AudienciaId = (typeof AUDIENCIAS)[number]['id']

export function AdminWhatsappPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const redemptions = useRedemptionsForMerchant(merchantId)
  const user = useUser()
  const campaigns = useWhatsappCampaigns()
  const toast = useToast()

  const sentThisMonth = useMemo(() => {
    const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
    return campaigns.filter(
      (c) => c.merchantId === merchantId && new Date(c.sentAt).getTime() >= startMonth,
    ).length
  }, [campaigns, merchantId])

  const remaining = Math.max(0, MAX_PER_MONTH - sentThisMonth)
  const percent = Math.round((sentThisMonth / MAX_PER_MONTH) * 100)

  const audienceCount = useMemo(() => {
    if (redemptions.length === 0) return { todos: 0, recurrentes: 0, nuevos: 0 }
    const now = Date.now()
    const week = now - 7 * 24 * 60 * 60 * 1000
    const month = now - 30 * 24 * 60 * 60 * 1000
    const inLastMonth = redemptions.filter(
      (r) => r.redeemedAt && new Date(r.redeemedAt).getTime() >= month,
    ).length
    const inLastWeek = redemptions.filter(
      (r) => r.redeemedAt && new Date(r.redeemedAt).getTime() >= week,
    ).length
    return {
      todos: 1, // mock: 1 vecino registrado en demo
      recurrentes: inLastMonth >= 2 ? 1 : 0,
      nuevos: inLastWeek > 0 ? 1 : 0,
    }
  }, [redemptions])

  const [audiencia, setAudiencia] = useState<AudienciaId>('todos')
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id)
  const [porcentaje, setPorcentaje] = useState('20')
  const [vigencia, setVigencia] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  })
  const [confirmSend, setConfirmSend] = useState(false)

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]
  const audienceItem = AUDIENCIAS.find((a) => a.id === audiencia)!
  const recipients = audienceCount[audiencia]

  const rendered = template.body
    .replace('{{nombre}}', user?.nombre.split(' ')[0] ?? 'vecin@')
    .replace('{{comercio}}', session?.merchantId ?? 'tu comercio')
    .replace('{{porcentaje}}', porcentaje)
    .replace('{{vigencia}}', vigencia)
    .replace('{{link}}', 'misanpedro.app/cupones')

  function handleSend() {
    if (!session) return
    if (recipients === 0) {
      toast.warning('Sin destinatarios', 'No hay clientes para esta audiencia.')
      setConfirmSend(false)
      return
    }
    whatsappActions.send({
      merchantId: session.merchantId,
      templateId,
      audiencia: audienceItem.label,
      rendered,
      sentCount: recipients,
    })
    toast.success('Campaña enviada', `Se envió a ${recipients} ${recipients === 1 ? 'cliente' : 'clientes'}.`)
    setConfirmSend(false)
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <MessageCircle size={12} /> Promociones
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          WhatsApp masivo
        </h1>
        <p className="text-sm text-neutral-500">
          Mandale un mensaje a tus clientes Mi San Pedro vía la API oficial de WhatsApp Business.
          Hasta 4 envíos por mes.
        </p>
      </header>

      <div className="rounded-3xl bg-gradient-to-br from-accent-400 to-accent-600 p-5 text-white shadow-floating">
        <p className="text-[11px] font-bold uppercase tracking-widest text-accent-50/80">
          Cupo este mes
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
          {remaining}/{MAX_PER_MONTH}
        </p>
        <p className="mt-1 text-xs text-accent-50/80">
          {sentThisMonth} {sentThisMonth === 1 ? 'campaña enviada' : 'campañas enviadas'} ·{' '}
          {remaining > 0
            ? `Te quedan ${remaining} ${remaining === 1 ? 'envío' : 'envíos'}`
            : 'Cupo agotado'}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <Section icon={Users} title="Audiencia">
        <div className="flex flex-col gap-2">
          {AUDIENCIAS.map((a) => {
            const count = audienceCount[a.id]
            const selected = audiencia === a.id
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAudiencia(a.id)}
                className={cn(
                  'flex items-start gap-3 rounded-2xl p-3 text-left transition-all',
                  selected
                    ? 'bg-accent-50 ring-2 ring-accent-500'
                    : 'bg-white ring-1 ring-neutral-200 hover:ring-neutral-300',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full',
                    selected
                      ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white'
                      : 'ring-2 ring-neutral-200',
                  )}
                >
                  {selected && <Check size={10} strokeWidth={3} />}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-neutral-900">{a.label}</p>
                  <p className="text-xs text-neutral-500">{a.desc}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-neutral-700">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section icon={Sparkles} title="Plantilla pre-aprobada">
        <div className="flex flex-col gap-2">
          {TEMPLATES.map((t) => {
            const selected = templateId === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  'rounded-2xl p-3 text-left transition-all',
                  selected
                    ? 'bg-accent-50 ring-2 ring-accent-500'
                    : 'bg-white ring-1 ring-neutral-200 hover:ring-neutral-300',
                )}
              >
                <p className="text-sm font-bold text-neutral-900">{t.name}</p>
                <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{t.body}</p>
              </button>
            )
          })}
        </div>
      </Section>

      <Section icon={ChevronDown} title="Variables">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="% descuento"
            input={
              <input
                type="text"
                inputMode="numeric"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value.replace(/\D/g, '').slice(0, 2))}
                className={inputCls}
              />
            }
          />
          <Field
            label="Vigencia"
            input={
              <input
                type="text"
                value={vigencia}
                onChange={(e) => setVigencia(e.target.value)}
                placeholder="Ej: 30 de junio"
                className={inputCls}
              />
            }
          />
        </div>
      </Section>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Vista previa
        </p>
        <div className="rounded-2xl bg-[#075e54] p-1.5 shadow-card">
          <div className="rounded-xl bg-[#dcf8c6] px-3 py-2 text-sm text-neutral-900 shadow-sm">
            {rendered}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">
          Así lo recibe el cliente en WhatsApp.
        </p>
      </div>

      {campaigns.filter((c) => c.merchantId === merchantId).length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Historial
          </p>
          <div className="flex flex-col gap-2">
            {campaigns
              .filter((c) => c.merchantId === merchantId)
              .slice(0, 5)
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-neutral-100"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-status-success-bg text-status-success-fg">
                    <Send size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-900">{c.audiencia}</p>
                    <p className="text-[11px] text-neutral-500">
                      {formatRedeemedDate(c.sentAt)} · {c.sentCount}{' '}
                      {c.sentCount === 1 ? 'envío' : 'envíos'} · {c.readCount} leídos
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div
        className="fixed inset-x-3 bottom-3 z-30 flex flex-col gap-2 rounded-3xl bg-white p-3 shadow-floating ring-1 ring-neutral-100 sm:inset-x-auto sm:right-6 sm:left-auto sm:max-w-md md:bottom-6"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          type="button"
          onClick={() => setConfirmSend(true)}
          disabled={remaining === 0 || recipients === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} />
          {remaining === 0
            ? 'Cupo del mes agotado'
            : recipients === 0
              ? 'Sin destinatarios'
              : `Enviar a ${recipients} ${recipients === 1 ? 'cliente' : 'clientes'}`}
        </button>
        <Link
          to="/admin"
          className="text-center text-xs font-semibold text-neutral-500 hover:text-neutral-900"
        >
          Volver al inicio
        </Link>
      </div>

      <ConfirmDialog
        open={confirmSend}
        title={`¿Enviar a ${recipients} ${recipients === 1 ? 'cliente' : 'clientes'}?`}
        description={`Vas a usar 1 de los ${MAX_PER_MONTH} envíos disponibles este mes. El mensaje se entrega vía WhatsApp Business API.`}
        confirmLabel="Sí, enviar"
        cancelLabel="Cancelar"
        variant="info"
        onCancel={() => setConfirmSend(false)}
        onConfirm={handleSend}
      />
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MessageCircle
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
        <Icon size={11} /> {title}
      </p>
      {children}
    </section>
  )
}

const inputCls =
  'w-full rounded-2xl bg-white px-4 py-3 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400'

function Field({ label, input }: { label: string; input: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      {input}
    </label>
  )
}
