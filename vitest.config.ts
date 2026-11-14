import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Las pruebas viven en test/ (main/ y renderer/); los alias son los mismos que usa la app.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: { include: ['test/**/*.test.ts'] }
})
