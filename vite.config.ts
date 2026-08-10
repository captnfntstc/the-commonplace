import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/rawg-api': {
        target: 'https://api.rawg.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/rawg-api/, '/api'),
      },
      '/steam-images': {
        target: 'https://cdn.cloudflare.steamstatic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/steam-images/, ''),
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
})
