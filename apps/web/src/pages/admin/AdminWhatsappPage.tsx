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
import { useApiWhatsappStatus } from '@/lib/apiQueries'
import { useWhatsappStream } from '@/lib/useWhatsappStream'

const MAX_PER_MONTH = 4

/**
 * Convierte "YYYY-MM-DD" a "30 de junio" para el mensaje de WhatsApp.
 * Si la fecha es inválida o vacía, devuelve string vacío (el guard de
 * "Montar campaña" se encarga de bloquear envío).
 */
function formatVigenciaDate(iso: string): string {
  if (!iso) return ''
  // Anchor T12 evita el bug de timezone (mismo patrón que formatBirthdate).
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

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
    body: '{{nombre}}, este {{vigencia}} hacemos evento especial en {{comercio}} con {{porcentaje}}% off para clientes Cuponcito. Te esperamos. {{link}}',
  },
] as const

const AUDIENCIAS = [
  { id: 'todos', label: 'Todos mis clientes', desc: 'Vecinos que canjearon al menos una vez' },
  { id: 'recurrentes', label: 'Recurrentes', desc: '2 o más canjes' },
  { id: 'nuevos', label: 'Nuevos esta semana', desc: 'Primer canje en los últimos 7 días' },
] as const

type AudienciaId = (typeof AUDIENCIAS)[number]['id']

export function AdminWhatsappPage() {
  const sessionState = useMerchantSession()
  const { session } = sessionState
  const merchantId = session?.merchantId ?? ''
  const merchantNombre = sessionState.apiMerchant?.nombre ?? ''
  const connection = useWhatsappConnection(merchantId)

  if (!connection) {
    return <ConnectionScreen merchantId={merchantId} />
  }
  return (
    <ComposerScreen
      merchantId={merchantId}
      merchantNombre={merchantNombre}
      connectedAt={connection.connectedAt}
    />
  )
}

function ConnectionScreen({ merchantId }: { merchantId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const toast = useToast()
  const [connecting, setConnecting] = useState(false)
  // Stream SSE: recibe eventos qr / status / campaign en tiempo real
  const wa = useWhatsappStream()

  // Disparamos /wa/start una SOLA vez al montar este componente. Sin
  // dependencias para evitar re-fires cuando `toast` cambia de referencia.
  // Importante: el backend implementa startSession() de forma idempotente
  // (si ya hay un client levantado, no crea uno nuevo). Pero igual evitamos
  // disparar este request en cada render.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    api.whatsapp.start().catch(() => {
      // No mostramos toast acá: el evento `status: error` del SSE ya nos
      // avisa si algo falla. Mostrar un toast por cada intento generaba
      // spam infinito cuando el effect se reejecutaba.
    })
  }, [])

  // Cuando el stream pasa a 'ready', marcamos la conexión local. Sólo
  // disparamos el toast una vez (en el flanco de subida).
  const wasReadyRef = useRef(false)
  useEffect(() => {
    if (wa.status === 'ready' && !wasReadyRef.current) {
      wasReadyRef.current = true
      whatsappActions.connect(merchantId)
      toast.success('WhatsApp conectado', 'Ya podés mandar campañas masivas.')
    }
  }, [wa.status, merchantId, toast])

  // Renderizamos el QR real que viene del backend. Si todavía no llegó,
  // el canvas queda vacío (mostramos un placeholder textual).
  useEffect(() => {
    if (!canvasRef.current) return
    if (!wa.qr || wa.qr === 'STUB_QR_PLACEHOLDER') return
    QRCode.toCanvas(
      canvasRef.current,
      wa.qr,
      { width: 240, margin: 1, color: { dark: '#14211B', light: '#ffffff' } },
      () => {},
    )
  }, [wa.qr])

  async function handleConnect() {
    setConnecting(true)
    try {
      const data = await api.whatsapp.status()
      if (data.status === 'ready') {
        whatsappActions.connect(merchantId)
        toast.success('WhatsApp conectado', 'Ya podés mandar campañas masivas.')
      } else {
        toast.warning('Todavía no se conectó', 'Escaneá el QR primero desde tu WhatsApp.')
      }
    } catch (err) {
      toast.error(
        'No pudimos verificar el estado',
        err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.',
      )
    } finally {
      setConnecting(false)
    }
  }

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
          Para mandar mensajes masivos a tus clientes tenés que conectar tu cuenta de
          WhatsApp Business escaneando un QR. Es lo mismo que WhatsApp Web.
        </p>
      </header>

      <div className="rounded-3xl bg-white p-6 shadow-floating ring-1 ring-neutral-100">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-3xl bg-white p-3 ring-2 ring-accent-100">
            <canvas ref={canvasRef} role="img" aria-label="Código QR para vincular WhatsApp Business" className="block" />
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
      /** null = todavía no podemos medir (sin WhatsApp Business API oficial). */
      readCount: number | null
    }

function ComposerScreen({
  merchantId,
  merchantNombre,
  connectedAt,
}: {
  merchantId: string
  merchantNombre: string
  connectedAt: string
}) {
  const clients = useClientsForMerchant(merchantId)
  const campaigns = useWhatsappCampaigns()
  const apiStatus = useApiWhatsappStatus()
  const toast = useToast()
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const sentThisMonth = useMemo(() => {
    if (apiStatus.data?.quota) return apiStatus.data.quota.used
    const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
    return campaigns.filter(
      (c) => c.merchantId === merchantId && new Date(c.sentAt).getTime() >= startMonth,
    ).length
  }, [campaigns, merchantId, apiStatus.data])

  const remaining = apiStatus.data?.quota
    ? apiStatus.data.quota.remaining
    : Math.max(0, MAX_PER_MONTH - sentThisMonth)
  const maxThisMonth = apiStatus.data?.quota?.max ?? MAX_PER_MONTH
  const percent = Math.round((sentThisMonth / maxThisMonth) * 100)

  // `nowMs` se actualiza cada 60s para que el bucket "nuevos (últimos 7 días)"
  // no quede stale cuando la tab queda abierta. Sacar Date.now() del useMemo
  // cumple también con react-hooks/purity en React 19 strict.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const audienceBuckets = useMemo(() => {
    const week = nowMs - 7 * 24 * 60 * 60 * 1000
    return {
      todos: clients,
      recurrentes: clients.filter((c) => c.count >= 2),
      nuevos: clients.filter((c) => new Date(c.firstRedeemedAt).getTime() >= week),
    }
  }, [clients, nowMs])

  const [audiencia, setAudiencia] = useState<AudienciaId>('todos')
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id)
  const [porcentaje, setPorcentaje] = useState('20')
  // WA06: vigencia ahora es un date input (YYYY-MM-DD) en lugar de texto libre.
  // Default: hoy + 14 días. Se formatea legible para el preview/envío.
  const [vigenciaDate, setVigenciaDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  })
  const vigencia = formatVigenciaDate(vigenciaDate)
  const [phase, setPhase] = useState<SendingPhase>({ kind: 'idle' })
  const [confirmSend, setConfirmSend] = useState(false)

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]
  const audienceItem = AUDIENCIAS.find((a) => a.id === audiencia)!
  const recipients = audienceBuckets[audiencia]

  const previewName = recipients[0]?.user.nombre.split(' ')[0] ?? 'vecin@'
  const nombreComercio = merchantNombre || merchantId
  const rendered = template.body
    .replace('{{nombre}}', previewName)
    .replace('{{comercio}}', nombreComercio)
    .replace('{{porcentaje}}', porcentaje)
    .replace('{{vigencia}}', vigencia)
    .replace('{{link}}', 'cuponcito.app')

  async function handleStartSend() {
    if (recipients.length === 0) {
      toast.warning('Sin destinatarios', 'No hay clientes para esta audiencia.')
      setConfirmSend(false)
      return
    }
    setConfirmSend(false)
    const total = recipients.length
    setPhase({ kind: 'sending', progress: 0, total, sentSoFar: 0 })

    const recipientNumbers = recipients
      .map((r) => r.user.whatsapp.replace(/\D/g, ''))
      .filter((n) => n.length >= 8)

    // POST /wa/campaign: el backend procesa con rate-limit anti-ban (delay
    // random 2-5s entre cada mensaje) y publica progreso vía SSE.
    // El hook useWhatsappStream() en este componente recibe los eventos
    // 'campaign.progress' y actualiza el progress bar en tiempo real
    // (ver el useEffect inferior que escucha wa.campaign).
    try {
      const data = await api.whatsapp.campaign(recipientNumbers, rendered)
      whatsappActions.send({
        merchantId,
        templateId,
        audiencia: audienceItem.label,
        rendered,
        sentCount: data.campaign.sentCount,
      })
      setPhase({
        kind: 'done',
        sentCount: data.campaign.sentCount,
        deliveredCount: data.campaign.sentCount,
        // readCount NO se mide hoy. Cuando se integre la WhatsApp Business API
        // oficial de Meta, vamos a recibir read receipts vía webhook. Hasta
        // entonces NO inventamos un número — mejor mostrar "—" que mentir.
        readCount: null,
      })
      toast.success(
        'Campaña enviada',
        `${data.campaign.sentCount} entregados${data.campaign.failedCount ? ` · ${data.campaign.failedCount} fallaron` : ''}.`,
      )
      apiStatus.refetch()
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast.error('Cupo agotado', err.message ?? 'Llegaste al límite mensual.')
        setPhase({ kind: 'idle' })
        return
      }
      if (err instanceof ApiError && err.status === 503) {
        toast.error(
          'WhatsApp no está conectado',
          'Conectá tu sesión escaneando el QR antes de enviar campañas.',
        )
        setPhase({ kind: 'idle' })
        return
      }
      toast.error(
        'No pudimos enviar la campaña',
        err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.',
      )
      setPhase({ kind: 'idle' })
    }
  }

  // Escucha el stream SSE: cuando llega un evento `campaign.progress`,
  // actualizamos el progress bar con los conteos reales.
  const wa = useWhatsappStream()
  useEffect(() => {
    if (!wa.campaign || wa.campaign.done) return
    const sentSoFar = wa.campaign.sent + wa.campaign.failed
    setPhase((prev) => {
      if (prev.kind !== 'sending') return prev
      return {
        kind: 'sending',
        total: wa.campaign!.total,
        sentSoFar,
        progress: wa.campaign!.total === 0 ? 0 : sentSoFar / wa.campaign!.total,
      }
    })
  }, [wa.campaign])

  async function handleDisconnect() {
    setConfirmDisconnect(false)
    // Limpiamos local primero para feedback inmediato. Si el API falla, el
    // store ya quedó disconnected → próximo refresh el status del API va a
    // estar fuera de sync, pero al menos no quedamos con sesión zombie.
    whatsappActions.disconnect(merchantId)
    try {
      await api.whatsapp.stop()
      toast.info('WhatsApp desconectado')
    } catch (err) {
      // El estado local ya está desconectado; informamos pero no es bloqueante
      toast.warning(
        'Desconectado localmente',
        err instanceof ApiError
          ? 'El servidor no respondió: '
            .concat(err.message)
            .concat(' · refrescá para sincronizar.')
          : 'No pudimos confirmar con el servidor. Refrescá para sincronizar.',
      )
    }
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
            label="Vigencia hasta"
            input={
              <input
                type="date"
                value={vigenciaDate}
                onChange={(e) => setVigenciaDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className={inputCls}
                aria-label="Fecha hasta la que vale el descuento"
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
              disabled={
                remaining === 0 ||
                recipients.length === 0 ||
                porcentaje.trim().length === 0 ||
                vigencia.trim().length === 0
              }
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              {remaining === 0
                ? 'Cupo del mes agotado'
                : recipients.length === 0
                  ? 'Sin destinatarios'
                  : porcentaje.trim().length === 0
                    ? 'Completá el % de descuento'
                    : vigencia.trim().length === 0
                      ? 'Completá la vigencia'
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
  readCount: number | null
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
        <SmallStat
          label="Leídos"
          value={readCount}
          tooltip="Disponible cuando se integre la WhatsApp Business API oficial"
        />
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

function SmallStat({
  label,
  value,
  tooltip,
}: {
  label: string
  value: number | null
  tooltip?: string
}) {
  return (
    <div className="rounded-xl bg-white/60 p-2 text-center" title={tooltip}>
      <p className="text-lg font-bold tabular-nums">{value ?? '—'}</p>
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
      <h2 className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
        <Icon size={11} aria-hidden="true" /> {title}
      </h2>
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
