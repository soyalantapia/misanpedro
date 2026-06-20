import { getTenantSnapshot, appName } from './tenant'

/**
 * Web Push del vecino. El SW (registrado en prod desde main.tsx) trae los
 * handlers (public/push-sw.js). En dev no hay SW, así que subscribePush avisa
 * que hay que usar la app instalada — sin colgarse (no usamos serviceWorker.ready).
 */

const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001'
const BASE = `${API_URL.replace(/\/$/, '')}/api/v1`

export type PushState = 'unsupported' | 'denied' | 'no-sw' | 'ready' | 'subscribed'

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const slug = getTenantSnapshot().slug
  if (slug) h['X-Tenant-Slug'] = slug
  return h
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return 'no-sw'
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'subscribed' : 'ready'
}

export async function subscribePush(categories: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'Tu navegador no soporta notificaciones.' }
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) {
    return {
      ok: false,
      error: `Las notificaciones funcionan en la app instalada. Instalá ${appName()} desde el menú del navegador y volvé a intentar.`,
    }
  }
  const vapid = await fetch(`${BASE}/push/vapid-public`, { headers: headers() })
    .then((r) => r.json())
    .catch(() => null)
  if (!vapid?.key) return { ok: false, error: 'El servidor todavía no tiene notificaciones configuradas.' }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, error: 'Necesitamos tu permiso para enviarte avisos.' }

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.key) as BufferSource,
    })
  }
  const res = await fetch(`${BASE}/push/subscribe`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ subscription: sub.toJSON(), categories }),
  })
  if (!res.ok) return { ok: false, error: 'No pudimos guardar la suscripción.' }
  return { ok: true }
}

/** Re-envía las categorías al backend si ya hay suscripción (sin pedir permiso). */
export async function syncPushCategories(categories: string[]): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (!sub) return
  await fetch(`${BASE}/push/subscribe`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ subscription: sub.toJSON(), categories }),
  }).catch(() => {})
}

export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (sub) {
    await fetch(`${BASE}/push/unsubscribe`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
}
