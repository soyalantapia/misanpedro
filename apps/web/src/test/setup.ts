import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Limpia el DOM después de cada test (RTL no lo hace automáticamente en Vitest)
afterEach(() => {
  cleanup()
})

// localStorage: Node 25 expone un `localStorage` nativo experimental que
// shadowea el de jsdom y cuyo getItem no funciona sin archivo de respaldo
// (warning "--localstorage-file ... without a valid path"). Instalamos un
// stub in-memory garantizado para que window.localStorage funcione en tests
// (lib/tenant.ts lo lee al cargar el módulo).
class LocalStorageMock {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear() {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.store.set(String(key), String(value))
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  key(i: number): string | null {
    return [...this.store.keys()][i] ?? null
  }
}
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  writable: true,
  value: new LocalStorageMock(),
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
