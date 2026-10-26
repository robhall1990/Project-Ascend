import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the app can be served from a subpath (e.g. GitHub Pages
// under /Project-Ascend/lift-tracker/) without hardcoding the host path.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        // Explicit id: without one Chrome keys the app on start_url, which this
        // shares with the retired "Project Ascend" PWA at the same URL — phones
        // that had that installed refuse to install this as "already installed".
        id: 'lift-tracker',
        name: 'Lift Tracker',
        short_name: 'Lift',
        description: 'Personal strength, conditioning & nutrition coach',
        theme_color: '#090d16',
        background_color: '#090d16',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
