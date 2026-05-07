import { useSyncExternalStore } from 'react'
import type { MerchantSession } from './types'
import { findMerchantUser, getAllMerchantUsers } from '@/data/mockData'
import { merchantApi, tokens } from './api'

const STORAGE_KEY = 'misanpedro.merchant.v1'

type State = {
  session: MerchantSession | null
  apiUser?: { id: string; email: string; nombre: string; rol: string; merchantId: string } | null
  apiMerchant?: { id: string; slug: string; nombre: string; categoria: string } | null
}

const empty: State = { session: null, apiUser: null, apiMerchant: null }

function load(): State {
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as State
    return {
      session: parsed.session ?? null,
      apiUser: parsed.apiUser ?? null,
      apiMerchant: parsed.apiMerchant ?? null,
    }
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
  async login(
    email: string,
    password: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    // Intento 1: API real
    try {
      const data = await merchantApi.login(email, password)
      const session: MerchantSession = {
        userId: data.user.id,
        merchantId: data.merchant.id,
        loggedAt: new Date().toISOString(),
      }
      update(() => ({
        session,
        apiUser: data.user,
        apiMerchant: { ...data.merchant },
      }))
      return { ok: true }
    } catch (apiErr) {
      // Fallback: si el backend está caído, usamos los seed locales para no
      // romper la demo. Esto se puede deshabilitar cuando todo esté en prod.
      const user = findMerchantUser(email, password)
      if (!user) {
        const msg = (apiErr as Error)?.message ?? 'Email o contraseña incorrectos'
        return { ok: false, error: msg }
      }
      const session: MerchantSession = {
        userId: user.id,
        merchantId: user.merchantId,
        loggedAt: new Date().toISOString(),
      }
      update(() => ({ session, apiUser: null, apiMerchant: null }))
      return { ok: true }
    }
  },
  async logout() {
    try {
      await merchantApi.logout()
    } catch {
      /* noop */
    }
    tokens.clear('merchant')
    update(() => empty)
  },
  getCurrentUser() {
    if (state.apiUser) return state.apiUser
    if (!state.session) return null
    const localUser = getAllMerchantUsers().find((u) => u.id === state.session!.userId)
    return localUser ?? null
  },
}
