import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend the dev server proxies to. Same machine either locally or in a
// Codespace, so this is always plain localhost - no cross-origin browser
// request is ever made, which sidesteps CORS entirely (including the
// GitHub Codespaces quirk where two different forwarded-port subdomains
// don't always pass CORS headers through cleanly to each other).
const BACKEND = 'http://localhost:8000'

// Every path prefix the backend actually serves. Kept explicit (rather than
// proxying "/") so Vite's own asset/HMR requests are untouched.
const API_PATHS = ['/auth', '/reference', '/student', '/institute', '/industry', '/admin', '/health', '/docs', '/openapi.json']

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: Object.fromEntries(API_PATHS.map((p) => [p, { target: BACKEND, changeOrigin: true }])),
  },
})
