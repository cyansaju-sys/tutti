import type { StateCreator } from 'zustand'
import { tr } from './helpers'
import { isDirty } from './docs'
import type { ProjectConfig } from './types'
import type { State, ProjectSlice } from './types'

export const createProjectSlice: StateCreator<State, [], [], ProjectSlice> = (set, get) => ({
  project: null, recentProjects: [], git: null,

  setProject: (path) => {
    const prev = get().project
    if (path === prev) return
    const dirty = get().docs.filter((d) => !d.diffOf && isDirty(d))
    if (dirty.length && !window.confirm(tr(get, 'store.discard', { n: dirty.length }))) return
    // la configuración del proyecto que se deja: pestaña de la barra lateral y archivos abiertos
    const state = get()
    const leaving: ProjectConfig = { tab: state.tab, docs: state.docs.filter((d) => !d.diffOf && d.original === undefined && !['graph', 'hookform', 'specform', 'steeringform', 'skillform'].includes(d.kind)).map((d) => d.path), activeDoc: state.activeDoc }
    // se cierra todo: agentes, terminales y archivos
    ;[...state.panes, ...state.shells].forEach((p) => window.api.pty.kill(p.id))
    set({ project: path, git: null, panes: [], shells: [], shellActive: null, shellMax: false, activePane: null, docs: [], activeDoc: null, tab: 'files', focus: 'tree' })
    void window.api.settings.set('project', path)
    void (async () => {
      const configs = { ...(((await window.api.settings.get('project_configs')) as Record<string, ProjectConfig> | undefined) ?? {}) }
      if (prev) configs[prev] = leaving
      void window.api.settings.set('project_configs', configs)
      const known = path ? configs[path] : undefined
      if (!path || !known || get().project !== path) return       // proyecto nuevo: se queda limpio
      set({ tab: known.tab })                                       // ya conocido: se recupera su configuración
      for (const f of known.docs) await get().openDoc(f)
      if (known.activeDoc && get().docs.some((d) => d.path === known.activeDoc)) set({ activeDoc: known.activeDoc })
      set({ focus: 'tree' })
    })()
    if (!path) return
    const recentProjects = [path, ...get().recentProjects.filter((p) => p !== path)].slice(0, 10)
    set({ recentProjects })
    void window.api.settings.set('recent_projects', recentProjects)
  },

  removeRecentProject: (path) => {
    const recentProjects = get().recentProjects.filter((p) => p !== path)
    set({ recentProjects })
    void window.api.settings.set('recent_projects', recentProjects)
  },
})
