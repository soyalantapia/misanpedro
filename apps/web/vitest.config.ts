/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Vitest config separada de la de prod (vite.config.ts) para evitar cargar
 * el plugin PWA, tailwind y demás durante tests — son innecesarios y lentos.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // No `globals: true` — los tests importan describe/it/expect explícitamente
    // así no contaminamos los tipos del app y no tocamos tsconfig.app.json.
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // `mjs` incluido a propósito: el guardrail multi-tenant vive en
    // __tests__/no-hardcoded-tenant.test.mjs (importa el script .mjs del repo);
    // sin esa extensión vitest no lo colecta y el test queda muerto.
    include: ['src/**/*.{test,spec}.{ts,tsx,mjs}'],
    // Excluimos `e2e/` porque esos son tests de Playwright (browser).
    // Si vitest los encuentra, falla porque @playwright/test no es compatible.
    exclude: ['node_modules', 'dist', 'e2e'],
  },
})
