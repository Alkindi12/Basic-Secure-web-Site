import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The browser only talks to ONE origin (this dev server). Requests to /api,
// including trip images at /api/images/..., are forwarded to the backend.
// No CORS is needed, and the SameSite=Strict session cookie just works.
const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:5000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, proxy: apiProxy },
})
