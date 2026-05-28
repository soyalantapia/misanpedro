import { useState } from 'react'
import { Check, Copy, Globe, ExternalLink } from 'lucide-react'

/**
 * Card que muestra al owner las instrucciones de DNS para que el subdomain
 * del tenant resuelva. Copia-y-pega friendly para Cloudflare/Namecheap/etc.
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
  const fullHostname = `${subdomain}.misanpedro.app`
  // En prod este target lo da Railway/Vercel. Por ahora documentamos placeholder
  // — el owner reemplaza con el target real una vez configurado el deploy.
  const target = 'misanpedro-web-production.up.railway.app'

  return (
    <article className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
      <header className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700">
          <Globe size={16} />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-bold text-neutral-900">Configuración DNS</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Una sola vez por dominio. Si ya configuraste el wildcard antes, este
            subdomain debería funcionar automáticamente.
          </p>
        </div>
      </header>

      {status !== 'active' && (
        <div className="mt-4 rounded-xl bg-warning-bg/60 px-3 py-2 text-xs font-semibold text-warning">
          La app está en estado <strong>{status}</strong>. El subdomain no se va a
          servir hasta que esté en <strong>active</strong>.
        </div>
      )}

      <div className="mt-5 space-y-3">
        <CopyRow label="Host / Name" value="*" hint="wildcard — cubre todas las ciudades futuras" />
        <CopyRow label="Type" value="CNAME" />
        <CopyRow label="Content / Value" value={target} hint="reemplazá por tu target de Railway/Vercel" />
        <CopyRow label="TTL" value="300" hint="5 minutos" />
      </div>

      <details className="mt-5 rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-neutral-700">
          Comandos de verificación
        </summary>
        <div className="mt-3 space-y-2">
          <CodeBlock>{`dig ${fullHostname} +short`}</CodeBlock>
          <CodeBlock>{`curl -I https://${fullHostname}`}</CodeBlock>
          <CodeBlock>{`curl https://api.misanpedro.app/api/v1/tenant/${subdomain}/config`}</CodeBlock>
        </div>
      </details>

      {customDomain && (
        <div className="mt-4 rounded-xl bg-success-bg/40 px-3 py-2 text-xs">
          <strong className="text-success">Custom domain configurado:</strong>{' '}
          <code className="font-mono">{customDomain}</code>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3 border-t border-neutral-100 pt-4">
        <a
          href={`https://${fullHostname}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50"
        >
          Abrir subdomain <ExternalLink size={10} />
        </a>
        <a
          href="https://github.com/soyalantapia/misanpedro/blob/main/docs/onboarding-new-city.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-accent-700 hover:underline"
        >
          Ver guía completa →
        </a>
      </div>
    </article>
  )
}

function CopyRow({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <div className="flex flex-col">
        <code className="overflow-hidden text-ellipsis rounded-lg bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-900 ring-1 ring-neutral-200">
          {value}
        </code>
        {hint && <span className="mt-1 text-[10px] text-neutral-500">{hint}</span>}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copiar ${label}`}
        className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      </button>
    </div>
  )
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard?.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg bg-neutral-900 px-3 py-2 text-[11px] text-neutral-100">
        <code>{children}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copiar"
        className="absolute right-2 top-1.5 grid h-6 w-6 place-items-center rounded text-neutral-500 opacity-0 transition-opacity hover:bg-neutral-700 hover:text-white group-hover:opacity-100"
      >
        {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
      </button>
    </div>
  )
}
