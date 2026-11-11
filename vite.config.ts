import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// EDB — Electronic Data Book. Vite + React + TS, installable offline-first PWA.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'EDB — Electronic Data Book',
        short_name: 'EDB',
        description: 'Precision rifle & range logbook — offline-first.',
        theme_color: '#171d1a',
        background_color: '#171d1a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
    }),
  ],
})
