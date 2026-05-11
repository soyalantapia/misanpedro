import type { Activation, Categoria, User } from './types'
import { SEED_DEMO_USERS } from '@/data/seedDemoUsers'
import { SEED_COUPONS } from '@/data/seedCoupons'
import { SEED_MERCHANTS } from '@/data/seedMerchants'
import { demoStoreActions, getActivationsSnapshot, getUserSnapshot } from './stores'
import { couponsActions } from './couponsStore'
import { whatsappActions } from './whatsappStore'

/** Código fijo para que el cajero pueda probar la validación. */
export const DEMO_ACTIVE_CODE = '123456'
const DEMO_ACTIVE_ACTIVATION_ID = 'a-demo-active-123456'
const DEMO_ACTIVE_USER_ID = 'u-demo-marta'
const DEMO_ACTIVE_COUPON_ID = 'c-esquina-pizza'

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
  const day = 24 * 60 * 60 * 1000

  // Distribución ponderada: 5 canjes hoy / 8 esta semana / 10 últimos 30
  // días / 5 últimos 60 días
  const buckets = [
    { count: 5, maxAgoMs: day },
    { count: 8, maxAgoMs: 7 * day },
    { count: 10, maxAgoMs: 30 * day },
    { count: 5, maxAgoMs: 60 * day },
  ]
  const totalCount = buckets.reduce((s, b) => s + b.count, 0)
  const ages: number[] = []
  buckets.forEach((b) => {
    for (let i = 0; i < b.count; i++) {
      ages.push(random() * b.maxAgoMs)
    }
  })

  for (let i = 0; i < totalCount; i++) {
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

    const offsetMs = Math.floor(ages[i])
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

  // Si hay sesión API real del vecino (refresh token persistido), NO
  // cargamos los datos demo. ApiSync va a hidratar las activations reales
  // del API. Cargar seed demo encima mostraría 28 canjes ficticios + un
  // cupón "Pizzas martes" como si fueran de él, que confunde al usuario.
  try {
    const hasUserApiSession = !!window.localStorage.getItem('msp.tok.user.refresh')
    if (hasUserApiSession) return
  } catch {
    /* noop */
  }

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

/**
 * Vacía las activations + demoUsers que cargó el seed inicial cuando
 * detectamos que la app pasó de "público anónimo" a "vecino logueado vía API".
 * Mantiene cupones y comercios (catálogo).
 *
 * Idempotente: si ya no hay nada que limpiar, no hace nada.
 */
export function purgeDemoDataForApiUser() {
  if (typeof window === 'undefined') return
  // Disparamos via demoStoreActions para que el store en memoria + listeners
  // se actualicen (sólo tocar localStorage no notifica a useSyncExternalStore).
  // Conservamos el user actual (lo seteamos por separado en RegistroPage/LoginPage).
  const current = getUserSnapshot()
  demoStoreActions.bulkSeed({ user: current, demoUsers: [], activations: [] })
}

/**
 * Asegura que SIEMPRE haya un cupón activo con código `123456` listo para
 * que el cajero lo valide. Si una activación previa con ese código ya fue
 * canjeada, la conserva en el historial y crea una nueva fresca.
 */
export function refreshDemoActiveCoupon() {
  if (typeof window === 'undefined') return

  const now = new Date()
  const all = getActivationsSnapshot()

  // ¿Hay alguna activación con código demo en estado 'activo' y vigente?
  const activeFresh = all.find(
    (a) =>
      a.codigoNumerico === DEMO_ACTIVE_CODE &&
      a.status === 'activo' &&
      new Date(a.expiresAt).getTime() > now.getTime() + 5 * 60 * 1000,
  )
  if (activeFresh) return

  // Crear nueva con id único timestamp para no pisar canjes históricos
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000)
  const id = `${DEMO_ACTIVE_ACTIVATION_ID}-${now.getTime()}`
  const activation: Activation = {
    id,
    couponId: DEMO_ACTIVE_COUPON_ID,
    userId: DEMO_ACTIVE_USER_ID,
    codigoNumerico: DEMO_ACTIVE_CODE,
    qrPayload: JSON.stringify({
      couponId: DEMO_ACTIVE_COUPON_ID,
      userId: DEMO_ACTIVE_USER_ID,
      codigo: DEMO_ACTIVE_CODE,
      exp: expiresAt.getTime(),
    }),
    activatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'activo',
  }
  demoStoreActions.upsertActivation(activation)
}
