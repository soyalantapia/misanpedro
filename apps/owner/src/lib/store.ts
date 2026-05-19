import { useSyncExternalStore } from 'react'

/**
 * Store global del owner panel — auth tokens + owner info.
 * Persiste en localStorage. Reactivo via useSyncExternalStore.
 */

export type OwnerProfile = {
  id: string
  email: string
  nombre: string
  rol: string
}

export type AuthState = {
  access: string | null
  refresh: string | null
  refreshExpiresAt: string | null
  owner: OwnerProfile | null
}

const STORAGE_KEY = 'cuponcito.owner.auth.v1'
const EMPTY: AuthState = { access: null, refresh: null, refreshExpiresAt: null, owner: null }

function load(): AuthState {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    return JSON.parse(raw) as AuthState
  } catch {
    return EMPTY
  }
}

function persist(s: AuthState) {
  if (typeof window === 'undefined') return
  if (!s.access) {
    window.localStorage.removeItem(STORAGE_KEY)
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  }
}

let state: AuthState = load()
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function notify() {
  listeners.forEach((fn) => fn())
}

function setState(next: AuthState) {
  state = next
  persist(state)
  notify()
}

export function getAuthSnapshot(): AuthState {
  return state
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getAuthSnapshot, getAuthSnapshot)
}

export const authActions = {
  signIn(input: { access: string; refresh: string; refreshExpiresAt: string; owner: OwnerProfile }) {
    setState({
      access: input.access,
      refresh: input.refresh,
      refreshExpiresAt: input.refreshExpiresAt,
      owner: input.owner,
    })
  },
  updateTokens(input: { access: string; refresh?: string; refreshExpiresAt?: string }) {
    setState({
      ...state,
      access: input.access,
      refresh: input.refresh ?? state.refresh,
      refreshExpiresAt: input.refreshExpiresAt ?? state.refreshExpiresAt,
    })
  },
  signOut() {
    setState(EMPTY)
  },
}

/** Sync entre tabs del mismo browser. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    state = load()
    notify()
  })
}
