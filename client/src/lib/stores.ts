import { useSyncExternalStore } from 'react'
import type { Activation, ActivationStatus, User } from './types'

type StorageShape = {
  user: User | null
  activations: Activation[]
}

const STORAGE_KEY = 'misanpedro.v1'

const empty: StorageShape = { user: null, activations: [] }

function load(): StorageShape {
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<StorageShape>
    return {
      user: parsed.user ?? null,
      activations: Array.isArray(parsed.activations) ? parsed.activations : [],
    }
  } catch {
    return empty
  }
}

function save(state: StorageShape) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

let state: StorageShape = load()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

function update(updater: (s: StorageShape) => StorageShape) {
  state = updater(state)
  save(state)
  notify()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function getSnapshot() {
  return state
}

const expirationCheckInterval = 15_000
let timer: ReturnType<typeof setInterval> | null = null

function startExpirationLoop() {
  if (typeof window === 'undefined' || timer) return
  timer = setInterval(() => {
    const now = Date.now()
    let dirty = false
    const next = state.activations.map((a) => {
      if (a.status === 'activo' && new Date(a.expiresAt).getTime() <= now) {
        dirty = true
        return { ...a, status: 'expirado' as ActivationStatus }
      }
      return a
    })
    if (dirty) update((s) => ({ ...s, activations: next }))
  }, expirationCheckInterval)
}

startExpirationLoop()

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useUser() {
  return useStore().user
}

export function useActivations() {
  return useStore().activations
}

export function useActivation(id: string | undefined) {
  return useStore().activations.find((a) => a.id === id)
}

export function useActivationByCoupon(couponId: string | undefined) {
  return useStore().activations.find(
    (a) => a.couponId === couponId && a.status === 'activo',
  )
}

export const userActions = {
  register(input: Omit<User, 'id' | 'createdAt' | 'acceptedTcAt'>) {
    const now = new Date().toISOString()
    const user: User = {
      id: `u-${randomToken(8)}`,
      ...input,
      acceptedTcAt: now,
      createdAt: now,
    }
    update((s) => ({ ...s, user }))
    return user
  },
  signOut() {
    update(() => empty)
  },
}

export const activationActions = {
  activate(couponId: string): Activation {
    const existing = state.activations.find(
      (a) => a.couponId === couponId && a.status === 'activo',
    )
    if (existing) return existing

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000)
    const codigoNumerico = generateNumericCode()
    const activation: Activation = {
      id: `a-${randomToken(10)}`,
      couponId,
      codigoNumerico,
      qrPayload: JSON.stringify({
        couponId,
        userId: state.user?.id,
        activationId: `a-${randomToken(10)}`,
        codigo: codigoNumerico,
        exp: expiresAt.getTime(),
      }),
      activatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'activo',
    }
    update((s) => ({ ...s, activations: [activation, ...s.activations] }))
    return activation
  },
  reactivate(activationId: string): Activation | null {
    const target = state.activations.find((a) => a.id === activationId)
    if (!target) return null
    if (target.status === 'activo') return target

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000)
    const codigoNumerico = generateNumericCode()
    const next: Activation = {
      ...target,
      codigoNumerico,
      qrPayload: JSON.stringify({
        couponId: target.couponId,
        codigo: codigoNumerico,
        exp: expiresAt.getTime(),
      }),
      activatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'activo',
      redeemedAt: undefined,
    }
    update((s) => ({
      ...s,
      activations: s.activations.map((a) => (a.id === activationId ? next : a)),
    }))
    return next
  },
  cancel(activationId: string) {
    update((s) => ({
      ...s,
      activations: s.activations.map((a) =>
        a.id === activationId ? { ...a, status: 'cancelado' as ActivationStatus } : a,
      ),
    }))
  },
  /** Demo helper: simula que un comercio canjeó el cupón */
  markRedeemed(activationId: string, ahorroEstimado?: number) {
    update((s) => ({
      ...s,
      activations: s.activations.map((a) =>
        a.id === activationId
          ? {
              ...a,
              status: 'canjeado' as ActivationStatus,
              redeemedAt: new Date().toISOString(),
              ahorroEstimado,
            }
          : a,
      ),
    }))
  },
}

function randomToken(len: number) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function generateNumericCode() {
  const n = Math.floor(100_000 + Math.random() * 900_000)
  return String(n)
}
