import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Lets /spike answer "did my deploy actually land", which came up repeatedly
  // during Phase 3 and will again once S9 adds the update strategy.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16) + 'Z'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'BabyLiana',
        short_name: 'BabyLiana',
        description: 'Newborn activity log',
        // Dark: the screen is often the only light source in the room.
        theme_color: '#11131a',
        background_color: '#11131a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
