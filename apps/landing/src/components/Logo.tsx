import { useId } from 'react'
import { useTenant, appName } from '@/lib/tenant'

type LogoProps = {
  /** 'lockup' = isotipo + wordmark · 'mark' = solo el isotipo de cupón */
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
 * Logo de la ciudad: isotipo de cupón (sello redondo con el %) + wordmark de dos
 * tonos, "Mi" en naranja y el resto en tinta. Es el mismo lockup que ya usaban la
 * landing del vecino y la carátula que se ve al compartir el link por WhatsApp;
 * acá la barra y el pie tenían en su lugar un cuadradito con una "M" suelta.
 *
 * El degradé del sello sale de la escala accent-*, derivada del knob
 * `--color-brand`, así que cada ciudad lo re-tematiza sola.
 */
export function Logo({
  variant = 'lockup',
  className = '',
  markSize = 30,
  textClass = 'text-base',
  onDark = false,
}: LogoProps) {
  // useId() por instancia: dos logos en la misma página (barra + pie) no pueden
  // compartir el id del gradiente o el segundo hereda el degradé del primero.
  const gradId = 'msp-logo-' + useId().replace(/:/g, '')

  const { config } = useTenant()
  const [first, restWord] = splitWordmark(appName(config))

  const mark = (
    <svg
      width={markSize}
      height={markSize}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="shrink-0"
    >
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
        {/* accent-500 ES el color de marca crudo (#ea580c en San Pedro): el mismo
            naranja del "Mi" en la carátula que se ve al compartir el link. Con
            accent-700 quedaba dos tonos más oscuro y no cerraba con la carátula.
            El contraste bajo contra blanco no es un problema de accesibilidad:
            WCAG exime explícitamente al texto que es parte de un logotipo. */}
        <span className={onDark ? 'text-accent-300' : 'text-accent-500'}>{first}</span>
        {restWord}
      </span>
    </span>
  )
}
