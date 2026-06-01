import { useSyncExternalStore } from 'react'
import type { Categoria } from './types'
import { getTenantSnapshot } from './tenant'

/**
 * Sistema de alertas del vecino (client-side).
 *
 * - La vecina elige categorías que le interesan (vacío = todas).
 * - Detectamos cupones "nuevos" desde una línea de base: en el primer uso
 *   marcamos todos los cupones actuales como vistos, así sólo los que aparecen
 *   DESPUÉS cuentan como novedad (badge en la campana).
 * - Todo persiste en localStorage por tenant. El push real (notificación del
 *   sistema) se engancha aparte en lib/push.ts.
 */

export type AlertCoupon = {
  id: string
  titulo: string
  porcentaje: number
  merchantSlug: string
  merchantNombre: string
  categoria: Categoria
}

type Prefs = { categories: Categoria[]; pushEnabled: boolean }

const RECENT_MS = 21 * 24 * 60 * 60 * 1000

function slug() {
  return getTenantSnapshot().slug ?? 'default'
}
function prefsKey() {
  return `msp.alerts.prefs.${slug()}`
}
function seenKey() {
  return `msp.alerts.seen.${slug()}`
}

/** Timestamp (ms) embebido en un ObjectId de Mongo. */
function objectIdTime(id: string): number {
  if (typeof id !== 'string' || id.length < 8) return 0
  const ts = parseInt(id.slice(0, 8), 16)
  return Number.isFinite(ts) ? ts * 1000 : 0
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(prefsKey())
    if (raw) {
      const p = JSON.parse(raw)
      return {
        categories: Array.isArray(p.categories) ? p.categories : [],
        pushEnabled: !!p.pushEnabled,
      }
    }
  } catch {
    /* noop */
  }
  return { categories: [], pushEnabled: false }
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey())
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch {
    /* noop */
  }
  return new Set()
}

let coupons: AlertCoupon[] = []
let prefs: Prefs = loadPrefs()
let seen: Set<string> = loadSeen()
let initialized = seen.size > 0

const listeners = new Set<() => void>()

function persistPrefs() {
  try {
    localStorage.setItem(prefsKey(), JSON.stringify(prefs))
  } catch {
    /* noop */
  }
}
function persistSeen() {
  try {
    localStorage.setItem(seenKey(), JSON.stringify([...seen]))
  } catch {
    /* noop */
  }
}

function matchesPrefs(c: AlertCoupon): boolean {
  if (prefs.categories.length === 0) return true
  return prefs.categories.includes(c.categoria)
}

function recentMatching(): AlertCoupon[] {
  const cutoff = Date.now() - RECENT_MS
  return coupons
    .filter((c) => matchesPrefs(c) && objectIdTime(c.id) >= cutoff)
    .sort((a, b) => objectIdTime(b.id) - objectIdTime(a.id))
}

export type AlertsSnapshot = {
  feed: AlertCoupon[]
  unread: number
  categories: Categoria[]
  pushEnabled: boolean
}

let snapshot: AlertsSnapshot = computeSnapshot()

function computeSnapshot(): AlertsSnapshot {
  const feed = recentMatching()
  return {
    feed,
    unread: feed.filter((c) => !seen.has(c.id)).length,
    categories: prefs.categories,
    pushEnabled: prefs.pushEnabled,
  }
}

function notify() {
  snapshot = computeSnapshot()
  listeners.forEach((fn) => fn())
}

/** El watcher (campana) llama esto con el catálogo actual. */
export function setAlertCoupons(list: AlertCoupon[]) {
  // Dedupe: si los ids no cambiaron, no recomputamos (evita renders en loop).
  const sameLength = list.length === coupons.length
  const sameIds = sameLength && list.every((c, i) => c.id === coupons[i]?.id)
  if (sameIds) return
  coupons = list
  if (!initialized && list.length > 0) {
    // Línea de base: nada es "nuevo" en el primer uso.
    seen = new Set(list.map((c) => c.id))
    initialized = true
    persistSeen()
  }
  notify()
}

export function markAllSeen() {
  let changed = false
  for (const c of recentMatching()) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      changed = true
    }
  }
  if (changed) {
    persistSeen()
    notify()
  }
}

export function setCategories(categories: Categoria[]) {
  prefs = { ...prefs, categories }
  persistPrefs()
  notify()
}

export function toggleCategory(cat: Categoria) {
  const has = prefs.categories.includes(cat)
  setCategories(has ? prefs.categories.filter((c) => c !== cat) : [...prefs.categories, cat])
}

export function setPushEnabled(on: boolean) {
  prefs = { ...prefs, pushEnabled: on }
  persistPrefs()
  notify()
}

export function getAlertsSnapshot() {
  return snapshot
}

export function useAlerts(): AlertsSnapshot {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    getAlertsSnapshot,
    getAlertsSnapshot,
  )
}
