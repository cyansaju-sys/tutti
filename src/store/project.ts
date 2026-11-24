import type { StateCreator } from 'zustand'
import { confirmAsk } from '@/lib/confirm'
import { tr } from './helpers'
import { isDirty } from './docs'
import type { ProjectConfig } from './types'
import type { State, ProjectSlice } from './types'

const NO_FILE = ['graph', 'hookform', 'steeringform', 'skillform', 'roleform', 'rolegraph', 'news', 'shortcuts']
/** Lo que se recuerda del proyecto abierto: pestaña de la barra lateral, archivos abiertos y el panel de abajo (terminales y problemas). */
export const configOf = (state: State): ProjectConfig => ({
  tab: state.tab, docs: state.docs.filter((d) => !d.diffOf && d.original === undefined && !NO_FILE.includes(d.kind)).map((d) => d.path), activeDoc: state.activeDoc, shells: state.shells.length,
  panel: { tab: state.panelTab, problems: state.problemsOpen, height: state.shellHeight, max: state.shellMax, active: Math.max(0, state.shells.findIndex((x) => x.id === state.shellActive)) }
})

/** Guarda la configuración del proyecto abierto (se llama al cambiar algo, para no perderla si la ventana se cierra). */
export async function saveProjectConfig(state: State): Promise<void> {
  if (!state.project) return
  const configs = { ...(((await window.api.settings.get('project_configs')) as Record<string, ProjectConfig> | undefined) ?? {}) }
  configs[state.project] = configOf(state)
  await window.api.settings.set('project_configs', configs)
}

export const createProjectSlice: StateCreator<State, [], [], ProjectSlice> = (set, get) => {
  /** Cierra lo del proyecto actual y abre `path`, recordando la configuración del que se deja; `open` es un archivo que se abre al final. */
  const switchProject = (path: string | null, open?: string, reload = true): void => {
    const prev = get().project
    // la configuración del proyecto que se deja: pestaña de la barra lateral y archivos abiertos
    const state = get()
    const leaving = configOf(state)
    // se cierra todo: agentes, terminales y archivos
    ;[...state.panes, ...state.shells].forEach((p) => window.api.pty.kill(p.id))
    // al recargar, la pantalla no cambia antes: el estado nuevo solo se pone aquí si no hay recarga (arranque con `tutti .`)
    if (!reload) set({ project: path, git: null, panes: [], shells: [], shellActive: null, shellMax: false, activePane: null, docs: [], activeDoc: null, tab: 'files', focus: 'tree' })
    // como VSCode: al abrir o cambiar de proyecto la ventana se recarga y arranca limpia (nada del anterior queda en memoria)
    void (async () => {
      const configs = { ...(((await window.api.settings.get('project_configs')) as Record<string, ProjectConfig> | undefined) ?? {}) }
      if (prev) configs[prev] = leaving
      const recentProjects = path ? [path, ...get().recentProjects.filter((p) => p !== path)].slice(0, 10) : null
      if (recentProjects) set({ recentProjects })
      await Promise.all([          // las escrituras son independientes: a la vez
        window.api.settings.set('project_configs', configs),
        window.api.settings.set('project', path),
        recentProjects ? window.api.settings.set('recent_projects', recentProjects) : Promise.resolve()
      ])
      if (!reload) { await get().restoreProject(path, open); return }
      try { sessionStorage.setItem('tutti_reload', JSON.stringify({ open: open ?? null })) } catch { /* sin sessionStorage solo se pierde el archivo a abrir */ }
      window.location.reload()
    })()
  }

  let restoring: Promise<void> | null = null
  const restore = async (path: string | null, open?: string): Promise<void> => {
    const configs = ((await window.api.settings.get('project_configs')) as Record<string, ProjectConfig> | undefined) ?? {}
    const known = path ? configs[path] : undefined
    if (!path || get().project !== path) return
    if (known) {
      set({ tab: ['mcp', 'context'].includes(known.tab as string) ? 'tutti' : known.tab })       // las pestañas MCP y Contexto ya no existen: viven en Tutti
      // los archivos se leen a la vez (no uno tras otro) y se dejan en su orden
      await Promise.all(known.docs.map((f) => get().openDoc(f)))
      set((s) => ({ docs: [...s.docs].sort((x, y) => known.docs.indexOf(x.path) - known.docs.indexOf(y.path)) }))
      if (known.activeDoc && get().docs.some((d) => d.path === known.activeDoc)) set({ activeDoc: known.activeDoc })
      await Promise.all(Array.from({ length: Math.max(0, Math.min(known.shells ?? 0, 5) - get().shells.length) }, () => get().addShell()))          // las terminales que se dejaron abiertas
      const panel = known.panel
      if (panel) {
        const shells = get().shells
        set({ panelTab: shells.length ? panel.tab : 'problems', problemsOpen: panel.problems, shellHeight: panel.height, shellMax: shells.length ? panel.max : false, shellActive: shells[panel.active]?.id ?? shells.at(-1)?.id ?? null })
      }
      set({ focus: 'tree' })
    }
    if (open && get().project === path) { await get().openDoc(open); set({ activeDoc: open, focus: 'editor' }) }       // `tutti archivo`: queda delante
  }

  return {
    project: null, recentProjects: [], git: null,

    /** Recupera la configuración recordada de `path` (pestaña y archivos abiertos); uno nuevo se queda limpio. */
    restoreProject: (path, open) => {
      // si se pide dos veces a la vez (p. ej. el arranque corre doble), la segunda espera a la primera: si no, las terminales se abren por duplicado
      if (restoring) return restoring
      restoring = restore(path, open).finally(() => { restoring = null })
      return restoring
    },
    setProject: (path, open, reload = true) => {
      if (path === get().project) { if (open) void get().openDoc(open); return }
      const dirty = get().docs.filter((d) => !d.diffOf && isDirty(d))
      if (!dirty.length) { switchProject(path, open, reload); return }
      // con archivos sin guardar se pregunta antes de descartarlos; la respuesta llega después, así que se vuelve a mirar el estado
      void confirmAsk(tr(get, 'store.discard', { n: dirty.length })).then((yes) => { if (yes && path !== get().project) switchProject(path, open, reload) })
    },

    removeRecentProject: (path) => {
      const recentProjects = get().recentProjects.filter((p) => p !== path)
      set({ recentProjects })
      void window.api.settings.set('recent_projects', recentProjects)
    },
  }
}
