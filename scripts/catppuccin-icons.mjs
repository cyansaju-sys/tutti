// Copia a src/renderer/public/icons/catppuccin los íconos de «Catppuccin Icons for VS Code» (https://github.com/catppuccin/vscode-icons)
// y genera su tabla. Uso: node scripts/catppuccin-icons.mjs <carpeta «extension» del .vsix descomprimido>
// Se copian sus cuatro paletas (latte, frappe, macchiato y mocha). La tabla es la misma para todas.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) { console.error('Falta la carpeta de la extensión Catppuccin Icons'); process.exit(1) }
const out = fileURLToPath(new URL('../src/renderer/public/icons/catppuccin', import.meta.url))
const src = JSON.parse(readFileSync(join(dir, 'dist', 'mocha', 'theme.json'), 'utf8'))

for (const flavor of ['latte', 'frappe', 'macchiato', 'mocha']) {
  rmSync(join(out, flavor), { recursive: true, force: true })
  mkdirSync(join(out, flavor), { recursive: true })
  cpSync(join(dir, 'dist', flavor, 'icons'), join(out, flavor), { recursive: true })
}
cpSync(join(dir, 'LICENSE.txt'), join(out, 'LICENSE.txt'))

const lower = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]))
for (const [name, icon] of Object.entries(src.folderNames)) if (src.folderNamesExpanded[name] !== `${icon}_open`) throw new Error(`carpeta abierta inesperada: ${name}`)
const theme = {          // el ícono de una carpeta abierta es siempre el suyo + «_open»
  file: src.file, folder: src.folder, root: src.rootFolder,
  fileNames: lower(src.fileNames), fileExtensions: lower(src.fileExtensions), folderNames: lower(src.folderNames)
}
writeFileSync(join(out, 'theme.json'), JSON.stringify(theme))
console.log(`${Object.keys(src.iconDefinitions).length} íconos por paleta → ${out}`)
