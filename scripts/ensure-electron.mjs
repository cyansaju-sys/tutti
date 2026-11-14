// Descarga el binario de Electron si falta. Yarn a veces no ejecuta el postinstall de `electron` (instalación
// interrumpida, caché, scripts ignorados) y entonces `electron-vite dev` falla con «Electron uninstall».
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
let dir
try {
  dir = dirname(require.resolve('electron/package.json'))
} catch {
  process.exit(0) // electron no está instalado (p. ej. instalación solo de producción)
}
if (!existsSync(join(dir, 'path.txt'))) {
  console.log('Electron: falta el binario, descargándolo…')
  const r = spawnSync(process.execPath, [join(dir, 'install.js')], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
