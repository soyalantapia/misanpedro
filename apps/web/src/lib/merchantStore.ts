import { useSyncExternalStore } from 'react'
import type { MerchantSession } from './types'
import { merchantApi, tokens, ApiError } from './api'

const STORAGE_KEY = 'misanpedro.merchant.v1'

type State = {
  session: MerchantSession | null
  apiUser?: { id: string; email: string; nombre: string; rol: string; merchantId: string } | null
  apiMerchant?: { id: string; slug: string; nombre: string; categoria: string; estado?: string } | null
  /** Modo soporte: si la sesión es un owner impersonando, datos para el banner. */
  support?: { impersonatedBy: string; ownerEmail?: string | null } | null
}

const empty: State = { session: null, apiUser: null, apiMerchant: null, support: null }

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
      support: parsed.support ?? null,
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

// Sincronización entre PESTAÑAS: el `state` vive en memoria del módulo, así que un
// login/logout o una expiración en otra tab no se veía acá (tab B seguía mostrando
// el panel logueado tras un logout en tab A — caja compartida del comercio). Al
// cambiar el STORAGE_KEY o los tokens del comercio en otra tab, recargamos el
// estado desde localStorage y notificamos para que todas las pestañas coincidan.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    const relevant =
      e.key === null || e.key === STORAGE_KEY || e.key.startsWith('msp.tok.merchant')
    if (!relevant) return
    state = load()
    notify()
  })
}

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
  // ─── Login OTP (passwordless) ───
  async requestOtp(
    email: string,
  ): Promise<{ ok: true; registered: boolean; debugCode?: string } | { ok: false; error: string }> {
    try {
      const data = await merchantApi.requestOtp(email)
      // Default conservador: si el backend no manda `registered` (versión vieja),
      // asumimos registrado → flujo OTP normal, nunca redirigimos por error.
      return { ok: true, registered: data.registered !== false, debugCode: data._debugCode }
    } catch (err) {
      const msg = (err as Error)?.message ?? ''
      const isNetwork = /fetch|network|connect/i.test(msg)
      return {
        ok: false,
        error: isNetwork
          ? 'Sin conexión. Verificá tu red e intentá de nuevo.'
          : 'No pudimos enviar el código. Reintentá en un momento.',
      }
    }
  },
  async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const data = await merchantApi.verifyOtp(email, code)
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
        return { ok: false, error: 'Código incorrecto o vencido. Pedí uno nuevo.' }
      }
      if (apiErr instanceof ApiError && apiErr.status === 429) {
        return {
          ok: false,
          error: 'Demasiados intentos. Esperá un momento y pedí un código nuevo.',
        }
      }
      // 403 → comercio suspendido/cancelado (no es problema del código).
      if (apiErr instanceof ApiError && apiErr.status === 403) {
        const estado = (apiErr.payload?.estado ?? '').toString().toLowerCase()
        if (estado === 'suspendido') {
          return { ok: false, error: 'Tu cuenta está suspendida. Escribinos a soporte para reactivarla.' }
        }
        if (estado === 'cancelado') {
          return { ok: false, error: 'Tu cuenta fue cancelada. Si querés volver, escribinos a soporte.' }
        }
        return {
          ok: false,
          error: apiErr.message || 'Tu cuenta tiene un problema de acceso. Escribinos a soporte.',
        }
      }
      const msg = (apiErr as Error)?.message ?? ''
      const isNetwork = /fetch|network|connect/i.test(msg)
      return {
        ok: false,
        error: isNetwork
          ? 'Sin conexión. Verificá tu red e intentá de nuevo.'
          : 'No pudimos verificar el código. Reintentá.',
      }
    }
  },
  // Modo soporte: canjea el código (que el owner generó) por una sesión que actúa
  // como el propietario. Guarda la sesión + el flag de soporte para el banner.
  async supportExchange(
    code: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const data = await merchantApi.supportExchange(code)
      const session: MerchantSession = {
        userId: data.user.id,
        merchantId: data.merchant.id,
        loggedAt: new Date().toISOString(),
      }
      update(() => ({
        session,
        apiUser: data.user,
        apiMerchant: { ...data.merchant },
        support: {
          impersonatedBy: data.support.impersonatedBy,
          ownerEmail: data.support.ownerEmail,
        },
      }))
      return { ok: true }
    } catch (err) {
      const msg = (err as Error)?.message ?? ''
      const expired = /inv[áa]lido|vencid/i.test(msg)
      return {
        ok: false,
        error: expired
          ? 'El enlace de soporte venció o ya se usó. Generá uno nuevo desde el panel owner.'
          : 'No pudimos iniciar el modo soporte. Probá de nuevo.',
      }
    }
  },
  async signup(payload: {
    comercio: {
      nombre: string
      categoria: any
      /** Texto libre si categoria === 'otro'. */
      categoriaOtro?: string
      direccion: string
      /** Coordenadas marcadas en el mapa al registrarse. */
      lat?: number
      lng?: number
      telefono: string
      /** Horarios ahora opcional — se completa después en el panel. */
      horarios?: string
      cuit?: string
      razonSocial?: string
      condicionFiscal?: 'monotributo' | 'responsable_inscripto' | 'consumidor_final'
      direccionFiscal?: string
    }
    admin: { nombre: string; email: string; password?: string }
    /** Código de referido (opcional). */
    ref?: string
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
