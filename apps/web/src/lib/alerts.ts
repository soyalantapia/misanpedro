import { useSyncExternalStore } from 'react'
import type { Categoria } from './types'
import { getTenantSnapshot } from './tenant'

/**
 * Sistema de alertas del vecino (client-side, estilo Despegar).
 *
 * La vecina PACTA varias alertas, cada una con sus criterios (rubros, % mínimo,
 * comercio puntual). Cada cupón nuevo que matchea alguna alerta activa entra al
 * feed combinado y cuenta como novedad (badge en la campana). Persistente en
 * localStorage por tenant. El push real se engancha en lib/push.ts.
 */

export type AlertCoupon = {
  id: string
  titulo: string
  porcentaje: number
  merchantSlug: string
  merchantNombre: string
  categoria: Categoria
}

export type Alert = {
  id: string
  categorias: Categoria[] // [] = todas
  minDescuento: number // 0 = cualquiera
  merchantSlug?: string // opcional: un comercio puntual
  merchantNombre?: string
  activa: boolean
  createdAt: number
}

type Store = { alerts: Alert[]; pushEnabled: boolean }

const RECENT_MS = 21 * 24 * 60 * 60 * 1000

function slug() {
  return getTenantSnapshot().slug ?? 'default'
}
function storeKey() {
  return `msp.alerts.v2.${slug()}`
}
function seenKey() {
  return `msp.alerts.seen.${slug()}`
}

function genId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'a' + Math.random().toString(36).slice(2, 10)
  }
}

/** Timestamp (ms) embebido en un ObjectId de Mongo. */
function objectIdTime(id: string): number {
  if (typeof id !== 'string' || id.length < 8) return 0
  const ts = parseInt(id.slice(0, 8), 16)
  return Number.isFinite(ts) ? ts * 1000 : 0
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(storeKey())
    if (raw) {
      const p = JSON.parse(raw)
      return {
        alerts: Array.isArray(p.alerts) ? p.alerts : [],
        pushEnabled: !!p.pushEnabled,
      }
    }
    // Migración suave desde v1 (una preferencia de categorías → una alerta).
    const v1 = localStorage.getItem(`msp.alerts.prefs.${slug()}`)
    if (v1) {
      const p = JSON.parse(v1)
      const cats: Categoria[] = Array.isArray(p.categories) ? p.categories : []
      return {
        alerts: cats.length
          ? [{ id: genId(), categorias: cats, minDescuento: 0, activa: true, createdAt: Date.now() }]
          : [],
        pushEnabled: !!p.pushEnabled,
      }
    }
  } catch {
    /* noop */
  }
  return { alerts: [], pushEnabled: false }
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
let store: Store = loadStore()
let seen: Set<string> = loadSeen()
let initialized = seen.size > 0
const listeners = new Set<() => void>()

function persistStore() {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(store))
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

export function matchesAlert(c: AlertCoupon, a: Alert): boolean {
  if (a.categorias.length && !a.categorias.includes(c.categoria)) return false
  if (a.minDescuento && c.porcentaje < a.minDescuento) return false
  if (a.merchantSlug && c.merchantSlug !== a.merchantSlug) return false
  return true
}

function activeAlerts(): Alert[] {
  return store.alerts.filter((a) => a.activa)
}

/** Ordena por novedad (timestamp del ObjectId), sin recortar por antigüedad. */
function byNewest(list: AlertCoupon[]): AlertCoupon[] {
  return [...list].sort((a, b) => objectIdTime(b.id) - objectIdTime(a.id))
}

/** Filtra a los cargados en los últimos RECENT_MS (para "novedades"/badge). */
function recentSorted(list: AlertCoupon[]): AlertCoupon[] {
  const cutoff = Date.now() - RECENT_MS
  return byNewest(list).filter((c) => objectIdTime(c.id) >= cutoff)
}

/**
 * Cupones que matchean UNA alerta puntual. Bug #4: el CONTADOR de la tarjeta de
 * alerta cuenta TODOS los que coinciden (el backend ya filtró a estado=activo +
 * vigente), sin recortar por antigüedad de creación — un cupón vigente cargado
 * hace >21 días igual cuenta. El cutoff de 21 días es solo para "novedades".
 */
export function couponsForAlert(alertId: string): AlertCoupon[] {
  const a = store.alerts.find((x) => x.id === alertId)
  if (!a) return []
  return byNewest(coupons.filter((c) => matchesAlert(c, a)))
}

/** Cupones que matchean CUALQUIER alerta activa (feed combinado de la página). */
function matchingAny(): AlertCoupon[] {
  const active = activeAlerts()
  if (active.length === 0) return []
  return byNewest(coupons.filter((c) => active.some((a) => matchesAlert(c, a))))
}

/** Como matchingAny pero solo los recientes (badge de novedades / unread). */
function recentMatchingAny(): AlertCoupon[] {
  const active = activeAlerts()
  if (active.length === 0) return []
  return recentSorted(coupons.filter((c) => active.some((a) => matchesAlert(c, a))))
}

export type AlertsSnapshot = {
  feed: AlertCoupon[]
  unread: number
  alerts: Alert[]
  pushEnabled: boolean
}

let snapshot: AlertsSnapshot = computeSnapshot()

function computeSnapshot(): AlertsSnapshot {
  // El FEED muestra todos los cupones vigentes que matchean (bug #4: no recortar
  // por antigüedad). El UNREAD (badge de novedades) cuenta solo los recientes
  // no vistos.
  const feed = matchingAny()
  const recientes = recentMatchingAny()
  return {
    feed,
    unread: recientes.filter((c) => !seen.has(c.id)).length,
    alerts: store.alerts,
    pushEnabled: store.pushEnabled,
  }
}

function notify() {
  snapshot = computeSnapshot()
  listeners.forEach((fn) => fn())
}

/** El watcher (campana) llama esto con el catálogo actual. */
export function setAlertCoupons(list: AlertCoupon[]) {
  // Bug #19: dedup por CONTENIDO, no solo id+orden. Si un comercio editó el % o
  // el título de un cupón existente (mismo id), antes el early-return descartaba
  // la actualización y el feed/matchesAlert seguían con el valor viejo.
  const sameLength = list.length === coupons.length
  const sameContent =
    sameLength &&
    list.every((c, i) => {
      const p = coupons[i]
      return (
        p &&
        c.id === p.id &&
        c.porcentaje === p.porcentaje &&
        c.titulo === p.titulo &&
        c.categoria === p.categoria &&
        c.merchantSlug === p.merchantSlug
      )
    })
  if (sameContent) return
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
  for (const c of recentMatchingAny()) {
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

export function addAlert(input: {
  categorias?: Categoria[]
  minDescuento?: number
  merchantSlug?: string
  merchantNombre?: string
}): Alert {
  const a: Alert = {
    id: genId(),
    categorias: input.categorias ?? [],
    minDescuento: input.minDescuento ?? 0,
    merchantSlug: input.merchantSlug || undefined,
    merchantNombre: input.merchantNombre || undefined,
    activa: true,
    createdAt: Date.now(),
  }
  store = { ...store, alerts: [a, ...store.alerts] }
  persistStore()
  notify()
  return a
}

export function removeAlert(id: string) {
  store = { ...store, alerts: store.alerts.filter((a) => a.id !== id) }
  persistStore()
  notify()
}

export function toggleAlert(id: string) {
  store = {
    ...store,
    alerts: store.alerts.map((a) => (a.id === id ? { ...a, activa: !a.activa } : a)),
  }
  persistStore()
  notify()
}

export function setPushEnabled(on: boolean) {
  store = { ...store, pushEnabled: on }
  persistStore()
  notify()
}

/** Categorías para el push: unión de las alertas activas; [] = todas (si alguna sigue "todas"). */
export function pushCategories(): Categoria[] {
  const active = activeAlerts()
  if (active.length === 0 || active.some((a) => a.categorias.length === 0)) return []
  return [...new Set(active.flatMap((a) => a.categorias))]
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
