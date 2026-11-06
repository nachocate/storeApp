import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    env: {
      API_BASE_URL: 'https://api.example.test'
    },
    clearMocks: true,
    restoreMocks: true
  }
})
