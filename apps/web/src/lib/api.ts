/**
 * Cliente HTTP del API. Maneja:
 *   - base URL desde VITE_API_URL (default http://localhost:3001)
 *   - access + refresh tokens en localStorage
 *   - auto-refresh en 401 si hay refresh token
 *   - separación user / merchant_user (cada uno guarda su propio par de tokens)
 */

const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001'
const BASE = `${API_URL.replace(/\/$/, '')}/api/v1`

type Subject = 'user' | 'merchant'

const STORAGE = {
  user: { access: 'msp.tok.user.access', refresh: 'msp.tok.user.refresh' },
  merchant: { access: 'msp.tok.merchant.access', refresh: 'msp.tok.merchant.refresh' },
} as const

export const tokens = {
  get(s: Subject) {
    return {
      access: localStorage.getItem(STORAGE[s].access),
      refresh: localStorage.getItem(STORAGE[s].refresh),
    }
  },
  set(s: Subject, access: string, refresh?: string) {
    localStorage.setItem(STORAGE[s].access, access)
    if (refresh) localStorage.setItem(STORAGE[s].refresh, refresh)
  },
  clear(s: Subject) {
    localStorage.removeItem(STORAGE[s].access)
    localStorage.removeItem(STORAGE[s].refresh)
    // Notificamos al UI que se perdió la sesión. Cualquier handler puede
    // escuchar `msp:session-expired` y redirigir a la pantalla de login
    // correspondiente (vecino o comercio).
    try {
      window.dispatchEvent(
        new CustomEvent('msp:session-expired', { detail: { subject: s } }),
      )
    } catch {
      /* SSR / no window — noop */
    }
  },
}

export class ApiError extends Error {
  status: number
  payload: any
  constructor(status: number, payload: any) {
    super(payload?.error ?? `HTTP ${status}`)
    this.status = status
    this.payload = payload
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { subject?: Subject } = {},
): Promise<T> {
  const { subject, headers, ...rest } = init
  const accessKey = subject ? STORAGE[subject].access : null
  const access = accessKey ? localStorage.getItem(accessKey) : null
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  }
  if (access) finalHeaders.Authorization = `Bearer ${access}`

  // Multi-tenant: pasamos el slug via header X-Tenant-Slug en cada request.
  // Importamos perezosamente para evitar ciclo (api.ts ↔ tenant.ts).
  if (!finalHeaders['X-Tenant-Slug']) {
    try {
      const { getTenantSnapshot } = await import('./tenant')
      const slug = getTenantSnapshot().slug
      if (slug) finalHeaders['X-Tenant-Slug'] = slug
    } catch {
      /* tenant module no disponible — sin header */
    }
  }

  const res = await fetch(`${BASE}${path}`, { ...rest, headers: finalHeaders })

  // Auto-refresh en 401
  if (res.status === 401 && subject) {
    const refresh = localStorage.getItem(STORAGE[subject].refresh)
    if (refresh) {
      const refreshPath = subject === 'merchant' ? '/merchant/auth/refresh' : '/auth/refresh'
      const r = await fetch(`${BASE}${refreshPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      })
      if (r.ok) {
        const data = (await r.json()) as { accessToken: string; refreshToken?: string }
        // Si el backend implementa rotation, persistimos también el nuevo refresh
        tokens.set(subject, data.accessToken, data.refreshToken)
        finalHeaders.Authorization = `Bearer ${data.accessToken}`
        const retry = await fetch(`${BASE}${path}`, { ...rest, headers: finalHeaders })
        if (retry.status === 401) {
          // Si el retry sigue 401, los tokens están rotos; limpiamos.
          tokens.clear(subject)
          throw new ApiError(401, await retry.json().catch(() => ({})))
        }
        if (!retry.ok) throw new ApiError(retry.status, await retry.json().catch(() => ({})))
        return retry.json() as Promise<T>
      } else {
        // refresh falló → tokens inválidos, limpiamos
        tokens.clear(subject)
      }
    } else {
      // 401 sin refresh disponible → limpiamos también
      tokens.clear(subject)
    }
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new ApiError(res.status, payload)
  }
  return res.json() as Promise<T>
}

const json = (body: unknown) => ({
  method: 'POST' as const,
  body: JSON.stringify(body),
})

// ─── Tipos compartidos (mínimos) ─────────────────────────────────────

export type ApiMerchant = {
  id: string
  slug: string
  nombre: string
  categoria: string
  /** Texto libre si categoria === 'otro' (ej: "rotisería"). */
  categoriaOtro?: string
  direccion: string
  lat?: number
  lng?: number
  telefono: string
  horarios: string
  horariosDetalle?: any
  cover?: string
  coverImageUrl?: string
  logoUrl?: string
  mapsUrl?: string
  logoSeed?: string
  destacado?: boolean
  foundingMember?: boolean
  nivel?: string
  estado?: string
  razonSocial?: string
  cuit?: string
  condicionFiscal?: 'monotributo' | 'responsable_inscripto' | 'consumidor_final'
  direccionFiscal?: string
  notasInternas?: string
  arrepentimientoExpiraEn?: string
  arrepentido?: boolean
}

export type ApiCoupon = {
  id: string
  merchantId: string
  titulo: string
  descripcion: string
  condiciones?: string
  porcentaje: number
  vigenciaHasta: string
  diasAplica?: string
  estado: string
  stockMaximo?: number
  stockUsado?: number
  imagenUrl?: string
  merchant?: Pick<ApiMerchant, 'id' | 'slug' | 'nombre' | 'categoria' | 'logoSeed' | 'cover'>
}

export type ApiActivation = {
  id: string
  couponId: string
  userId: string
  codigoNumerico: string
  qrPayload: string
  activatedAt: string
  expiresAt: string
  status: 'activo' | 'canjeado' | 'expirado' | 'cancelado'
  redeemedAt?: string
  ahorroEstimado?: number
  montoTicket?: number
  coupon?: { id: string; titulo: string; porcentaje: number; merchantId: string; imagenUrl?: string }
  merchant?: { id: string; slug: string; nombre: string; categoria: string; logoSeed?: string }
}

export type ApiMerchantSession = {
  user: { id: string; email: string; nombre: string; rol: string; merchantId: string }
  merchant: { id: string; slug: string; nombre: string; categoria: string; estado?: string }
}

export type ApiUserSession = {
  id: string
  nombre: string
  dni: string
  email: string
  whatsapp: string
  fechaNacimiento: string
}

// ─── Auth merchant ───────────────────────────────────────────────────

export const merchantApi = {
  async login(email: string, password: string) {
    const data = await request<{
      accessToken: string
      refreshToken: string
      user: ApiMerchantSession['user']
      merchant: ApiMerchantSession['merchant']
    }>('/merchant/auth/login', json({ email, password }))
    tokens.set('merchant', data.accessToken, data.refreshToken)
    return data
  },
  async forgotPassword(email: string) {
    return request<{ ok: boolean }>(
      '/merchant/auth/forgot-password',
      json({ email }),
    )
  },
  async resetPassword(token: string, newPassword: string) {
    return request<{ ok: boolean }>(
      '/merchant/auth/reset-password',
      json({ token, newPassword }),
    )
  },
  async signup(payload: {
    comercio: {
      nombre: string
      categoria: string
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
    acceptedTc: true
  }) {
    const data = await request<{
      accessToken: string
      refreshToken: string
      user: ApiMerchantSession['user']
      merchant: ApiMerchantSession['merchant']
    }>('/merchant/auth/signup', json(payload))
    tokens.set('merchant', data.accessToken, data.refreshToken)
    return data
  },
  async logout() {
    const refresh = localStorage.getItem(STORAGE.merchant.refresh)
    try {
      if (refresh) await request('/merchant/auth/logout', json({ refreshToken: refresh }))
    } catch {
      /* noop */
    }
    tokens.clear('merchant')
  },
  async me() {
    return request<{ ok: boolean; user: ApiMerchantSession['user']; merchant: ApiMerchantSession['merchant'] }>(
      '/merchant/auth/me',
      { subject: 'merchant' },
    )
  },
}

// ─── Plantillas de cupones ───────────────────────────────────────────

export const templates = {
  async coupons(categoria: string) {
    return request<{
      ok: boolean
      templates: Array<{
        titulo: string
        descripcion: string
        condiciones?: string
        porcentaje: number
        diasAplica?: string
      }>
    }>(`/templates/coupons/${categoria}`)
  },
}

// ─── Habeas Data (vecino) ────────────────────────────────────────────

export const habeasData = {
  async exportMyData() {
    return request<any>('/auth/me/data-export', { subject: 'user' })
  },
  async deleteMyAccount() {
    return request<{ ok: boolean; mensaje: string }>('/auth/me', {
      method: 'DELETE',
      subject: 'user',
    })
  },
}

// ─── Notas internas (comercio) ───────────────────────────────────────

export const customerNotes = {
  async list(userId: string) {
    return request<{
      ok: boolean
      notes: Array<{ id: string; text: string; tags: string[]; createdAt: string }>
    }>(`/redemptions/clientes/${userId}/notes`, { subject: 'merchant' })
  },
  async create(userId: string, text: string, tags?: string[]) {
    return request<{ ok: boolean; note: any }>(
      '/redemptions/clientes/notes',
      { ...json({ userId, text, tags }), subject: 'merchant' },
    )
  },
  async delete(id: string) {
    return request<{ ok: boolean }>(`/redemptions/clientes/notes/${id}`, {
      method: 'DELETE',
      subject: 'merchant',
    })
  },
}

// ─── Suscripción / arrepentimiento ───────────────────────────────────

export const subscription = {
  async cancel() {
    return request<{ ok: boolean; arrepentimiento: boolean; mensaje: string }>(
      '/billing/cancel',
      { method: 'POST', subject: 'merchant' },
    )
  },
}

// ─── Auth vecino ─────────────────────────────────────────────────────

export const userApi = {
  async register(payload: {
    dni: string
    nombre: string
    email: string
    whatsapp: string
    fechaNacimiento: string
    acceptedTc: true
  }) {
    const data = await request<{
      accessToken: string
      refreshToken: string
      user: ApiUserSession
    }>('/auth/register', json(payload))
    tokens.set('user', data.accessToken, data.refreshToken)
    return data
  },
  async requestOtp(email: string) {
    return request<{ ok: boolean; _debugCode?: string }>(
      '/auth/request-otp',
      json({ email }),
    )
  },
  async verifyOtp(email: string, code: string) {
    const data = await request<{
      accessToken: string
      refreshToken: string
      user: ApiUserSession
    }>('/auth/verify-otp', json({ email, code }))
    tokens.set('user', data.accessToken, data.refreshToken)
    return data
  },
  async logout() {
    const refresh = localStorage.getItem(STORAGE.user.refresh)
    try {
      if (refresh) await request('/auth/logout', json({ refreshToken: refresh }))
    } catch {
      /* noop */
    }
    tokens.clear('user')
  },
  async me() {
    return request<{ ok: boolean; user: ApiUserSession }>('/auth/me', { subject: 'user' })
  },
}

// ─── Catálogo público ────────────────────────────────────────────────

export const catalog = {
  async listMerchants(filter?: { categoria?: string; q?: string }) {
    const params = new URLSearchParams()
    if (filter?.categoria) params.set('categoria', filter.categoria)
    if (filter?.q) params.set('q', filter.q)
    const qs = params.toString()
    return request<{ ok: boolean; merchants: ApiMerchant[] }>(
      `/merchants${qs ? `?${qs}` : ''}`,
    )
  },
  async getMerchant(slug: string) {
    return request<{ ok: boolean; merchant: ApiMerchant; coupons: ApiCoupon[] }>(
      `/merchants/${slug}`,
    )
  },
  async listCoupons(filter?: { categoria?: string; merchant?: string }) {
    const params = new URLSearchParams()
    if (filter?.categoria) params.set('categoria', filter.categoria)
    if (filter?.merchant) params.set('merchant', filter.merchant)
    const qs = params.toString()
    return request<{ ok: boolean; coupons: ApiCoupon[] }>(`/coupons${qs ? `?${qs}` : ''}`)
  },
  async getCoupon(id: string) {
    return request<{ ok: boolean; coupon: ApiCoupon }>(`/coupons/${id}`)
  },
}

// ─── Activations (vecino) ────────────────────────────────────────────

export const activations = {
  async create(couponId: string) {
    return request<{ ok: boolean; activation: ApiActivation }>(
      '/activations',
      { ...json({ couponId }), subject: 'user' },
    )
  },
  async mine(status?: string) {
    const qs = status ? `?status=${status}` : ''
    return request<{ ok: boolean; activations: ApiActivation[] }>(
      `/activations/me${qs}`,
      { subject: 'user' },
    )
  },
  async get(id: string) {
    return request<{ ok: boolean; activation: ApiActivation }>(`/activations/${id}`, {
      subject: 'user',
    })
  },
  async cancel(id: string) {
    return request<{ ok: boolean; activation: ApiActivation }>(`/activations/${id}/cancel`, {
      method: 'POST',
      subject: 'user',
    })
  },
}

// ─── Redemptions (comercio) ──────────────────────────────────────────

export const redemptions = {
  async validateByCode(codigoNumerico: string) {
    return request<{ ok: boolean; validation: any }>(
      '/redemptions/validate',
      { ...json({ codigoNumerico }), subject: 'merchant' },
    )
  },
  async validateByQr(qrPayload: string) {
    return request<{ ok: boolean; validation: any }>(
      '/redemptions/validate',
      { ...json({ qrPayload }), subject: 'merchant' },
    )
  },
  async confirm(activationId: string, montoTicket?: number) {
    return request<{ ok: boolean; redemption: any }>(
      '/redemptions/confirm',
      { ...json({ activationId, montoTicket }), subject: 'merchant' },
    )
  },
  async recent(limit = 50) {
    return request<{ ok: boolean; redemptions: any[] }>(
      `/redemptions/recent?limit=${limit}`,
      { subject: 'merchant' },
    )
  },
  async clientes() {
    return request<{ ok: boolean; clientes: any[] }>('/redemptions/clientes', {
      subject: 'merchant',
    })
  },
}

// ─── Cupones (comercio) ──────────────────────────────────────────────

export const merchantCoupons = {
  async listMine() {
    return request<{ ok: boolean; coupons: ApiCoupon[] }>('/coupons/mine/list', {
      subject: 'merchant',
    })
  },
  async create(payload: any) {
    return request<{ ok: boolean; coupon: ApiCoupon }>(
      '/coupons',
      { ...json(payload), subject: 'merchant' },
    )
  },
  async update(id: string, payload: any) {
    return request<{ ok: boolean; coupon: ApiCoupon }>(`/coupons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      subject: 'merchant',
    })
  },
  async delete(id: string) {
    return request<{ ok: boolean }>(`/coupons/${id}`, {
      method: 'DELETE',
      subject: 'merchant',
    })
  },
}

// ─── Merchant edit + stats ───────────────────────────────────────────

export const merchantAdmin = {
  async profile() {
    return request<{ ok: boolean; merchant: ApiMerchant }>('/merchants/me/profile', {
      subject: 'merchant',
    })
  },
  async updateMe(payload: any) {
    return request<{ ok: boolean; merchant: ApiMerchant }>('/merchants/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
      subject: 'merchant',
    })
  },
  async stats() {
    return request<{
      ok: boolean
      stats: { canjes: number; ahorroTotal: number; ingresosTotal: number; clientesUnicos: number }
    }>('/merchants/me/stats', { subject: 'merchant' })
  },
}

// ─── Billing (Mercado Pago) ──────────────────────────────────────────

export const billing = {
  async createPreapproval() {
    return request<{
      ok: boolean
      subscription: {
        id: string
        externalReference: string
        preapprovalId: string
        initPoint: string
        status: string
      }
    }>('/billing/preapproval', { ...json({ plan: 'standard' }), subject: 'merchant' })
  },
  async me() {
    return request<{ ok: boolean; subscription: any }>('/billing/me', { subject: 'merchant' })
  },
  async mockConfirm(externalReference: string) {
    return request<{ ok: boolean }>('/billing/mock-confirm', {
      ...json({ externalReference }),
      subject: 'merchant',
    })
  },
}

// ─── WhatsApp (comercio) ─────────────────────────────────────────────

export const whatsapp = {
  async status() {
    return request<{
      ok: boolean
      status: string
      qr?: string
      lastError?: string
      quota?: { used: number; max: number; remaining: number }
    }>('/wa/status', { subject: 'merchant' })
  },
  async start() {
    return request<{ ok: boolean; status: string; qr?: string }>('/wa/start', {
      method: 'POST',
      subject: 'merchant',
    })
  },
  async stop() {
    return request<{ ok: boolean }>('/wa/stop', { method: 'POST', subject: 'merchant' })
  },
  async send(to: string, text: string) {
    return request<{ ok: boolean; error?: string }>(
      '/wa/send',
      { ...json({ to, text }), subject: 'merchant' },
    )
  },
  async campaign(recipients: string[], text: string) {
    return request<{
      ok: boolean
      campaign: { id: string; sentCount: number; failedCount: number }
      quota: { used: number; max: number; remaining: number }
    }>('/wa/campaign', { ...json({ recipients, text }), subject: 'merchant' })
  },
  async campaigns() {
    return request<{
      ok: boolean
      campaigns: Array<{
        id: string
        sentAt: string
        sentCount: number
        failedCount: number
        text: string
      }>
    }>('/wa/campaigns', { subject: 'merchant' })
  },
}

export const api = {
  merchantApi,
  userApi,
  catalog,
  activations,
  redemptions,
  merchantCoupons,
  merchantAdmin,
  billing,
  whatsapp,
  templates,
  habeasData,
  customerNotes,
  subscription,
}
