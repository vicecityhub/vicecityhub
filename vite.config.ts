import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/vicecityhub/',
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: { compress: { drop_console: true, drop_debugger: true } },
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
        rp:            path.resolve(__dirname, 'rp.html'),
      },
      output: {
        // Chunk splitting для оптимизации загрузки
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
            if (id.includes('@supabase')) return 'supabase-vendor';
            return 'vendor';
          }
          if (id.includes('src/rp-hub')) return 'rp-hub';
          if (id.includes('src/pages')) return 'pages';
        },
        // Asset naming для кэширования
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(assetInfo.name || ''))
            return 'assets/img/[name]-[hash][extname]';
          if (/\.(woff2?|ttf|eot)$/i.test(assetInfo.name || ''))
            return 'assets/fonts/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      }
    },
    // Оптимизация размеров
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 600,
  },
  // Performance optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js'],
  },
})
