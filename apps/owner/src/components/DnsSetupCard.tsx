import { useState, type ReactNode } from 'react'
import { Check, Copy, Globe, ExternalLink, Store, Users, Megaphone } from 'lucide-react'

/**
 * Card con las URLs EN VIVO de la ciudad. Con el comodín de plataforma
 * (*.micuidad.com vía Cloudflare) cada ciudad queda online sola — no hay que
 * configurar DNS por ciudad. Mostramos las cuatro superficies públicas, todas
 * multi-tenant sobre esta ciudad:
 *   · Difusión: landing del vecino (/vecino) y del comercio (/comercios)
 *   · En vivo:  app del vecino (raíz) y panel del comercio (/#/admin)
 * Cada link tiene copiar-al-portapapeles + abrir, para mandárselo a vecinos y
 * comercios de la ciudad.
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
  // Las landings y la app se sirven desde el host de la ciudad (comodín). Las
  // URLs canónicas para compartir usan el subdominio de plataforma; el custom
  // domain queda como nota (apunta al mismo lugar cuando está configurado).
  const host = `${subdomain}.micuidad.com`
  const base = `https://${host}`
  const landingVecinoUrl = `${base}/vecino/`
  const landingComercioUrl = `${base}/comercios/`
  const vecinoUrl = base
  const comercioUrl = `${base}/#/admin/login`

  return (
    <article className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
      <header className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700">
          <Globe size={16} />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-bold text-neutral-900">Links de la ciudad</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Online sola por el comodín de la plataforma (<code className="font-mono">*.micuidad.com</code>).
            Copiá y compartí estos links con vecinos y comercios.
          </p>
        </div>
      </header>

      {status !== 'active' && (
        <div className="mt-4 rounded-xl bg-warning-bg/60 px-3 py-2 text-xs font-semibold text-warning">
          La app está en estado <strong>{status}</strong>. No se va a servir hasta que esté en{' '}
          <strong>active</strong>.
        </div>
      )}

      <div className="mt-5 space-y-4">
        <Group label="Difusión (para compartir)">
          <LinkRow
            icon={Megaphone}
            label="Landing del vecino"
            hint="Marketing para que los vecinos se sumen"
            url={landingVecinoUrl}
            display={`${host}/vecino`}
          />
          <LinkRow
            icon={Megaphone}
            label="Landing del comercio"
            hint="Captación de comercios de la ciudad"
            url={landingComercioUrl}
            display={`${host}/comercios`}
          />
        </Group>

        <Group label="En vivo">
          <LinkRow
            icon={Users}
            label="App del vecino"
            hint="Donde el vecino mira y usa los descuentos"
            url={vecinoUrl}
            display={host}
          />
          <LinkRow
            icon={Store}
            label="Panel del comercio"
            hint="Login del comercio adherido"
            url={comercioUrl}
            display={`${host}/#/admin`}
          />
        </Group>
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

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</p>
      {children}
    </div>
  )
}

function LinkRow({
  icon: Icon,
  label,
  hint,
  url,
  display,
}: {
  icon: typeof Globe
  label: string
  hint?: string
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
        {hint && <p className="truncate text-[10px] text-neutral-400">{hint}</p>}
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
