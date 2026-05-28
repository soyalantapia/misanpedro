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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
})
