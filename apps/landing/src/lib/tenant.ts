import { useSyncExternalStore } from 'react'

/**
 * Tenant resolution para la LANDING comercial.
 *
 * La landing puede operar en 2 modos:
 *   a) Marca paraguas (cuponcito.app):
 *        muestra branding genérico + "Para todas las ciudades"
 *        link de signup va a app principal
 *   b) Tenant-specific (sanpedro.cuponcito.app/comercios):
 *        muestra branding del tenant + hero copy override
 *        signup link → URL con tenant slug
 *
 * Detección:
 *   1. Query string ?tenant=sanpedro
 *   2. Subdomain del host (excepto reserved)
 *   3. VITE_TENANT_SLUG build-time
 *   4. null → modo paraguas
 */

const RESERVED = new Set(['www', 'api', 'admin', 'owner', 'app', 'comercios'])

export type LandingTenant = {
  slug: string
  nombre: string
  ciudad: string
  provincia?: string
  subdomain: string
  brand: {
    logoUrl?: string
    primaryColor?: string
    accentColor?: string
    heroEyebrow?: string
    heroHeadline?: string
  }
}

type State = {
  slug: string | null
  config: LandingTenant | null
  loading: boolean
}

const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001'

function detectSlug(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const url = new URL(window.location.href)
    const q = url.searchParams.get('tenant')
    if (q) return q.toLowerCase()
  } catch {
    /* noop */
  }
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return (import.meta.env.VITE_TENANT_SLUG as string | undefined) ?? null
  }
  const parts = host.split('.')
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase()
    if (!RESERVED.has(sub)) return sub
  }
  return (import.meta.env.VITE_TENANT_SLUG as string | undefined) ?? null
}

let state: State = {
  slug: detectSlug(),
  config: null,
  loading: false,
}

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((fn) => fn())
}

export function getTenantSnapshot() {
  return state
}

export function useTenant() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    getTenantSnapshot,
    getTenantSnapshot,
  )
}

export async function loadTenantConfig() {
  if (!state.slug) return
  state = { ...state, loading: true }
  notify()
  try {
    const res = await fetch(
      `${API_URL.replace(/\/$/, '')}/api/v1/tenant/${state.slug}/config`,
    )
    if (!res.ok) {
      state = { ...state, loading: false }
      notify()
      return
    }
    const json = (await res.json()) as { ok: boolean; tenant: LandingTenant }
    if (json.ok && json.tenant) {
      state = { ...state, config: json.tenant, loading: false }
      applyBrandingToDom(json.tenant)
    } else {
      state = { ...state, loading: false }
    }
    notify()
  } catch {
    state = { ...state, loading: false }
    notify()
  }
}

function applyBrandingToDom(t: LandingTenant) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (t.brand?.primaryColor) root.style.setProperty('--tenant-primary', t.brand.primaryColor)
  if (t.brand?.accentColor) root.style.setProperty('--tenant-accent', t.brand.accentColor)
  if (t.nombre) document.title = `${t.nombre} · Sumá tu comercio`
  if (t.brand?.primaryColor) {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', t.brand.primaryColor)
  }
}
