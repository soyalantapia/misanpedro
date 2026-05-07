import type { Activation, Categoria, User } from './types'
import { SEED_DEMO_USERS } from '@/data/seedDemoUsers'
import { SEED_COUPONS } from '@/data/seedCoupons'
import { SEED_MERCHANTS } from '@/data/seedMerchants'
import { demoStoreActions } from './stores'
import { couponsActions } from './couponsStore'
import { whatsappActions } from './whatsappStore'

const TICKETS_BY_CATEGORIA: Record<Categoria, number> = {
  gastronomia: 4500,
  indumentaria: 12000,
  salud: 3200,
  belleza: 7800,
  servicios: 9500,
  hogar: 18000,
}

function rand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

const random = rand(42)

function randomToken(len: number) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(random() * alphabet.length)]
  }
  return out
}

function generateNumericCode() {
  return String(Math.floor(100_000 + random() * 900_000))
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)]
}

/** Genera ~25 activaciones canjeadas distribuidas en los últimos 60 días entre
 *  los demo users + el current user (si existe), favoreciendo los comercios
 *  más activos (La Esquina, Almendra Belleza, Hogar Río Paraná). */
function generateHistoricalRedemptions(
  demoUsers: User[],
  currentUser: User | null,
): Activation[] {
  const allUsers = currentUser ? [currentUser, ...demoUsers] : demoUsers
  if (allUsers.length === 0) return []

  // Pesos por user: el current user tiene más canjes en La Esquina, los demás distribuidos
  const userWeights: Record<string, number> = Object.fromEntries(
    allUsers.map((u, i) => [u.id, i === 0 ? 0.35 : 0.15 + random() * 0.1]),
  )

  // Pesos por cupón: La Esquina pizza es el más popular, hogar/almendra también
  const popularCouponIds = [
    'c-esquina-pizza',
    'c-esquina-pasta',
    'c-almendra-tratamiento',
    'c-parana-deco',
    'c-pampero-plantas',
    'c-estacion-brunch',
    'c-farmacia-cuidado',
    'c-almendra-corte',
  ]
  const otherCouponIds = SEED_COUPONS.map((c) => c.id).filter(
    (id) => !popularCouponIds.includes(id),
  )

  const activations: Activation[] = []
  const now = Date.now()
  const sixtyDays = 60 * 24 * 60 * 60 * 1000

  for (let i = 0; i < 28; i++) {
    // 70% pop coupons, 30% otros
    const couponId =
      random() < 0.7 ? pickRandom(popularCouponIds) : pickRandom(otherCouponIds)
    const coupon = SEED_COUPONS.find((c) => c.id === couponId)!

    // Sortear user por pesos
    const totalWeight = Object.values(userWeights).reduce((a, b) => a + b, 0)
    let r = random() * totalWeight
    let pickedUser = allUsers[0]
    for (const u of allUsers) {
      r -= userWeights[u.id]
      if (r <= 0) {
        pickedUser = u
        break
      }
    }

    const offsetMs = Math.floor(random() * sixtyDays)
    const redeemedAt = new Date(now - offsetMs)
    const activatedAt = new Date(redeemedAt.getTime() - 5 * 60 * 1000)
    const expiresAt = new Date(activatedAt.getTime() + 30 * 60 * 1000)

    const merchant = SEED_MERCHANTS.find((m) => m.id === coupon.merchantId)
    const ticket = merchant ? TICKETS_BY_CATEGORIA[merchant.categoria] : 5000
    // Variabilidad ±30%
    const variability = 0.7 + random() * 0.6
    const ticketReal = Math.round(ticket * variability)
    const ahorro = Math.round((ticketReal * coupon.porcentaje) / 100)

    activations.push({
      id: `a-demo-${randomToken(8)}`,
      couponId,
      userId: pickedUser.id,
      codigoNumerico: generateNumericCode(),
      qrPayload: '{}',
      activatedAt: activatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'canjeado',
      redeemedAt: redeemedAt.toISOString(),
      ahorroEstimado: ahorro,
    })
  }

  return activations.sort(
    (a, b) =>
      new Date(b.redeemedAt!).getTime() - new Date(a.redeemedAt!).getTime(),
  )
}

/** Carga datos demo enriquecidos. Si hay un user ya logueado, lo preserva. */
export function loadDemoData(currentUser: User | null) {
  const demoUsers = SEED_DEMO_USERS
  const activations = generateHistoricalRedemptions(demoUsers, currentUser)

  demoStoreActions.bulkSeed({
    user: currentUser,
    demoUsers,
    activations,
  })

  // Reset cupones a seed (por si hubo CRUD previo)
  couponsActions.resetSeed()

  // 2 campañas WhatsApp pasadas (para La Esquina)
  whatsappActions.send({
    merchantId: 'la-esquina',
    templateId: 'tpl-promo',
    audiencia: 'Todos mis clientes',
    rendered:
      'Hola Marta! En La Esquina lanzamos nuevo descuento del 20% válido hasta el 30 de junio. Activá tu cupón. misanpedro.app/cupones',
    sentCount: 3,
  })
  whatsappActions.send({
    merchantId: 'la-esquina',
    templateId: 'tpl-recordatorio',
    audiencia: 'Recurrentes',
    rendered:
      'Hola Juan Pablo, te queda hasta el 15 de mayo para usar tu descuento del 20% en La Esquina. ¡No te lo pierdas! misanpedro.app/cupones',
    sentCount: 2,
  })

  return {
    users: demoUsers.length + (currentUser ? 1 : 0),
    redemptions: activations.length,
    campaigns: 2,
  }
}

export function isDemoLoaded(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem('misanpedro.v1')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.demoUsers) && parsed.demoUsers.length > 0
  } catch {
    return false
  }
}

/**
 * Carga datos demo automáticamente la primera vez que se abre la app
 * (o tras un localStorage clear). Preserva el user actual si existe.
 * Idempotente: si ya hay demoUsers cargados, no hace nada.
 */
export function ensureDemoDataLoaded() {
  if (typeof window === 'undefined') return
  if (isDemoLoaded()) return

  let currentUser: User | null = null
  try {
    const raw = window.localStorage.getItem('misanpedro.v1')
    if (raw) {
      const parsed = JSON.parse(raw) as { user?: User | null }
      currentUser = parsed.user ?? null
    }
  } catch {
    /* noop */
  }

  loadDemoData(currentUser)
}
