import type { StateCreator } from 'zustand'
import { confirmAsk } from '@/shared/lib/confirm'
import { tr } from './helpers'
import { isDirty } from './docs'
import type { ProjectConfig } from './types'
import type { State, ProjectSlice } from './types'

export const createProjectSlice: StateCreator<State, [], [], ProjectSlice> = (set, get) => {
  /** Cierra lo del proyecto actual y abre `path`, recordando la configuración del que se deja; `open` es un archivo que se abre al final. */
  const switchProject = (path: string | null, open?: string): void => {
    const prev = get().project
    // la configuración del proyecto que se deja: pestaña de la barra lateral y archivos abiertos
    const state = get()
    const leaving: ProjectConfig = { tab: state.tab, docs: state.docs.filter((d) => !d.diffOf && d.original === undefined && !['graph', 'hookform', 'steeringform', 'skillform'].includes(d.kind)).map((d) => d.path), activeDoc: state.activeDoc }
    // se cierra todo: agentes, terminales y archivos
    ;[...state.panes, ...state.shells].forEach((p) => window.api.pty.kill(p.id))
    set({ project: path, git: null, panes: [], shells: [], shellActive: null, shellMax: false, activePane: null, docs: [], activeDoc: null, tab: 'files', focus: 'tree' })
    void window.api.settings.set('project', path)
    void window.api.ai.cancel('chat')           // la conversación es de cada proyecto: se deja la del anterior y se carga la de este
    get().restoreChat()
    void (async () => {
      const configs = { ...(((await window.api.settings.get('project_configs')) as Record<string, ProjectConfig> | undefined) ?? {}) }
      if (prev) configs[prev] = leaving
      void window.api.settings.set('project_configs', configs)
      const known = path ? configs[path] : undefined
      if (!path || get().project !== path) return
      if (known) {                                                  // ya conocido: se recupera su configuración (uno nuevo se queda limpio)
        set({ tab: ['mcp', 'context'].includes(known.tab as string) ? 'tutti' : known.tab })       // las pestañas MCP y Contexto ya no existen: viven en Tutti
        for (const f of known.docs) await get().openDoc(f)
        if (known.activeDoc && get().docs.some((d) => d.path === known.activeDoc)) set({ activeDoc: known.activeDoc })
        set({ focus: 'tree' })
      }
      if (open && get().project === path) { await get().openDoc(open); set({ activeDoc: open, focus: 'editor' }) }       // `tutti archivo`: queda delante
    })()
    if (!path) return
    const recentProjects = [path, ...get().recentProjects.filter((p) => p !== path)].slice(0, 10)
    set({ recentProjects })
    void window.api.settings.set('recent_projects', recentProjects)
  }

  return {
    project: null, recentProjects: [], git: null,

    setProject: (path, open) => {
      if (path === get().project) { if (open) void get().openDoc(open); return }
      const dirty = get().docs.filter((d) => !d.diffOf && isDirty(d))
      if (!dirty.length) { switchProject(path, open); return }
      // con archivos sin guardar se pregunta antes de descartarlos; la respuesta llega después, así que se vuelve a mirar el estado
      void confirmAsk(tr(get, 'store.discard', { n: dirty.length })).then((yes) => { if (yes && path !== get().project) switchProject(path, open) })
    },

    removeRecentProject: (path) => {
      const recentProjects = get().recentProjects.filter((p) => p !== path)
      set({ recentProjects })
      void window.api.settings.set('recent_projects', recentProjects)
    },
  }
}
