/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'node:path'

// El panel del owner no tenía tests. Se agrega el runner para poder blindar la
// lógica que no es de UI (cliente HTTP, rbac, formateo). [cazabug loop2]
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'jsdom', include: ['src/**/*.{test,spec}.ts'] },
})
