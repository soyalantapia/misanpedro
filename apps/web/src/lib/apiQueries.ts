/**
 * Hooks de datos basados en el API. Pequeña capa al estilo TanStack Query
 * pero hecha a mano (zero deps) — fetch en useEffect, estado local, refetch
 * manual.
 *
 * Si el backend está caído, los hooks devuelven `error` y los pages caen al
 * store localStorage (para no romper la demo gh-pages).
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  api,
  ApiError,
  type ApiActivation,
  type ApiCoupon,
  type ApiMerchant,
  type MerchantStatsPeriodo,
} from './api'

type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    fn()
      .then((res) => {
        if (mounted.current) setData(res)
      })
      .catch((err: unknown) => {
        if (mounted.current) {
          const msg = err instanceof ApiError ? err.message : (err as Error)?.message ?? 'error'
          setError(msg)
        }
      })
      .finally(() => {
        if (mounted.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const refetch = useCallback(() => setTick((n) => n + 1), [])
  return { data, loading, error, refetch }
}

// ─── Catálogo público ────────────────────────────────────────────────

export function useApiMerchants(filter?: { categoria?: string; q?: string }) {
  const result = useAsync(
    () => api.catalog.listMerchants(filter).then((r) => r.merchants),
    [filter?.categoria, filter?.q],
  )
  return result
}

export function useApiMerchant(slug: string | undefined) {
  return useAsync(
    () => (slug ? api.catalog.getMerchant(slug) : Promise.resolve({ merchant: null, coupons: [] as ApiCoupon[] } as any)),
    [slug],
  )
}

export function useApiCoupons(filter?: { categoria?: string; merchant?: string }) {
  return useAsync(
    () => api.catalog.listCoupons(filter).then((r) => r.coupons),
    [filter?.categoria, filter?.merchant],
  )
}

// ─── Activations vecino ──────────────────────────────────────────────

export function useApiMyActivations(status?: 'activo' | 'canjeado' | 'expirado' | 'cancelado') {
  return useAsync(
    () => api.activations.mine(status).then((r) => r.activations),
    [status],
  )
}

export function useApiActivation(id: string | undefined) {
  return useAsync(
    () => (id ? api.activations.get(id).then((r) => r.activation) : Promise.resolve(null as ApiActivation | null)),
    [id],
  )
}

// ─── Validación + canje (comercio) ───────────────────────────────────

export type ValidationResult =
  | {
      ok: true
      activationId: string
      codigo: string
      porcentaje: number
      couponTitulo: string
      couponId: string
      customerName: string
      customerDni: string
      expiresAt: string
      activatedAt: string
      isFirstVisit: boolean
    }
  | { ok: false; reason: string; message: string }

export function useApiValidateByCode(code: string): {
  result: ValidationResult | null
  loading: boolean
} {
  const trimmed = code.replace(/\D/g, '').slice(0, 6)
  const enabled = trimmed.length === 6
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setResult(null)
      return
    }
    let cancelled = false
    setLoading(true)
    api.redemptions
      .validateByCode(trimmed)
      .then((data) => {
        if (cancelled) return
        const v = data.validation
        const result: ValidationResult = {
          ok: true,
          activationId: v.activationId,
          codigo: v.codigoNumerico,
          porcentaje: v.coupon.porcentaje,
          couponTitulo: v.coupon.titulo,
          couponId: v.coupon.id,
          customerName: v.user.nombre,
          customerDni: v.user.dni,
          expiresAt: v.expiresAt,
          activatedAt: v.activatedAt ?? new Date().toISOString(),
          isFirstVisit: v.isFirstVisit ?? false,
        }
        // Cache para que AdminConfirmarCanjePage pueda leer los datos
        try {
          sessionStorage.setItem(`msp.val.${v.activationId}`, JSON.stringify(result))
        } catch {
          /* noop */
        }
        setResult(result)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError) {
          setResult({
            ok: false,
            reason: String(err.status),
            message: err.payload?.error ?? 'Cupón inválido',
          })
        } else {
          setResult({ ok: false, reason: 'network', message: 'Sin conexión con el servidor' })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [trimmed, enabled])

  return { result, loading }
}

export function readCachedValidation(activationId: string): ValidationResult | null {
  try {
    const raw = sessionStorage.getItem(`msp.val.${activationId}`)
    return raw ? (JSON.parse(raw) as ValidationResult) : null
  } catch {
    return null
  }
}

export function clearCachedValidation(activationId: string) {
  try {
    sessionStorage.removeItem(`msp.val.${activationId}`)
  } catch {
    /* noop */
  }
}

// ─── Cupones (comercio) ──────────────────────────────────────────────

export function useApiMyCoupons() {
  return useAsync(() => api.merchantCoupons.listMine().then((r) => r.coupons), [])
}

// ─── Stats + clientes (comercio) ─────────────────────────────────────

export function useApiMerchantStats() {
  return useAsync(() => api.merchantAdmin.stats().then((r) => r.stats), [])
}

export function useApiMerchantStatsAsesor(periodo: MerchantStatsPeriodo) {
  return useAsync(() => api.merchantAdmin.statsAsesor(periodo).then((r) => r.stats), [periodo])
}

export function useApiMerchantProfile() {
  return useAsync(() => api.merchantAdmin.profile().then((r) => r.merchant), [])
}

export function useApiMerchantClientes() {
  return useAsync(() => api.redemptions.clientes().then((r) => r.clientes), [])
}

export function useApiRecentRedemptions(limit = 50) {
  return useAsync(() => api.redemptions.recent(limit).then((r) => r.redemptions), [limit])
}

// ─── WhatsApp (comercio) ─────────────────────────────────────────────

export function useApiWhatsappStatus() {
  return useAsync(() => api.whatsapp.status(), [])
}

/** Historial real de campañas (GET /wa/campaigns, agregado desde Mongo WaSend). */
export function useApiWhatsappCampaigns() {
  return useAsync(() => api.whatsapp.campaigns(), [])
}

// ─── Referidos (comercio) ────────────────────────────────────────────

export function useReferralsMe() {
  return useAsync(() => api.referrals.me().then((r) => r.referral), [])
}

export function useReferralsMine() {
  return useAsync(() => api.referrals.mine().then((r) => r.referidos), [])
}

// ─── Tipos re-export ─────────────────────────────────────────────────

export type { ApiMerchant, ApiCoupon, ApiActivation }
