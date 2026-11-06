import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { resolveApiBaseUrl } from './src/config/store.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = resolveApiBaseUrl(environment)
  if (!apiBaseUrl) {
    throw new Error('API_BASE_URL must be configured with a valid HTTP(S) URL.')
  }

  return {
    envPrefix: ['VITE_', 'API_'],
    plugins: [
      vue(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true
        }
      },
    },
  }
})
