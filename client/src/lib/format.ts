const monthsShort = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

export function formatVigencia(iso: string): string {
  const d = new Date(iso)
  return `Vigente hasta el ${d.getDate()} de ${monthsShort[d.getMonth()]}`
}

export function formatRedeemedDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${monthsShort[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatTimeRemaining(expiresAtIso: string, nowMs = Date.now()): string {
  const remainingMs = new Date(expiresAtIso).getTime() - nowMs
  if (remainingMs <= 0) return 'Expirado'
  const totalSec = Math.floor(remainingMs / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${pad(min)}:${pad(sec)}`
}

export function distanceLabel(km: number): string {
  if (km < 0.4) return `A ${Math.max(1, Math.round(km * 12))} cuadras`
  if (km < 1) return `A ${Math.round(km * 1000)} m`
  return `A ${km.toFixed(1)} km`
}

export function calcAhorro(porcentaje: number, ticketEstimado = 4000) {
  return Math.round((ticketEstimado * porcentaje) / 100)
}

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}
