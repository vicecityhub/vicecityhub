import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/vicecityhub/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main:          path.resolve(__dirname, 'index.html'),
        news:          path.resolve(__dirname, 'news.html'),
        market:        path.resolve(__dirname, 'market.html'),
        realestate:    path.resolve(__dirname, 'realestate.html'),
        document:      path.resolve(__dirname, 'document.html'),
        community:     path.resolve(__dirname, 'community.html'),
        profile:       path.resolve(__dirname, 'profile.html'),
        post:          path.resolve(__dirname, 'post.html'),
        resetPassword: path.resolve(__dirname, 'reset-password.html'),
        // ── v11: новый RP Hub ──
        rp:            path.resolve(__dirname, 'rp.html'),
      }
    }
  }
})
