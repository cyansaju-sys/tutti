import type { StateCreator } from 'zustand'
import { cacheLangPref, cachedLangPref, resolveLangPref } from '@/shared/lib/langPref'
import { cacheTheme, cachedTheme, paintTheme, resolveTheme } from '@/shared/lib/theme'
import type { ToastKind } from './types'
import type { State, UiSlice } from './types'
let toastId = 1

/** Deduce el tipo de aviso a partir del texto cuando no se indica. */
const guessKind = (m: string): ToastKind => {
  const low = m.toLowerCase()
  if (['no se pudo', 'falló', 'error', 'no se encontr', 'no existe', 'could not', 'failed', 'not found', 'does not exist'].some((w) => low.includes(w))) return 'error'
  if (['copiad', 'guardad', 'creada', 'creado', 'hecho', 'subido', 'copied', 'saved', 'created', 'done', 'pushed'].some((w) => low.includes(w))) return 'ok'
  return 'info'
}

export const createUiSlice: StateCreator<State, [], [], UiSlice> = (set, get) => ({
  newsSince: null, tab: 'files', sidebarOpen: true, sidebarWidth: 300, editorWidth: 720, shellHeight: 240, editEnabled: true, theme: cachedTheme(), themeMode: resolveTheme(cachedTheme()), langPref: cachedLangPref(), lang: resolveLangPref(cachedLangPref()),
  searchReplace: false, searchToken: 0, focus: 'tree', paneFocus: 0, modal: null, toasts: [], maximized: false, agents: [], update: { status: 'idle' },

  toast: (message, kind) => {
    const id = toastId++
    set((s) => ({ toasts: [...s.toasts, { id, kind: kind ?? guessKind(message), message }].slice(-4) }))
    const long = (kind ?? guessKind(message)) === 'error'
    setTimeout(() => get().dismissToast(id), long ? 6000 : 3500)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setTheme: (pref) => {
    const mode = resolveTheme(pref)
    cacheTheme(pref); paintTheme(mode)
    set({ theme: pref, themeMode: mode })
    void window.api.settings.set('theme', pref)
  },
  setLang: (pref) => {
    cacheLangPref(pref)
    set({ langPref: pref, lang: resolveLangPref(pref) })
    void window.api.settings.set('language', pref)
  },
  setEdit: (enabled) => { set({ editEnabled: enabled }); void window.api.settings.set('edit_enabled', enabled) }
})
