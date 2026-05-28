/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Vitest config para el backend.
//
// Tests conviven con el código (src/<area>/*.test.ts).
// Para tests que requieren DB real → usar testcontainers o mongodb-memory-server
// (no instalado por defecto; agregarlo cuando hagan falta tests de integración).
//
// Por ahora cubrimos:
//   - Lógica pura (jwt.service, mp signature verification)
//   - Validación de schemas Zod
//   - Mappers (mapMpStatus, etc.)
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
