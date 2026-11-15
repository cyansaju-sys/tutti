import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Desde electron-vite 5 las dependencias de main y preload quedan fuera del bundle por defecto (antes, externalizeDepsPlugin).
export default defineConfig({
  main: { build: { rollupOptions: { input: resolve('src/backend/index.ts') } }, resolve: { alias: { '@': resolve('src') } } },
  preload: { resolve: { alias: { '@': resolve('src') } } },
  renderer: {
    root: resolve('src'),
    publicDir: resolve('public'),
    build: { rollupOptions: { input: resolve('src/index.html') } },
    resolve: { alias: { '@': resolve('src') } },
    plugins: [react(), tailwindcss()]
  }
})
