/**
 * Contraste WCAG (sin dependencias). Se usa para avisar en el alta/edición de una
 * ciudad cuando el color de marca elegido dejaría ilegible el texto blanco de los
 * CTA (que se pintan sobre ese color / su escala accent).
 */

/** Parsea #RGB / #RRGGBB a [r,g,b] 0-255. Devuelve null si no es un hex válido. */
function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

/** Luminancia relativa WCAG de un canal 0-255. */
function channelLum(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** Luminancia relativa WCAG de un color (0 = negro, 1 = blanco). */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb
  return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b)
}

/** Ratio de contraste WCAG entre dos colores (1:1 a 21:1). */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  if (la == null || lb == null) return null
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Contraste del texto blanco contra un color (para los CTA blancos sobre la marca). */
export function whiteContrast(hex: string): number | null {
  return contrastRatio('#ffffff', hex)
}

/**
 * Diagnóstico del color de marca para los CTA. El CTA pinta el texto blanco sobre
 * accent-700 — la marca oscurecida ~33% (color-mix con negro 33%) — NO sobre el
 * color crudo. Evaluamos el contraste ahí para no marcar en falso marcas oscuras
 * que sí funcionan (p.ej. el naranja de San Pedro pasa en accent-700).
 */
export function brandContrastWarning(hex: string): { ratio: number; level: 'ok' | 'warn' | 'fail' } | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const accent700 =
    '#' + rgb.map((c) => Math.round(c * 0.67).toString(16).padStart(2, '0')).join('')
  const ratio = whiteContrast(accent700)
  if (ratio == null) return null
  const r = Math.round(ratio * 100) / 100
  // 4.5 = AA texto normal · 3.0 = AA texto grande/UI. Por debajo de 3 el texto
  // blanco del CTA es ilegible; entre 3 y 4.5 es borderline.
  const level = ratio >= 4.5 ? 'ok' : ratio >= 3 ? 'warn' : 'fail'
  return { ratio: r, level }
}
