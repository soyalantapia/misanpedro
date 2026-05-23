import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  base: '/misanpedro/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      devOptions: { enabled: false },
      manifest: {
        name: 'Mi San Pedro — Descuentos vecinales',
        short_name: 'Mi San Pedro',
        description: 'Descuentos en comercios adheridos de San Pedro',
        theme_color: '#695ede',
        background_color: '#f9f9f9',
        display: 'standalone',
        orientation: 'any',
        start_url: '/misanpedro/',
        icons: [
          { src: '/misanpedro/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/misanpedro/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/misanpedro/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Forzar al SW nuevo a tomar control YA, sin esperar a que el user
        // cierre todos los tabs. Crítico para que cambios de config (ej. la
        // URL del API) lleguen al user en el siguiente refresh sin que tenga
        // que limpiar cache manualmente.
        skipWaiting: true,
        clientsClaim: true,
        // Limpia precaches viejos (de versiones anteriores del bundle) para
        // evitar que el browser cargue assets stale después de un deploy.
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5180,
    host: '127.0.0.1',
  },
})
