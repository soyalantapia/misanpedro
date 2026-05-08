import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  MessageCircle,
  Send,
  Users,
  Sparkles,
  Check,
  Smartphone,
  ShieldCheck,
  Power,
  RefreshCw,
} from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useClientsForMerchant } from '@/lib/merchantQueries'
import {
  whatsappActions,
  useWhatsappCampaigns,
  useWhatsappConnection,
} from '@/lib/whatsappStore'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatRedeemedDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { api, ApiError } from '@/lib/api'

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
  { id: 'recurrentes', label: 'Recurrentes', desc: '2 o más canjes' },
  { id: 'nuevos', label: 'Nuevos esta semana', desc: 'Primer canje en los últimos 7 días' },
] as const

type AudienciaId = (typeof AUDIENCIAS)[number]['id']

export function AdminWhatsappPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const connection = useWhatsappConnection(merchantId)

  if (!connection) {
    return <ConnectionScreen merchantId={merchantId} />
  }
  return <ComposerScreen merchantId={merchantId} connectedAt={connection.connectedAt} />
}

function ConnectionScreen({ merchantId }: { merchantId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const toast = useToast()
  const [connecting, setConnecting] = useState(false)
  const [apiQr, setApiQr] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<string>('disconnected')
  const [apiAvailable, setApiAvailable] = useState<boolean>(true)

  // Pedimos el QR real al backend. Si no responde o devuelve STUB,
  // mostramos uno simulado (modo demo).
  useEffect(() => {
    let cancelled = false
    api.whatsapp
      .start()
      .then((data) => {
        if (cancelled) return
        if (data.qr && data.qr !== 'STUB_QR_PLACEHOLDER') setApiQr(data.qr)
        setApiStatus(data.status)
      })
      .catch(() => {
        if (!cancelled) setApiAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Polling para detectar cuando la sesión se conecta efectivamente
  useEffect(() => {
    if (!apiAvailable) return
    const interval = setInterval(async () => {
      try {
        const data = await api.whatsapp.status()
        setApiStatus(data.status)
        if (data.qr && data.qr !== 'STUB_QR_PLACEHOLDER') setApiQr(data.qr)
        if (data.status === 'ready') {
          whatsappActions.connect(merchantId)
          toast.success('WhatsApp conectado', 'Ya podés mandar campañas masivas.')
          clearInterval(interval)
        }
      } catch {
        /* noop */
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [apiAvailable, merchantId, toast])

  // QR fake como fallback
  const fallbackQr = useMemo(
    () => `wa-mi-san-pedro:${merchantId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    [merchantId],
  )

  useEffect(() => {
    if (!canvasRef.current) return
    const text = apiQr ?? fallbackQr
    QRCode.toCanvas(
      canvasRef.current,
      text,
      { width: 240, margin: 1, color: { dark: '#14211B', light: '#ffffff' } },
      () => {},
    )
  }, [apiQr, fallbackQr])

  async function handleConnect() {
    setConnecting(true)
    if (apiAvailable) {
      // Verificar estado real
      try {
        const data = await api.whatsapp.status()
        if (data.status === 'ready') {
          whatsappActions.connect(merchantId)
          toast.success('WhatsApp conectado', 'Ya podés mandar campañas masivas.')
          setConnecting(false)
          return
        }
        toast.warning('Todavía no se conectó', 'Escaneá el QR primero desde tu WhatsApp.')
        setConnecting(false)
        return
      } catch (err) {
        // si el API falla, caemos al modo demo
        if (!(err instanceof ApiError)) setApiAvailable(false)
      }
    }
    // Modo demo: simulamos la conexión
    setTimeout(() => {
      whatsappActions.connect(merchantId)
      toast.success('WhatsApp conectado (demo)', 'Ya podés mandar campañas masivas.')
      setConnecting(false)
    }, 700)
  }
  // referenced for clarity; status visible para debugging futuro
  void apiStatus

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <MessageCircle size={12} /> Promociones
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Conectá WhatsApp Business
        </h1>
        <p className="text-sm text-neutral-500">
          Para mandar mensajes masivos a tus clientes Mi San Pedro tenés que conectar tu cuenta de
          WhatsApp Business escaneando un QR. Es lo mismo que WhatsApp Web.
        </p>
      </header>

      <div className="rounded-3xl bg-white p-6 shadow-floating ring-1 ring-neutral-100">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-3xl bg-white p-3 ring-2 ring-accent-100">
            <canvas ref={canvasRef} className="block" />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-accent-700">
              Escaneá este QR desde tu celular
            </p>
            <ol className="mt-3 space-y-1.5 text-left text-xs text-neutral-700">
              <Step n={1}>Abrí WhatsApp en el celular del comercio</Step>
              <Step n={2}>
                Andá a <b>Configuración &rsaquo; Dispositivos vinculados</b>
              </Step>
              <Step n={3}>
                Tocá <b>Vincular un dispositivo</b> y apuntá la cámara a este QR
              </Step>
              <Step n={4}>
                Mantené <b>WhatsApp Web abierto</b> en una pestaña mientras dura la campaña
              </Step>
            </ol>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-status-warning-bg p-4 text-status-warning-fg">
        <Smartphone size={14} className="mt-0.5 shrink-0" />
        <p className="text-xs font-medium">
          <span className="font-bold">Importante:</span> si cerrás WhatsApp Web durante el envío,
          la campaña se pausa hasta que vuelvas a abrir. Recomendado: dejá una pestaña dedicada.
        </p>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white shadow-floating"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all hover:-translate-y-0.5 disabled:opacity-60"
          >
            {connecting ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Verificando…
              </>
            ) : (
              <>
                <Check size={16} /> Ya escaneé, conectar
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-neutral-400">
            Demo: el escaneo está simulado. En producción se valida con la API de WhatsApp Business.
          </p>
        </div>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent-100 text-[10px] font-bold tabular-nums text-accent-700">
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

type SendingPhase =
  | { kind: 'idle' }
  | { kind: 'sending'; progress: number; total: number; sentSoFar: number }
  | {
      kind: 'done'
      sentCount: number
      deliveredCount: number
      readCount: number
    }

function ComposerScreen({
  merchantId,
  connectedAt,
}: {
  merchantId: string
  connectedAt: string
}) {
  const clients = useClientsForMerchant(merchantId)
  const campaigns = useWhatsappCampaigns()
  const toast = useToast()
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const sentThisMonth = useMemo(() => {
    const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
    return campaigns.filter(
      (c) => c.merchantId === merchantId && new Date(c.sentAt).getTime() >= startMonth,
    ).length
  }, [campaigns, merchantId])

  const remaining = Math.max(0, MAX_PER_MONTH - sentThisMonth)
  const percent = Math.round((sentThisMonth / MAX_PER_MONTH) * 100)

  const audienceBuckets = useMemo(() => {
    const now = Date.now()
    const week = now - 7 * 24 * 60 * 60 * 1000
    return {
      todos: clients,
      recurrentes: clients.filter((c) => c.count >= 2),
      nuevos: clients.filter((c) => new Date(c.firstRedeemedAt).getTime() >= week),
    }
  }, [clients])

  const [audiencia, setAudiencia] = useState<AudienciaId>('todos')
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id)
  const [porcentaje, setPorcentaje] = useState('20')
  const [vigencia, setVigencia] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  })
  const [phase, setPhase] = useState<SendingPhase>({ kind: 'idle' })
  const [confirmSend, setConfirmSend] = useState(false)

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]
  const audienceItem = AUDIENCIAS.find((a) => a.id === audiencia)!
  const recipients = audienceBuckets[audiencia]

  const previewName = recipients[0]?.user.nombre.split(' ')[0] ?? 'vecin@'
  const rendered = template.body
    .replace('{{nombre}}', previewName)
    .replace('{{comercio}}', merchantId.replace(/-/g, ' '))
    .replace('{{porcentaje}}', porcentaje)
    .replace('{{vigencia}}', vigencia)
    .replace('{{link}}', 'misanpedro.app/cupones')

  function handleStartSend() {
    if (recipients.length === 0) {
      toast.warning('Sin destinatarios', 'No hay clientes para esta audiencia.')
      setConfirmSend(false)
      return
    }
    setConfirmSend(false)
    const total = recipients.length
    setPhase({ kind: 'sending', progress: 0, total, sentSoFar: 0 })

    const stepDuration = Math.max(60, 2200 / total)
    let i = 0
    const interval = setInterval(() => {
      i++
      if (i >= total) {
        clearInterval(interval)
        const campaign = whatsappActions.send({
          merchantId,
          templateId,
          audiencia: audienceItem.label,
          rendered,
          sentCount: total,
        })
        setPhase({
          kind: 'done',
          sentCount: campaign.sentCount,
          deliveredCount: campaign.deliveredCount,
          readCount: campaign.readCount,
        })
        toast.success(
          'Campaña enviada',
          `${total} ${total === 1 ? 'mensaje entregado' : 'mensajes entregados'}.`,
        )
      } else {
        setPhase({ kind: 'sending', progress: i / total, total, sentSoFar: i })
      }
    }, stepDuration)
  }

  function handleDisconnect() {
    whatsappActions.disconnect(merchantId)
    toast.info('WhatsApp desconectado')
    setConfirmDisconnect(false)
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
          Montá la campaña ahora y se envía en el momento. Hasta {MAX_PER_MONTH} envíos por mes.
        </p>
      </header>

      <div className="flex items-center gap-3 rounded-2xl bg-status-success-bg p-3 text-status-success-fg">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-status-success text-white">
          <Check size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">WhatsApp conectado</p>
          <p className="text-[11px]">
            Vinculado{' '}
            {new Date(connectedAt).toLocaleString('es-AR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · Mantené WhatsApp Web abierto en una pestaña
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDisconnect(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/40 px-2.5 py-1 text-[11px] font-bold transition-all hover:bg-white"
          aria-label="Desconectar"
        >
          <Power size={11} /> Desconectar
        </button>
      </div>

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
            const count = audienceBuckets[a.id].length
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

      <Section icon={Send} title="Variables">
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

      {phase.kind === 'sending' && (
        <SendingProgress total={phase.total} progress={phase.progress} sentSoFar={phase.sentSoFar} />
      )}

      {phase.kind === 'done' && (
        <SendingDoneSummary
          sentCount={phase.sentCount}
          deliveredCount={phase.deliveredCount}
          readCount={phase.readCount}
          onReset={() => setPhase({ kind: 'idle' })}
        />
      )}

      {campaigns.filter((c) => c.merchantId === merchantId).length > 0 && phase.kind === 'idle' && (
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

      <div className="flex items-start gap-2.5 rounded-2xl bg-status-info-bg p-4 text-status-info-fg">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <p className="text-xs font-medium">
          Demo: el envío está simulado. En producción cada mensaje pasa por la API oficial de
          WhatsApp Business y respeta las plantillas aprobadas por Meta.
        </p>
      </div>

      {phase.kind === 'idle' && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white shadow-floating"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setConfirmSend(true)}
              disabled={remaining === 0 || recipients.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              {remaining === 0
                ? 'Cupo del mes agotado'
                : recipients.length === 0
                  ? 'Sin destinatarios'
                  : `Montar campaña ahora · ${recipients.length} ${recipients.length === 1 ? 'cliente' : 'clientes'}`}
            </button>
            <Link
              to="/admin"
              className="text-center text-xs font-semibold text-neutral-500 hover:text-neutral-900"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSend}
        title={`¿Enviar a ${recipients.length} ${recipients.length === 1 ? 'cliente' : 'clientes'} ahora?`}
        description={`Vas a usar 1 de los ${MAX_PER_MONTH} envíos disponibles este mes. Los mensajes se entregan en el momento via WhatsApp Web.`}
        confirmLabel="Sí, enviar ahora"
        cancelLabel="Cancelar"
        variant="info"
        onCancel={() => setConfirmSend(false)}
        onConfirm={handleStartSend}
      />

      <ConfirmDialog
        open={confirmDisconnect}
        title="¿Desconectar WhatsApp?"
        description="Vas a tener que volver a escanear el QR la próxima vez que quieras mandar una campaña."
        confirmLabel="Desconectar"
        cancelLabel="Cancelar"
        variant="warning"
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={handleDisconnect}
      />
    </div>
  )
}

function SendingProgress({
  total,
  progress,
  sentSoFar,
}: {
  total: number
  progress: number
  sentSoFar: number
}) {
  const pct = Math.round(progress * 100)
  return (
    <div className="rounded-3xl bg-gradient-to-br from-accent-400 to-accent-600 p-5 text-white shadow-floating">
      <div className="flex items-center gap-2">
        <RefreshCw size={14} className="animate-spin" />
        <p className="text-[11px] font-bold uppercase tracking-widest">Enviando…</p>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
        {sentSoFar}/{total}
      </p>
      <p className="mt-1 text-xs text-accent-50/90">
        WhatsApp está entregando los mensajes. No cierres esta pestaña.
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-white transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SendingDoneSummary({
  sentCount,
  deliveredCount,
  readCount,
  onReset,
}: {
  sentCount: number
  deliveredCount: number
  readCount: number
  onReset: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-status-success-bg p-5 text-status-success-fg">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-status-success text-white">
          <Check size={14} />
        </div>
        <div>
          <p className="text-sm font-bold">Campaña enviada</p>
          <p className="text-[11px]">Reporte preliminar:</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SmallStat label="Enviados" value={sentCount} />
        <SmallStat label="Entregados" value={deliveredCount} />
        <SmallStat label="Leídos" value={readCount} />
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-2 text-xs font-bold text-status-success-fg shadow-card hover:-translate-y-0.5 transition-all"
      >
        <Send size={12} /> Montar otra campaña
      </button>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/60 p-2 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</p>
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
