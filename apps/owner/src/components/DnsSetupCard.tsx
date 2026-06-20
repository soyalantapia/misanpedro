import { useState } from 'react'
import { Check, Copy, Globe, ExternalLink, Store, Users } from 'lucide-react'

/**
 * Card con las URLs EN VIVO de la ciudad. Con el comodín de plataforma
 * (*.micuidad.com vía Cloudflare) cada ciudad queda online sola — no hay que
 * configurar DNS por ciudad. Mostramos las dos superficies: app del vecino
 * (raíz) y panel del comercio (/#/admin), ambas multi-tenant sobre esta ciudad.
 */
export function DnsSetupCard({
  subdomain,
  customDomain,
  status,
}: {
  subdomain: string
  customDomain?: string
  status: 'pending' | 'active' | 'suspended' | 'archived'
}) {
  const host = `${subdomain}.micuidad.com`
  const vecinoUrl = `https://${host}`
  const comercioUrl = `https://${host}/#/admin/login`

  return (
    <article className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
      <header className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700">
          <Globe size={16} />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-bold text-neutral-900">La ciudad está online</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Servida sola por el comodín de la plataforma (<code className="font-mono">*.micuidad.com</code>).
            No hay que configurar DNS por ciudad.
          </p>
        </div>
      </header>

      {status !== 'active' && (
        <div className="mt-4 rounded-xl bg-warning-bg/60 px-3 py-2 text-xs font-semibold text-warning">
          La app está en estado <strong>{status}</strong>. No se va a servir hasta que esté en{' '}
          <strong>active</strong>.
        </div>
      )}

      <div className="mt-5 space-y-3">
        <LinkRow icon={Users} label="Vecino (app)" url={vecinoUrl} display={host} />
        <LinkRow icon={Store} label="Comercio (panel)" url={comercioUrl} display={`${host}/#/admin`} />
      </div>

      {customDomain && (
        <div className="mt-4 rounded-xl bg-success-bg/40 px-3 py-2 text-xs">
          <strong className="text-success">Custom domain:</strong>{' '}
          <code className="font-mono">{customDomain}</code>
        </div>
      )}
    </article>
  )
}

function LinkRow({
  icon: Icon,
  label,
  url,
  display,
}: {
  icon: typeof Globe
  label: string
  url: string
  display: string
}) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-500">
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</p>
        <code className="block truncate font-mono text-xs text-neutral-900">{display}</code>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copiar ${label}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir ${label}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        <ExternalLink size={14} />
      </a>
    </div>
  )
}
