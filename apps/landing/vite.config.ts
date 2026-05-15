import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * `base` controls the path prefix for emitted asset URLs.
 * - Dev (pnpm dev): base = '/' (default)
 * - Producción GH Pages: la landing vive en
 *   https://soyalantapia.github.io/misanpedro/comercios/
 *   por eso fijamos base a ese path. La PWA del vecino sigue en /misanpedro/.
 *
 * Si deployás a otro dominio (ej. comercios.misanpedro.app raíz), pasá
 * VITE_BASE=/ al build: VITE_BASE=/ pnpm build
 */
const base = process.env.VITE_BASE ?? '/misanpedro/comercios/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5181,
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
  },
})
