import { useSyncExternalStore } from 'react'
import type { MerchantSession } from './types'
import { findMerchantUser, MERCHANT_USERS } from '@/data/mockData'

const STORAGE_KEY = 'misanpedro.merchant.v1'

type State = { session: MerchantSession | null }

const empty: State = { session: null }

function load(): State {
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as State
    return { session: parsed.session ?? null }
  } catch {
    return empty
  }
}

function persist(s: State) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

let state: State = load()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

function update(updater: (s: State) => State) {
  state = updater(state)
  persist(state)
  notify()
}

export function useMerchantSession() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => state,
    () => state,
  )
}

export const merchantAuth = {
  login(email: string, password: string): { ok: true } | { ok: false; error: string } {
    const user = findMerchantUser(email, password)
    if (!user) return { ok: false, error: 'Email o contraseña incorrectos' }
    const session: MerchantSession = {
      userId: user.id,
      merchantId: user.merchantId,
      loggedAt: new Date().toISOString(),
    }
    update(() => ({ session }))
    return { ok: true }
  },
  logout() {
    update(() => empty)
  },
  getCurrentUser() {
    if (!state.session) return null
    return MERCHANT_USERS.find((u) => u.id === state.session!.userId) ?? null
  },
}
