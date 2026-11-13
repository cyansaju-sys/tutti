import type { StateCreator } from 'zustand'
import { cacheLangPref, cachedLangPref, resolveLangPref } from '@/shared/lib/langPref'
import { cacheAccent, cacheTheme, cachedAccent, cachedTheme, paintAccent, paintTheme, resolveTheme } from '@/shared/lib/theme'
import { tr } from './helpers'
import type { ToastKind } from './types'
import type { State, UiSlice } from './types'
let toastId = 1

/** Fuente del editor de código si el usuario no pone otra. */
export const DEFAULT_EDITOR_FONT = "'Droid Sans Mono', monospace"

/** Deduce el tipo de aviso a partir del texto cuando no se indica. */
const guessKind = (m: string): ToastKind => {
  const low = m.toLowerCase()
  if (['no se pudo', 'falló', 'error', 'no se encontr', 'no existe', 'could not', 'failed', 'not found', 'does not exist'].some((w) => low.includes(w))) return 'error'
  if (['copiad', 'guardad', 'creada', 'creado', 'hecho', 'subido', 'copied', 'saved', 'created', 'done', 'pushed'].some((w) => low.includes(w))) return 'ok'
  return 'info'
}


export const createUiSlice: StateCreator<State, [], [], UiSlice> = (set, get) => ({
  newsSince: null, tab: 'files', sidebarOpen: true, sidebarSide: 'left', editorFont: DEFAULT_EDITOR_FONT, sidebarWidth: 300, editorWidth: 720, shellHeight: 240, editEnabled: true, theme: cachedTheme(), themeMode: resolveTheme(cachedTheme()), sysAccent: cachedAccent().on, accent: cachedAccent().color, iconFlavor: 'auto', iconPreview: null, langPref: cachedLangPref(), lang: resolveLangPref(cachedLangPref()),
  searchReplace: false, searchToken: 0, focus: 'tree', paneFocus: 0, modal: null, toasts: [], notices: [], maximized: false, agents: [], update: { status: 'idle' },

  toast: (message, kind) => {
    const id = toastId++
    const item = { id, kind: kind ?? guessKind(message), message }
    set((s) => ({ toasts: [...s.toasts, item].slice(-4), notices: [item, ...s.notices].slice(0, 50) }))
    const long = (kind ?? guessKind(message)) === 'error'
    setTimeout(() => get().dismissToast(id), long ? 6000 : 3500)
  },
  clearNotices: () => set({ notices: [] }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setTheme: (pref) => {
    const mode = resolveTheme(pref)
    cacheTheme(pref); paintTheme(mode)
    set({ theme: pref, themeMode: mode })
    void window.api.settings.set('theme', pref)
  },
  setSysAccent: async (on) => {
    set({ sysAccent: on })
    void window.api.settings.set('system_accent', on)
    const color = on ? await window.api.theme.accent() : null
    if (get().sysAccent !== on) return          // cambió mientras se preguntaba
    cacheAccent(on, color); paintAccent(color); set({ accent: color })
    if (on && !color) get().toast(tr(get, 'theme.accentNone'), 'info')
  },
  setIconFlavor: (flavor) => { set({ iconFlavor: flavor }); void window.api.settings.set('icon_flavor', flavor) },
  setLang: (pref) => {
    cacheLangPref(pref)
    set({ langPref: pref, lang: resolveLangPref(pref) })
    void window.api.settings.set('language', pref)
  },
  setEditorFont: (font) => { set({ editorFont: font }); void window.api.settings.set('editor_font', font) },
  setSidebarSide: (side) => { set({ sidebarSide: side }); void window.api.settings.set('sidebar_side', side) },
  setEdit: (enabled) => { set({ editEnabled: enabled }); void window.api.settings.set('edit_enabled', enabled) }
})
