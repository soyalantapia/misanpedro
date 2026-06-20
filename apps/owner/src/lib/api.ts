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
  // ─── Auth ─────────────────────────────────────────────────────
  async login(input: { email: string; password: string; totp?: string }) {
    return api<
      | {
          ok: true
          setup2FA?: boolean
          totpUri?: string
          secret?: string
          message?: string
          needTotp?: boolean
          access?: string
          refresh?: string
          refreshExpiresAt?: string
          owner?: {
            id: string
            email: string
            nombre: string
            rol: string
          }
        }
      | { ok: false; error: string }
    >('/api/v1/owner/auth/login', { method: 'POST', body: input, skipAuth: true })
  },

  async verify2FA(input: { email: string; password: string; totp: string }) {
    return api<{ ok: boolean; message?: string; error?: string }>(
      '/api/v1/owner/auth/2fa/verify',
      { method: 'POST', body: input, skipAuth: true },
    )
  },

  async logout(refresh: string) {
    return api<{ ok: boolean }>('/api/v1/owner/auth/logout', {
      method: 'POST',
      body: { refresh },
      skipAuth: true,
    })
  },

  // O1: password recovery del owner.
  // forgotPassword devuelve { ok: true } siempre (anti-enumeration).
  // resetPassword necesita el token del email.
  async forgotPassword(email: string) {
    return api<{ ok: true } | { ok: false; error: string }>(
      '/api/v1/owner/auth/forgot-password',
      { method: 'POST', body: { email }, skipAuth: true },
    )
  },

  async resetPassword(input: { token: string; newPassword: string }) {
    return api<{ ok: true } | { ok: false; error: string }>(
      '/api/v1/owner/auth/reset-password',
      { method: 'POST', body: input, skipAuth: true },
    )
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
        revenue: { mrrARS: number; currency: string }
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

  async listSubscriptions(params: { appId?: string; status?: string; limit?: number } = {}) {
    const qs = new URLSearchParams()
    if (params.appId) qs.set('appId', params.appId)
    if (params.status) qs.set('status', params.status)
    if (params.limit) qs.set('limit', String(params.limit))
    return api<{
      ok: boolean
      subscriptions: Array<any>
    }>(`/api/v1/owner/subscriptions?${qs}`)
  },
}
