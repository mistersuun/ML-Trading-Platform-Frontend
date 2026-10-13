import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // API_TOKEN (not VITE_-prefixed, so it never reaches the bundle) is injected by the dev/preview proxy.
  const token = loadEnv(mode, process.cwd(), '').API_TOKEN
  const proxy = {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      timeout: 300_000, // 5 min for heavy scan operations
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    },
  }
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy },
    preview: { proxy },
  }
})
