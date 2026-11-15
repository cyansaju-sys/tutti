/** Íconos de «Catppuccin Icons» (MIT, https://github.com/catppuccin/vscode-icons): SVG de trazo, en dos paletas. Ver public/icons/catppuccin/NOTICE.md. */
import type { ThemeMode } from './theme'

const base = import.meta.env.BASE_URL

interface Theme {
  file: string; folder: string; root: string
  fileNames: Record<string, string>; fileExtensions: Record<string, string>; folderNames: Record<string, string>
}
/** La paleta de los íconos: una de las cuatro de Catppuccin, o `auto` (mocha en oscuro, latte en claro). */
export type IconFlavor = 'auto' | 'latte' | 'frappe' | 'macchiato' | 'mocha'
export const ICON_FLAVORS: IconFlavor[] = ['auto', 'latte', 'frappe', 'macchiato', 'mocha']
export const isIconFlavor = (v: unknown): v is IconFlavor => ICON_FLAVORS.includes(v as IconFlavor)

/** Un ícono listo para pintar. `plain` = genérico (carpeta, proyecto o archivo sin tipo): es de un solo color y puede seguir el de la interfaz. */
export interface FileIconInfo { url: string; plain: boolean }

let theme: Theme | null = null

export const sidebarIcon = (name: string): string => `${base}icons/sidebar/${name}.svg`

export async function loadIconTheme(): Promise<void> {
  if (theme) return
  theme = (await (await fetch(`${base}icons/catppuccin/theme.json`)).json()) as Theme
}

/** El ícono de un archivo o carpeta (`root` = la carpeta de un proyecto; `open` = carpeta desplegada). Sin paleta elegida: mocha en oscuro y latte en claro. */
export function iconFor(fileName: string, opts: { dir?: boolean; open?: boolean; root?: boolean; mode?: ThemeMode; flavor?: IconFlavor } = {}): FileIconInfo | null {
  if (!theme) return null
  const name = fileName.toLowerCase()
  const flavor = opts.flavor && opts.flavor !== 'auto' ? opts.flavor : opts.mode === 'light' ? 'latte' : 'mocha'
  const info = (icon: string, plain = false): FileIconInfo => ({ url: `${base}icons/catppuccin/${flavor}/${icon}.svg`, plain })
  if (opts.dir || opts.root) {
    const named = theme.folderNames[name]
    return info(`${named ?? (opts.root ? theme.root : theme.folder)}${opts.open ? '_open' : ''}`, !named)
  }
  if (theme.fileNames[name]) return info(theme.fileNames[name])
  const parts = name.split('.')
  for (let i = 1; i < parts.length; i++) {           // extensiones compuestas primero: «foo.test.ts» -> «test.ts», luego «ts»
    const ext = parts.slice(i).join('.')
    if (theme.fileExtensions[ext]) return info(theme.fileExtensions[ext])
  }
  return info(theme.file, true)
}
