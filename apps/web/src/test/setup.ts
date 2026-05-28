import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Limpia el DOM después de cada test (RTL no lo hace automáticamente en Vitest)
afterEach(() => {
  cleanup()
})

// Mock global: ResizeObserver (lo usa lucide-react / radix-like)
// y matchMedia (algunos componentes que respetan prefers-reduced-motion)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as any).ResizeObserver = ResizeObserverMock

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// fetch mock por default — los tests específicos pueden sobrescribirlo
;(globalThis as any).fetch = vi.fn(() =>
  Promise.reject(new Error('fetch no mockeado en este test')),
)
