import { isLangPref } from '@/shared/i18n'
import { isIconFlavor } from '@/lib/icons'
import { isPref } from '@/lib/theme'
import { useStore } from '@/store'

type StoreState = ReturnType<typeof useStore.getState>
/** Una regla valida el valor guardado y devuelve lo que hay que cambiar en el store (o nada si no sirve). */
type Rule = (value: unknown, st: StoreState) => Partial<StoreState> | void

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

/** Ajustes globales guardados (clave en settings → regla que los aplica al store). */
const RULES: Record<string, Rule> = {
  theme: (v, st) => { if (isPref(v) && v !== st.theme) st.setTheme(v) },
  system_accent: (v) => (typeof v === 'boolean' ? { sysAccent: v } : undefined),
  icon_flavor: (v) => (isIconFlavor(v) ? { iconFlavor: v } : undefined),
  sidebar_side: (v) => (v === 'left' || v === 'right' ? { sidebarSide: v } : undefined),
  editor_full: (v) => (typeof v === 'boolean' ? { editorFull: v } : undefined),
  editor_font: (v) => (typeof v === 'string' && v.trim() ? { editorFont: v } : undefined),
  sidebar_width: (v) => (isNumber(v) ? { sidebarWidth: clamp(v, 220, 520) } : undefined),     // global: vale para todos los proyectos
  chat_open: (v) => (typeof v === 'boolean' ? { chatOpen: v } : undefined),                   // el chat se abre con el proyecto; si se cerró, así se queda
  chat_width: (v) => (isNumber(v) ? { chatWidth: clamp(v, 280, 720) } : undefined),
  keybindings: (v) => (v && typeof v === 'object' ? { keys: Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, c]) => typeof c === 'string')) as Record<string, string> } : undefined),
  language: (v, st) => { if (isLangPref(v) && v !== st.langPref) st.setLang(v) }
}

/** Lee los ajustes guardados y los aplica al store, sin un `if` por cada uno. */
export async function loadSettings(): Promise<void> {
  const keys = Object.keys(RULES)
  const values = await Promise.all(keys.map((key) => window.api.settings.get(key)))
  keys.forEach((key, i) => {
    const patch = RULES[key](values[i], useStore.getState())
    if (patch) useStore.setState(patch)
  })
}
