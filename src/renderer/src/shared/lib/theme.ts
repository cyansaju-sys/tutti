/** Tema de la app: oscuro, claro o el del sistema. El resuelto va en <html data-theme> y los colores salen de variables CSS. */
export type ThemePref = 'dark' | 'light' | 'system'
export type ThemeMode = 'dark' | 'light'

const KEY = 'tutti-theme'          // copia en localStorage para pintar el tema correcto antes de leer los ajustes

export const isPref = (v: unknown): v is ThemePref => v === 'dark' || v === 'light' || v === 'system'

export function resolveTheme(pref: ThemePref): ThemeMode {
  if (pref !== 'system') return pref
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function cachedTheme(): ThemePref {
  try { const v = localStorage.getItem(KEY); return isPref(v) ? v : 'dark' } catch { return 'dark' }
}

export function cacheTheme(pref: ThemePref): void {
  try { localStorage.setItem(KEY, pref) } catch { /* sin almacenamiento: se usa el ajuste guardado */ }
}

export function paintTheme(mode: ThemeMode): void { document.documentElement.dataset.theme = mode }

const ACCENT_KEY = 'tutti-accent'          // '' = el de Tutti; '#rrggbb' = el último color del sistema (se pinta antes de preguntar)

/** Si el acento sigue al del sistema, y el último color que se le conoció. */
export function cachedAccent(): { on: boolean; color: string | null } {
  try { const v = localStorage.getItem(ACCENT_KEY); return { on: v !== null && v !== '', color: v && /^#[0-9a-f]{6}$/i.test(v) ? v : null } } catch { return { on: false, color: null } }
}

export function cacheAccent(on: boolean, color: string | null): void {
  try { localStorage.setItem(ACCENT_KEY, on ? color ?? 'system' : '') } catch { /* sin almacenamiento */ }
}

/** Pinta el acento del sistema (o lo quita con null): styles.css saca de --sys-accent los tonos de cada tema. */
export function paintAccent(color: string | null): void {
  const root = document.documentElement
  if (color) { root.style.setProperty('--sys-accent', color); root.dataset.accent = 'system' } else { root.style.removeProperty('--sys-accent'); delete root.dataset.accent }
}

/** Colores de la terminal (xterm no lee variables CSS). */
export const TERMINAL_THEMES: Record<ThemeMode, Record<string, string>> = {
  dark: {
    background: '#0d0f16', foreground: '#e6e8ef', cursor: '#a9c2e0', cursorAccent: '#0d0f16', selectionBackground: '#33425a',
    black: '#363c4f', red: '#ff6b81', green: '#7ee0a1', yellow: '#e2c08d', blue: '#82aaff', magenta: '#c792ea', cyan: '#4cc9b0', white: '#e6e8ef',
    brightBlack: '#7a8099', brightRed: '#ff8a9b', brightGreen: '#9bf0b9', brightYellow: '#f0d4a8', brightBlue: '#a3bdff',
    brightMagenta: '#d9b3f5', brightCyan: '#6fe0c9', brightWhite: '#ffffff'
  },
  light: {
    background: '#f1f2f6', foreground: '#272c3b', cursor: '#3a5878', cursorAccent: '#f1f2f6', selectionBackground: '#c4d3ea',
    black: '#272c3b', red: '#c92c47', green: '#17803f', yellow: '#8f5f00', blue: '#1f5fd1', magenta: '#8250df', cyan: '#0f7f6f', white: '#646a80',
    brightBlack: '#646a80', brightRed: '#e0455f', brightGreen: '#1f9a4d', brightYellow: '#a87000', brightBlue: '#3a74e0',
    brightMagenta: '#9a66ea', brightCyan: '#1a9886', brightWhite: '#8a90a6'
  }
}

/** Un color de styles.css (p. ej. `--color-surface`) ya resuelto a #rrggbb: xterm no entiende variables ni oklch(). */
function cssColor(name: string): string | null {
  try {
    const probe = document.createElement('i')
    probe.style.cssText = `position:absolute;visibility:hidden;color:var(${name})`
    document.body.appendChild(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
  } catch { return null }
}

/** Los colores de la terminal para el tema en uso; con el color del sistema, el fondo, el cursor y la selección salen de la interfaz ya teñida. */
export function terminalTheme(mode: ThemeMode): Record<string, string> {
  const base = TERMINAL_THEMES[mode]
  if (document.documentElement.dataset.accent !== 'system') return base
  const bg = cssColor('--color-surface'), fg = cssColor('--color-text'), cursor = cssColor('--color-accent'), sel = cssColor('--color-accent-bg')
  return { ...base, ...(bg && { background: bg, cursorAccent: bg }), ...(fg && { foreground: fg }), ...(cursor && { cursor }), ...(sel && { selectionBackground: sel }) }
}
