import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Desde electron-vite 5 las dependencias de main y preload quedan fuera del bundle por defecto (antes, externalizeDepsPlugin).
export default defineConfig({
  main: { resolve: { alias: { '@': resolve('src') } } },
  preload: { resolve: { alias: { '@': resolve('src') } } },
  renderer: {
    resolve: { alias: { '@': resolve('src') } },
    plugins: [react(), tailwindcss()]
  }
})
