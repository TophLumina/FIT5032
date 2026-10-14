import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import firebaseConfig from './firebase.json' with { type: 'json' }

const hostingHeaders = Object.fromEntries(
  firebaseConfig.hosting.headers
    .find((entry) => entry.regex === '.*')
    .headers.map(({ key, value }) => [key, value]),
)

// https://vite.dev/config/
export default defineConfig({
  preview: {
    headers: hostingHeaders,
  },
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
