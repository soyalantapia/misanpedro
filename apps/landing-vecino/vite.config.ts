import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * Landing del VECINO (convencer al vecino → entrar a la PWA).
 * Prod GH Pages: https://soyalantapia.github.io/misanpedro/vecino/
 * (La PWA del vecino vive en /misanpedro/ y la landing de comercios en /misanpedro/comercios/.)
 * Override con VITE_BASE=/ pnpm build si deployás a un dominio raíz.
 */
const base = process.env.VITE_BASE ?? '/misanpedro/vecino/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5185,
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
  },
})
