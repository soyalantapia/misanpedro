import { useSyncExternalStore } from 'react'
import { SEED_MERCHANTS } from '@/data/seedMerchants'
import type { Merchant } from './types'

const STORAGE_KEY = 'misanpedro.merchants.v1'

type State = { merchants: Merchant[] }

function load(): State {
  if (typeof window === 'undefined') return { merchants: SEED_MERCHANTS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { merchants: SEED_MERCHANTS }
    const parsed = JSON.parse(raw) as State
    if (!Array.isArray(parsed.merchants)) return { merchants: SEED_MERCHANTS }
    return { merchants: parsed.merchants }
  } catch {
    return { merchants: SEED_MERCHANTS }
  }
}

function persist(s: State) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

let state: State = load()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function getSnapshot() {
  return state.merchants
}

function update(updater: (s: State) => State) {
  state = updater(state)
  persist(state)
  notify()
}

export function useMerchants() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useMerchant(id: string | undefined) {
  return useMerchants().find((m) => m.id === id)
}

export function getMerchantSync(id: string): Merchant | undefined {
  return state.merchants.find((m) => m.id === id)
}

export const merchantsActions = {
  patch(id: string, patch: Partial<Merchant>) {
    update((s) => ({
      merchants: s.merchants.map((m) => (m.id === id ? { ...m, ...patch, id: m.id } : m)),
    }))
  },
  create(input: Omit<Merchant, 'id'>): Merchant {
    const id = slugify(input.nombre) + '-' + Math.random().toString(36).slice(2, 6)
    const merchant: Merchant = { ...input, id }
    update((s) => ({ merchants: [merchant, ...s.merchants] }))
    return merchant
  },
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}
