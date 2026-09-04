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
      // 'prompt', not 'autoUpdate' — despite there being no prompt.
      //
      // autoUpdate activates a new worker the moment it lands, which can swap
      // the code under a half-filled sheet. We want the same silent update, but
      // on our terms: applied when the app becomes visible and nothing is being
      // entered. See src/updates.ts.
      registerType: 'prompt',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'BabyLiana',
        short_name: 'BabyLiana',
        description: 'Newborn activity log',
        // The design's day ground, matching the icon's own pink-lilac. These
        // colour the splash and the browser chrome, not the app — which still
        // switches to the night surface by clock once it is running.
        theme_color: '#fdf7f2',
        background_color: '#fdf7f2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // Liana as the design drew her, resized from the 1024 as the handoff
        // instructs. These replaced a placeholder that was shipping instead.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-1024x1024.png', sizes: '1024x1024', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
        // The mascot ships as WebP with a PNG fallback. Every browser this app
        // runs on takes the WebP, so precaching the fallbacks would add ~650KB
        // to the offline bundle that nobody ever downloads. They stay deployed
        // and fetchable; they are just not part of the offline payload.
        //
        // The 1024 icon is the same story: the manifest references it, install
        // happens online, and it is 840KB.
        globIgnores: [
          'assets/{settled,awake,hungry,sleeping,home}-*.png',
          'pwa-1024x1024.png',
        ],
        // The app must open with no signal, and the font carries the product's
        // tone — falling back to system sans offline would make it look broken
        // rather than plain. Cache-first: these files never change.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
