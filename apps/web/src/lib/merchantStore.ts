import { useSyncExternalStore } from 'react'
import type { MerchantSession } from './types'
import { merchantApi, tokens, ApiError } from './api'

const STORAGE_KEY = 'misanpedro.merchant.v1'

type State = {
  session: MerchantSession | null
  apiUser?: { id: string; email: string; nombre: string; rol: string; merchantId: string } | null
  apiMerchant?: { id: string; slug: string; nombre: string; categoria: string; estado?: string } | null
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
    // Sólo API real. Sin fallback local: el comercio tiene que existir en
    // la DB para poder validar cupones, recibir notificaciones, cobrar, etc.
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
      if (apiErr instanceof ApiError && apiErr.status === 401) {
        return { ok: false, error: 'Email o contraseña incorrectos. Verificá los datos e intentá de nuevo.' }
      }
      // 403 → backend devuelve esto cuando el comercio está suspendido o
      // cancelado (no es problema de credenciales). Mostrar mensaje específico
      // para que Sandra NO pierda tiempo reseteando password.
      if (apiErr instanceof ApiError && apiErr.status === 403) {
        const estado = (apiErr.payload?.estado ?? '').toString().toLowerCase()
        if (estado === 'suspendido') {
          return {
            ok: false,
            error:
              'Tu cuenta está suspendida. Escribinos a soporte para reactivarla.',
          }
        }
        if (estado === 'cancelado') {
          return {
            ok: false,
            error:
              'Tu cuenta fue cancelada. Si querés volver a usar Cuponcito, escribinos a soporte.',
          }
        }
        // 403 sin estado conocido — fallback con mensaje claro
        return {
          ok: false,
          error:
            apiErr.message ||
            'Tu cuenta tiene un problema de acceso. Escribinos a soporte.',
        }
      }
      const msg = (apiErr as Error)?.message ?? ''
      const isNetwork = /fetch|network|connect/i.test(msg)
      return { ok: false, error: isNetwork ? 'Sin conexión. Verificá tu red e intentá de nuevo.' : 'No pudimos iniciar sesión. Verificá tu conexión.' }
    }
  },
  async signup(payload: {
    comercio: {
      nombre: string
      categoria: any
      /** Texto libre si categoria === 'otro'. */
      categoriaOtro?: string
      direccion: string
      telefono: string
      /** Horarios ahora opcional — se completa después en el panel. */
      horarios?: string
      cuit?: string
      razonSocial?: string
      condicionFiscal?: 'monotributo' | 'responsable_inscripto' | 'consumidor_final'
      direccionFiscal?: string
    }
    admin: { nombre: string; email: string; password: string }
    acceptedTc?: boolean
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const data = await merchantApi.signup({ ...payload, acceptedTc: true })
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
    } catch (err) {
      return { ok: false, error: (err as Error)?.message ?? 'no se pudo crear el comercio' }
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
    return state.apiUser ?? null
  },
  getCurrentMerchant() {
    return state.apiMerchant ?? null
  },
}
