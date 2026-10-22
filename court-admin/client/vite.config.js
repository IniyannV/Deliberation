import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// In development Vite proxies the API to the Court Admin server. In production
// that server serves court-admin/client/dist itself.
const SERVER = `http://localhost:${process.env.SERVER_PORT || 4100}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Same as the jury app: pdf.js's legacy build, with newer JS APIs polyfilled.
    alias: [{ find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' }],
  },
  server: {
    host: true,
    port: 5174,
    proxy: { '/api': SERVER },
  },
})
