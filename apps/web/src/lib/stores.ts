import { useSyncExternalStore } from 'react'
import type { Activation, ActivationStatus, User } from './types'

type StorageShape = {
  /** Vecino que está navegando la app actualmente. */
  user: User | null
  /** Vecinos demo (no son la sesión actual, son referencias para mostrar
   *  múltiples clientes en el panel del comercio). */
  demoUsers: User[]
  activations: Activation[]
}

const STORAGE_KEY = 'misanpedro.v1'

const empty: StorageShape = { user: null, demoUsers: [], activations: [] }

function load(): StorageShape {
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<StorageShape>
    return {
      user: parsed.user ?? null,
      demoUsers: Array.isArray(parsed.demoUsers) ? parsed.demoUsers : [],
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

// Loop de expiración local DESHABILITADO.
// Los códigos ya no expiran por tiempo — viven mientras el cupón esté activo.
// El canje se valida en runtime contra el cupón en /redemptions/confirm.
// Activaciones legacy con status='expirado' siguen funcionando porque otros
// chequeos (canjeado, cancelado) las descartan correctamente.

// Storage events: sincroniza cambios entre tabs del mismo browser
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    const next = load()
    state = next
    notify()
  })
}

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function getActivationsSnapshot() {
  return state.activations
}

export function getUserSnapshot() {
  return state.user
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
  const userId = useStore().user?.id
  if (!userId) return undefined
  return useStore().activations.find(
    (a) => a.couponId === couponId && a.userId === userId && a.status === 'activo',
  )
}

/** Devuelve un User por id buscando entre el current y los demoUsers. */
export function useUserById(id: string | undefined) {
  const s = useStore()
  if (!id) return undefined
  if (s.user?.id === id) return s.user
  return s.demoUsers.find((u) => u.id === id)
}

export function getAllUsers(): User[] {
  return [state.user, ...state.demoUsers].filter(Boolean) as User[]
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
  /** Reemplaza el user actual con datos del API (mantiene demoUsers + activations). */
  replace(user: User) {
    update((s) => ({ ...s, user }))
  },
  signOut() {
    update((s) => ({ ...s, user: null }))
  },
}

export const demoStoreActions = {
  /** Reemplaza activaciones + users demo de una. Usado por el seeder. */
  bulkSeed(input: { user?: User | null; demoUsers: User[]; activations: Activation[] }) {
    update(() => ({
      user: input.user ?? null,
      demoUsers: input.demoUsers,
      activations: input.activations,
    }))
  },
  /** Inserta o reemplaza una activación por id. */
  upsertActivation(activation: Activation) {
    update((s) => {
      const idx = s.activations.findIndex((a) => a.id === activation.id)
      if (idx === -1) return { ...s, activations: [activation, ...s.activations] }
      const next = [...s.activations]
      next[idx] = activation
      return { ...s, activations: next }
    })
  },
  /** Elimina TODOS los datos demo dejando el storage vacío. */
  resetAll() {
    update(() => empty)
  },
}

export const activationActions = {
  activate(
    couponId: string,
    overrides?: { id?: string; codigoNumerico?: string; qrPayload?: string },
  ): Activation {
    const userId = state.user?.id
    if (!userId) throw new Error('No hay usuario logueado')
    const existing = state.activations.find(
      (a) =>
        a.couponId === couponId && a.userId === userId && a.status === 'activo',
    )
    if (existing) return existing

    const now = new Date()
    const codigoNumerico = overrides?.codigoNumerico ?? generateNumericCode()
    const id = overrides?.id ?? `a-${randomToken(10)}`
    const activation: Activation = {
      id,
      couponId,
      userId,
      codigoNumerico,
      qrPayload:
        overrides?.qrPayload ??
        JSON.stringify({
          couponId,
          userId,
          activationId: id,
          codigo: codigoNumerico,
        }),
      activatedAt: now.toISOString(),
      // Sin expiresAt: los códigos no expiran por tiempo.
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
    const codigoNumerico = generateNumericCode()
    const next: Activation = {
      ...target,
      codigoNumerico,
      qrPayload: JSON.stringify({
        couponId: target.couponId,
        userId: target.userId,
        codigo: codigoNumerico,
      }),
      activatedAt: now.toISOString(),
      // expiresAt limpio (las activations nuevas no lo necesitan)
      expiresAt: undefined,
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
  /** Marca una activación como canjeada. Usado por el polling de
   *  CuponActivoPage cuando el API confirma + por simular en modo demo. */
  markRedeemed(activationId: string, ahorroEstimado?: number, montoTicket?: number) {
    update((s) => ({
      ...s,
      activations: s.activations.map((a) =>
        a.id === activationId
          ? {
              ...a,
              status: 'canjeado' as ActivationStatus,
              redeemedAt: new Date().toISOString(),
              ahorroEstimado,
              montoTicket: montoTicket ?? a.montoTicket,
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
