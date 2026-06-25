import { authActions, getAuthSnapshot } from './store'

/**
 * Cliente API del Owner Panel. Wrap simple alrededor de fetch con:
 *  - Authorization: Bearer {access} automático
 *  - Refresh automático cuando devuelve 401 (1 retry)
 *  - Sign-out cuando refresh también falla
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

type ApiOpts = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Skip auto-attach del Bearer (para endpoints públicos como /login). */
  skipAuth?: boolean
}

async function rawFetch<T = unknown>(path: string, opts: ApiOpts = {}): Promise<T> {
  const auth = getAuthSnapshot()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (!opts.skipAuth && auth.access) {
    headers.Authorization = `Bearer ${auth.access}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  let bodyText = ''
  try {
    bodyText = await res.text()
  } catch {
    /* noop */
  }
  let json: any
  try {
    json = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    json = { raw: bodyText }
  }

  if (!res.ok) {
    throw new ApiError(res.status, json?.error ?? res.statusText, json)
  }
  return json as T
}

export async function api<T = unknown>(path: string, opts: ApiOpts = {}): Promise<T> {
  try {
    return await rawFetch<T>(path, opts)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !opts.skipAuth) {
      // Intento un refresh
      const ok = await tryRefresh()
      if (ok) {
        return await rawFetch<T>(path, opts)
      }
      authActions.signOut()
    }
    throw err
  }
}

async function tryRefresh(): Promise<boolean> {
  const auth = getAuthSnapshot()
  if (!auth.refresh) return false
  try {
    const r = await rawFetch<{
      ok: boolean
      access: string
      refresh: string
      refreshExpiresAt: string
    }>('/api/v1/owner/auth/refresh', {
      method: 'POST',
      body: { refresh: auth.refresh },
      skipAuth: true,
    })
    if (r.ok && r.access) {
      authActions.updateTokens({
        access: r.access,
        refresh: r.refresh,
        refreshExpiresAt: r.refreshExpiresAt,
      })
      return true
    }
  } catch {
    /* refresh failed */
  }
  return false
}

// ════════════════════════════════════════════════════════════════
//                       Type-safe endpoints
// ════════════════════════════════════════════════════════════════

export const owner = {
  // ─── Auth OTP (passwordless) ──────────────────────────────────
  async requestOtp(email: string) {
    return api<{ ok: true; _debugCode?: string } | { ok: false; error: string }>(
      '/api/v1/owner/auth/request-otp',
      { method: 'POST', body: { email }, skipAuth: true },
    )
  },

  async verifyOtp(input: { email: string; code: string }) {
    return api<
      | {
          ok: true
          access: string
          refresh: string
          refreshExpiresAt: string
          owner: { id: string; email: string; nombre: string; rol: string }
        }
      | { ok: false; error: string }
    >('/api/v1/owner/auth/verify-otp', { method: 'POST', body: input, skipAuth: true })
  },

  async logout(refresh: string) {
    return api<{ ok: boolean }>('/api/v1/owner/auth/logout', {
      method: 'POST',
      body: { refresh },
      skipAuth: true,
    })
  },

  async me() {
    return api<{ ok: boolean; owner: any }>('/api/v1/owner/me')
  },

  // ─── Métricas ─────────────────────────────────────────────────
  async metrics() {
    return api<{
      ok: boolean
      metrics: {
        apps: { total: number; active: number }
        merchants: { total: number; active: number }
        users: { total: number }
        redemptions: { last30Days: number }
        revenue: { mrrARS: number; currency: string; byCurrency?: Record<string, number> }
      }
    }>('/api/v1/owner/metrics')
  },

  // ─── Apps ─────────────────────────────────────────────────────
  async listApps() {
    return api<{
      ok: boolean
      apps: Array<{
        id: string
        slug: string
        nombre: string
        ciudad: string
        subdomain: string
        customDomain?: string
        status: 'pending' | 'active' | 'suspended' | 'archived'
        plan: string
        cachedStats?: {
          lastUpdatedAt?: string
          totalMerchants: number
          activeMerchants: number
          totalUsers: number
          activeCoupons: number
          redemptionsLast30Days: number
        }
        createdAt: string
      }>
    }>('/api/v1/owner/apps')
  },

  async createApp(input: {
    slug: string
    nombre: string
    ciudad: string
    provincia?: string
    pais?: string
    moneda?: string
    locale?: string
    precioMensual?: number
    subdomain?: string
    primaryColor?: string
    accentColor?: string
    phonePrefix?: string
    geoCenter?: { lat: number; lng: number }
    legal?: {
      razonSocial?: string
      taxId?: string
      taxIdLabel?: string
      condicionFiscal?: string
      domicilio?: string
      jurisdiccion?: string
    }
  }) {
    return api<{ ok: boolean; app: any }>('/api/v1/owner/apps', {
      method: 'POST',
      body: input,
    })
  },

  async getApp(id: string) {
    return api<{ ok: boolean; app: any }>(`/api/v1/owner/apps/${id}`)
  },

  async updateApp(id: string, patch: any) {
    return api<{ ok: boolean; app: any }>(`/api/v1/owner/apps/${id}`, {
      method: 'PATCH',
      body: patch,
    })
  },

  async appMetrics(id: string) {
    return api<{
      ok: boolean
      metrics: {
        merchants: { total: number; active: number }
        users: { total: number }
        coupons: { total: number; active: number }
        redemptions: { last30Days: number; last7Days: number }
      }
    }>(`/api/v1/owner/apps/${id}/metrics`)
  },

  // ─── Cross-app data ───────────────────────────────────────────
  async listMerchants(params: { appId?: string; estado?: string; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams()
    if (params.appId) qs.set('appId', params.appId)
    if (params.estado) qs.set('estado', params.estado)
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.offset) qs.set('offset', String(params.offset))
    return api<{
      ok: boolean
      merchants: Array<any>
      total: number
      limit: number
      offset: number
    }>(`/api/v1/owner/merchants?${qs}`)
  },

  async listUsers(params: { appId?: string; q?: string; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams()
    if (params.appId) qs.set('appId', params.appId)
    if (params.q) qs.set('q', params.q)
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.offset) qs.set('offset', String(params.offset))
    return api<{
      ok: boolean
      users: Array<any>
      total: number
      limit: number
      offset: number
    }>(`/api/v1/owner/users?${qs}`)
  },

  async listSubscriptions(params: { appId?: string; status?: string; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams()
    if (params.appId) qs.set('appId', params.appId)
    if (params.status) qs.set('status', params.status)
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.offset) qs.set('offset', String(params.offset))
    return api<{
      ok: boolean
      subscriptions: Array<any>
      total: number
      limit: number
      offset: number
    }>(`/api/v1/owner/subscriptions?${qs}`)
  },

  // ─── Acciones de gestión ──────────────────────────────────────
  async setMerchantEstado(id: string, estado: 'activo' | 'suspendido') {
    return api<{ ok: boolean; merchant: any }>(`/api/v1/owner/merchants/${id}`, {
      method: 'PATCH',
      body: { estado },
    })
  },

  async setSubscriptionStatus(id: string, status: 'authorized' | 'paused' | 'cancelled') {
    return api<{ ok: boolean; subscription: any }>(`/api/v1/owner/subscriptions/${id}`, {
      method: 'PATCH',
      body: { status },
    })
  },

  async auditLog() {
    return api<{
      ok: boolean
      actions: Array<{ action: string; at: string; ip?: string; detail?: string }>
    }>('/api/v1/owner/me/audit')
  },

  // ─── Equipo (multi-admin, solo super) ─────────────────────────
  async listAdmins() {
    return api<{
      ok: boolean
      admins: Array<{
        id: string
        email: string
        nombre: string
        rol: string
        enabled: boolean
        lastLoginAt?: string | null
        invitedAt?: string | null
        createdAt?: string
      }>
    }>('/api/v1/owner/admins')
  },

  async inviteAdmin(input: { email: string; nombre: string; rol: string }) {
    return api<{ ok: boolean; admin?: unknown; error?: string }>('/api/v1/owner/admins', {
      method: 'POST',
      body: input,
    })
  },

  async updateAdmin(id: string, patch: { rol?: string; enabled?: boolean }) {
    return api<{ ok: boolean; admin?: unknown; error?: string }>(`/api/v1/owner/admins/${id}`, {
      method: 'PATCH',
      body: patch,
    })
  },

  async removeAdmin(id: string) {
    return api<{ ok: boolean; error?: string }>(`/api/v1/owner/admins/${id}`, { method: 'DELETE' })
  },
}
