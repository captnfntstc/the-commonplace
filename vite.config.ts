import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
// @ts-expect-error This JavaScript plugin runs only inside Vite's Node process.
import { createIgdbDevPlugin } from './server/vite-plugin.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), '')

  return {
  plugins: [react(), createIgdbDevPlugin(serverEnv)],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/steam-images': {
        target: 'https://cdn.cloudflare.steamstatic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/steam-images/, ''),
      },
      '/steam-store-api': {
        target: 'https://store.steampowered.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/steam-store-api/, '/api'),
      },
      '/steam-store-search': {
        target: 'https://store.steampowered.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/steam-store-search/, ''),
      },
      '/kotaku-images': {
        target: 'https://kotaku.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/kotaku-images/, ''),
      },
      '/ireddead-images': {
        target: 'https://www.ireddead.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/ireddead-images/, ''),
      },
      '/playstation-store-images': {
        target: 'https://image.api.playstation.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/playstation-store-images/, ''),
      },
      '/playstation-media-images': {
        target: 'https://gmedia.playstation.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/playstation-media-images/, ''),
      },
      '/valorant-images': {
        target: 'https://media.valorant-api.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/valorant-images/, ''),
      },
      '/league-images': {
        target: 'https://ddragon.leagueoflegends.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/league-images/, ''),
      },
      '/rawg-images': {
        target: 'https://media.rawg.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/rawg-images/, ''),
      },
      '/steamgriddb-images': {
        target: 'https://cdn2.steamgriddb.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/steamgriddb-images/, ''),
      },
      '/shopify-images': {
        target: 'https://cdn.shopify.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/shopify-images/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        authPreview: resolve(__dirname, 'auth-preview.html'),
      },
    },
  },
  }
})
