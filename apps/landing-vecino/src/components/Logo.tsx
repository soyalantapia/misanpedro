import { useId } from 'react'
import { useTenant, appName } from '@/lib/tenant'

type LogoProps = {
  /** 'lockup' = isotipo + "MiSanPedro" · 'mark' = solo el isotipo de cupón */
  variant?: 'lockup' | 'mark'
  className?: string
  /** tamaño del isotipo en px */
  markSize?: number
  /** clase Tailwind para el tamaño del wordmark (ej. 'text-base') */
  textClass?: string
  /** wordmark en blanco para fondos oscuros */
  onDark?: boolean
}

/**
 * Parte el nombre de marca en las dos piezas del wordmark: el "Mi" que va
 * coloreado y el resto en tinta. Acepta la marca escrita junta ("MiSanPedro") y
 * también con espacios ("Mi Nariño"), que es como la puede cargar el owner.
 * Si el nombre no empieza con "Mi", devuelve todo como primera pieza.
 */
export function splitWordmark(name: string): [string, string] {
  const conEspacios = name.trim().split(/\s+/)
  if (conEspacios.length > 1) return [conEspacios[0], conEspacios.slice(1).join('')]
  const junto = /^(Mi)(.+)$/.exec(name.trim())
  return junto ? [junto[1], junto[2]] : [name.trim(), '']
}

/**
 * Logo de la ciudad: isotipo de cupón (sello redondo) + wordmark de dos tonos
 * ("Mi" en naranja + el resto en tinta). El degradé del sello sigue el knob
 * `--color-brand` vía la escala accent-*, así queda coherente con la marca.
 */
export function Logo({
  variant = 'lockup',
  className = '',
  markSize = 30,
  textClass = 'text-base',
  onDark = false,
}: LogoProps) {
  const gradId = 'msp-logo-' + useId().replace(/:/g, '')

  const { config } = useTenant()
  // Wordmark de dos tonos: "Mi" coloreado + el resto en tinta. El nombre viene del
  // tenant y puede llegar de dos formas, así que partimos por las dos:
  //   "MiSanPedro"  (junto, como se escribe la marca)   → Mi | SanPedro
  //   "Mi Nariño"   (con espacios, otras ciudades)      → Mi | Nariño
  // Sin el caso "junto", el logo pintaba TODA la palabra de naranja.
  const name = appName(config)
  const [first, restWord] = splitWordmark(name)

  const mark = (
    <svg width={markSize} height={markSize} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-accent-400)" />
          <stop offset="100%" stopColor="var(--color-accent-600)" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${gradId})`} />
      <circle
        cx="32"
        cy="32"
        r="23"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeDasharray="1.5 4.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <text
        x="32"
        y="42.5"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontWeight="800"
        fontSize="27"
        fill="#fff"
        textAnchor="middle"
      >
        %
      </text>
    </svg>
  )

  if (variant === 'mark') return mark

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {mark}
      <span
        className={`font-black leading-none tracking-tight ${textClass} ${onDark ? 'text-white' : 'text-neutral-900'}`}
        style={{ letterSpacing: '-0.03em' }}
      >
        <span className={onDark ? 'text-accent-300' : 'text-accent-700'}>{first}</span>{restWord}
      </span>
    </span>
  )
}
