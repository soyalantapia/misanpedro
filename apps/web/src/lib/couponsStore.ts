import { useSyncExternalStore } from 'react'
import type { Coupon, CouponEstado } from './types'
import { SEED_COUPONS } from '@/data/seedCoupons'

const STORAGE_KEY = 'misanpedro.coupons.v1'

type State = { coupons: Coupon[] }

function load(): State {
  if (typeof window === 'undefined') return { coupons: SEED_COUPONS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { coupons: SEED_COUPONS }
    const parsed = JSON.parse(raw) as State
    if (!Array.isArray(parsed.coupons)) return { coupons: SEED_COUPONS }
    return { coupons: parsed.coupons }
  } catch {
    return { coupons: SEED_COUPONS }
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

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useCoupons() {
  return useSyncExternalStore(subscribe, () => state.coupons, () => state.coupons)
}

export function useCoupon(id: string | undefined) {
  const coupons = useCoupons()
  return coupons.find((c) => c.id === id)
}

export function useCouponsByMerchant(merchantId: string) {
  const coupons = useCoupons()
  return coupons.filter((c) => c.merchantId === merchantId)
}

export function getCouponSync(id: string): Coupon | undefined {
  return state.coupons.find((c) => c.id === id)
}

export function getCouponsByMerchantSync(merchantId: string): Coupon[] {
  return state.coupons.filter((c) => c.merchantId === merchantId)
}

export const couponsActions = {
  create(input: Omit<Coupon, 'id'>): Coupon {
    const coupon: Coupon = { ...input, id: `c-${rand(8)}` }
    update((s) => ({ coupons: [coupon, ...s.coupons] }))
    return coupon
  },
  patch(id: string, patch: Partial<Coupon>) {
    update((s) => ({
      coupons: s.coupons.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)),
    }))
  },
  remove(id: string) {
    update((s) => ({ coupons: s.coupons.filter((c) => c.id !== id) }))
  },
  setEstado(id: string, estado: CouponEstado) {
    update((s) => ({
      coupons: s.coupons.map((c) => (c.id === id ? { ...c, estado } : c)),
    }))
  },
  resetSeed() {
    update(() => ({ coupons: SEED_COUPONS }))
  },
}

function rand(len: number) {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += a[Math.floor(Math.random() * a.length)]
  return out
}
