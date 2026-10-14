import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// In development the Vite server proxies API and socket traffic to the
// local Express server. In production Express serves client/dist itself.
const SERVER = `http://localhost:${process.env.SERVER_PORT || 4000}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': SERVER,
      '/socket.io': { target: SERVER, ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
