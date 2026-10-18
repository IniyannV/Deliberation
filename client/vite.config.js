import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

const here = path.dirname(fileURLToPath(import.meta.url))
const portFile = path.resolve(here, '../server/data/.port')

function getServerTarget() {
  if (process.env.SERVER_PORT) return `http://localhost:${process.env.SERVER_PORT}`
  try {
    if (fs.existsSync(portFile)) {
      const p = fs.readFileSync(portFile, 'utf8').trim()
      if (p) return `http://localhost:${p}`
    }
  } catch {}
  return 'http://localhost:4000'
}

let apiProxy
let wsProxy

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // pdf.js's default build calls JS APIs (Map.getOrInsertComputed and others)
    // that iPad Safari doesn't have yet; the throw blanks the whole page. The
    // legacy build is the same version with those APIs polyfilled.
    alias: [
      { find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' },
      { find: /^pdfjs-dist\/(build|web)\//, replacement: 'pdfjs-dist/legacy/$1/' },
    ],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: getServerTarget(),
        configure: (proxy) => { apiProxy = proxy },
        bypass: (_req, _res, opts) => {
          const target = getServerTarget()
          opts.target = target
          if (apiProxy) apiProxy.options.target = target
        },
      },
      '/socket.io': {
        target: getServerTarget(),
        ws: true,
        configure: (proxy) => { wsProxy = proxy },
        bypass: (_req, _res, opts) => {
          const target = getServerTarget()
          opts.target = target
          if (wsProxy) wsProxy.options.target = target
        },
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
