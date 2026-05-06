import type { Merchant, MerchantUser } from '@/lib/types'
import { SEED_MERCHANTS } from './seedMerchants'

/** @deprecated Use useMerchants() o getMerchantSync() del merchantsStore */
export const MERCHANTS: Merchant[] = SEED_MERCHANTS

export const MERCHANT_USERS: MerchantUser[] = [
  {
    id: 'mu-esquina-1',
    merchantId: 'la-esquina',
    email: 'cajero@laesquina.com',
    password: 'demo123',
    nombre: 'Mario Pizza',
    rol: 'admin',
  },
  {
    id: 'mu-carmen-1',
    merchantId: 'carmen-vintage',
    email: 'admin@carmenvintage.com',
    password: 'demo123',
    nombre: 'Carmen R.',
    rol: 'admin',
  },
  {
    id: 'mu-pampero-1',
    merchantId: 'vivero-pampero',
    email: 'jose@vivero-pampero.com',
    password: 'demo123',
    nombre: 'José',
    rol: 'admin',
  },
]

const STORAGE_USERS_KEY = 'misanpedro.merchantUsers.v1'

function loadCustomUsers(): MerchantUser[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_USERS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MerchantUser[]
  } catch {
    return []
  }
}

function saveCustomUsers(users: MerchantUser[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users))
}

export function findMerchantUser(email: string, password: string): MerchantUser | undefined {
  const all = [...MERCHANT_USERS, ...loadCustomUsers()]
  const e = email.trim().toLowerCase()
  return all.find((u) => u.email.toLowerCase() === e && u.password === password)
}

export function findMerchantUserByEmail(email: string): MerchantUser | undefined {
  const all = [...MERCHANT_USERS, ...loadCustomUsers()]
  const e = email.trim().toLowerCase()
  return all.find((u) => u.email.toLowerCase() === e)
}

export function addMerchantUser(user: MerchantUser) {
  const custom = loadCustomUsers()
  saveCustomUsers([...custom, user])
}

export function getAllMerchantUsers(): MerchantUser[] {
  return [...MERCHANT_USERS, ...loadCustomUsers()]
}

/**
 * Devuelve el merchant del seed inicial. Para datos editables/reactivos usar
 * useMerchant() o getMerchantSync() del merchantsStore.
 */
export function getMerchant(id: string): Merchant | undefined {
  return SEED_MERCHANTS.find((m) => m.id === id)
}
