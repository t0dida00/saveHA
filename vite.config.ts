import { createHash } from 'node:crypto'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // AUTH_PASSWORD has no VITE_ prefix, so the plain value never reaches the bundle.
  // Only its hash is injected; the login page compares hashes.
  const { AUTH_PASSWORD, DEVELOPMENT, HOST_URL } = loadEnv(mode, process.cwd(), '')
  // DEVELOPMENT=true skips the splash screen and the login page
  const development = DEVELOPMENT === 'true'
  if (!AUTH_PASSWORD && !development) {
    throw new Error('AUTH_PASSWORD is missing. Copy .env.example to .env and set it.')
  }
  const authPasswordHash = createHash('sha256').update(AUTH_PASSWORD ?? '').digest('hex')

  return {
    define: {
      __AUTH_PASSWORD_HASH__: JSON.stringify(authPasswordHash),
      __DEVELOPMENT__: JSON.stringify(development),
      // Base URL of the schedule API, e.g. http://localhost:4000/api/v1
      __HOST_URL__: JSON.stringify((HOST_URL ?? '').replace(/\/+$/, '')),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'SaveHA',
          short_name: 'SaveHA',
          description: 'SaveHA',
          theme_color: '#232f3f',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
  }
})
