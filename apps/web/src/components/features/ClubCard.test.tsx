import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Datos mutables para el hook de canjes (hoisted para el factory de vi.mock).
const h = vi.hoisted(() => ({
  data: [] as Array<{ redeemedAt?: string; ahorroEstimado?: number }>,
}))

vi.mock('@/lib/api', () => ({
  tokens: { get: () => ({ access: 'tok', refresh: 'tok' }) },
}))
vi.mock('@/lib/apiQueries', () => ({
  useApiMyActivations: () => ({ data: h.data, loading: false }),
}))

import { ClubCard } from './ClubCard'

/** ISO del día `dia` del mes actual al mediodía (siempre cae en el mes en curso). */
const esteMes = (dia: number) => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), dia, 12).toISOString()
}

const renderCard = () =>
  render(
    <MemoryRouter>
      <ClubCard />
    </MemoryRouter>,
  )

beforeEach(() => {
  h.data = []
})

describe('<ClubCard />', () => {
  it('0 canjes este mes → estado motivador + CTA a descuentos', () => {
    h.data = []
    const { container } = renderCard()
    expect(container.textContent).toMatch(/Todavía sin nivel/)
    expect(container.textContent).toMatch(/Usá un cupón y arrancás tu nivel del Club/)
    expect(screen.getByRole('button', { name: /ver cupones/i })).toBeTruthy()
  })

  it('4 canjes este mes → Socio Plata + ahorro total (sin sorteo/premio fake)', () => {
    h.data = Array.from({ length: 4 }, () => ({ redeemedAt: esteMes(5), ahorroEstimado: 500 }))
    const { container } = renderCard()
    expect(container.textContent).toMatch(/Socio Plata/)
    expect(container.textContent).toMatch(/Ahorro total/)
    // NO debe prometer sorteo ni premio (no existe backend de sorteo).
    expect(container.textContent).not.toMatch(/sorteo|premio|20\.000/i)
  })

  it('8 canjes este mes → Socio Oro + nivel máximo', () => {
    h.data = Array.from({ length: 8 }, () => ({ redeemedAt: esteMes(5) }))
    const { container } = renderCard()
    expect(container.textContent).toMatch(/Socio Oro/)
    expect(container.textContent).toMatch(/nivel máximo del mes/)
  })
})
