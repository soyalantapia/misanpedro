import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * [cazabug loop2] El vecino tenía en su billetera una tarjeta gris latiendo para
 * siempre.
 *
 * `useApiCoupons` trae SOLO los cupones activos y vigentes. Cuando el comercio
 * borra o pausa el cupón, la activación del vecino deja de resolver contra ese
 * catálogo, y esta pantalla hacía `if (!c || !m) return <div animate-pulse>`: un
 * esqueleto de carga eterno, para algo que nunca iba a llegar. La activación ya
 * traía el snapshot del cupón y del comercio (CanjeadosPage lo usaba); acá faltaba.
 *
 * El escenario del test es el real: activación en la billetera, catálogo YA
 * cargado y vacío (el cupón no está más), snapshot presente.
 */
const { activacion } = vi.hoisted(() => ({
  activacion: {
    id: 'act-1',
    couponId: '507f1f77bcf86cd799439011',
    userId: 'u1',
    codigoNumerico: '482913',
    qrPayload: 'msp:act:482913:507f1f77bcf86cd799439011',
    activatedAt: new Date().toISOString(),
    status: 'activo' as const,
    // Snapshot que viaja desde el backend (serializeActivation).
    couponTitulo: '20% en pizzas grandes',
    couponPorcentaje: 20,
    merchantNombre: 'Pizzería Don Luis',
    merchantCategoria: 'gastronomia',
  },
}))

vi.mock('@/lib/stores', () => ({
  useActivations: () => [activacion],
  useUser: () => ({ id: 'u1', nombre: 'Vecina' }),
  activationActions: { reactivate: vi.fn() },
  demoStoreActions: { upsertActivation: vi.fn() },
}))

vi.mock('@/lib/couponsStore', () => ({ useCoupons: () => [] }))

// Catálogo YA resuelto y SIN el cupón: es exactamente lo que devuelve el backend
// después de que el comercio lo borra.
vi.mock('@/lib/apiQueries', () => ({
  useApiCoupons: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useApiMerchants: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
}))

vi.mock('@/lib/syncActivations', () => ({ syncMyActivations: vi.fn() }))
vi.mock('@/components/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}))
vi.mock('@/data/mockData', () => ({ getMerchant: () => undefined }))

const { MisCuponesPage } = await import('@/pages/MisCuponesPage')

describe('MisCuponesPage — el comercio borró el cupón', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('🔴 muestra la tarjeta con el título del snapshot, no un esqueleto', async () => {
    render(
      <MemoryRouter>
        <MisCuponesPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('20% en pizzas grandes')).toBeTruthy()
    expect(screen.getByText('Pizzería Don Luis')).toBeTruthy()
  })

  it('🔴 no queda ningún esqueleto de carga colgado en la lista', () => {
    const { container } = render(
      <MemoryRouter>
        <MisCuponesPage />
      </MemoryRouter>,
    )
    // El esqueleto de la tarjeta es `h-24 animate-pulse`. Con el catálogo ya
    // resuelto no puede quedar ninguno: sería una promesa de carga que no llega.
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0)
  })

  it('sigue ofreciendo el QR: el código es lo único que el vecino tiene', () => {
    render(
      <MemoryRouter>
        <MisCuponesPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Ver QR/)).toBeTruthy()
  })
})
