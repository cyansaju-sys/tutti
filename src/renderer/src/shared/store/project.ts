import type { StateCreator } from 'zustand'
import { confirmAsk } from '@/renderer/src/shared/lib/confirm'
import { tr } from './helpers'
import { isDirty } from './docs'
import type { ProjectConfig } from './types'
import type { State, ProjectSlice } from './types'

export const createProjectSlice: StateCreator<State, [], [], ProjectSlice> = (set, get) => {
  /** Cierra lo del proyecto actual y abre `path`, recordando la configuración del que se deja; `open` es un archivo que se abre al final. */
  const switchProject = (path: string | null, open?: string, reload = true): void => {
    const prev = get().project
    // la configuración del proyecto que se deja: pestaña de la barra lateral y archivos abiertos
    const state = get()
    const leaving: ProjectConfig = { tab: state.tab, docs: state.docs.filter((d) => !d.diffOf && d.original === undefined && !['graph', 'hookform', 'steeringform', 'skillform', 'roleform', 'rolegraph', 'news'].includes(d.kind)).map((d) => d.path), activeDoc: state.activeDoc, shells: state.shells.length }
    // se cierra todo: agentes, terminales y archivos
    ;[...state.panes, ...state.shells].forEach((p) => window.api.pty.kill(p.id))
    // al recargar, la pantalla no cambia antes: el estado nuevo solo se pone aquí si no hay recarga (arranque con `tutti .`)
    if (!reload) set({ project: path, git: null, panes: [], shells: [], shellActive: null, shellMax: false, activePane: null, docs: [], activeDoc: null, tab: 'files', focus: 'tree' })
    // como VSCode: al abrir o cambiar de proyecto la ventana se recarga y arranca limpia (nada del anterior queda en memoria)
    void (async () => {
      const configs = { ...(((await window.api.settings.get('project_configs')) as Record<string, ProjectConfig> | undefined) ?? {}) }
      if (prev) configs[prev] = leaving
      await window.api.settings.set('project_configs', configs)
      await window.api.settings.set('project', path)
      if (path) {
        const recentProjects = [path, ...get().recentProjects.filter((p) => p !== path)].slice(0, 10)
        set({ recentProjects })
        await window.api.settings.set('recent_projects', recentProjects)
      }
      if (!reload) { await get().restoreProject(path, open); return }
      try { sessionStorage.setItem('tutti_reload', JSON.stringify({ open: open ?? null })) } catch { /* sin sessionStorage solo se pierde el archivo a abrir */ }
      window.location.reload()
    })()
  }

  return {
    project: null, recentProjects: [], git: null,

    /** Recupera la configuración recordada de `path` (pestaña y archivos abiertos); uno nuevo se queda limpio. */
    restoreProject: async (path, open) => {
      const configs = ((await window.api.settings.get('project_configs')) as Record<string, ProjectConfig> | undefined) ?? {}
      const known = path ? configs[path] : undefined
      if (!path || get().project !== path) return
      if (known) {
        set({ tab: ['mcp', 'context'].includes(known.tab as string) ? 'tutti' : known.tab })       // las pestañas MCP y Contexto ya no existen: viven en Tutti
        for (const f of known.docs) await get().openDoc(f)
        if (known.activeDoc && get().docs.some((d) => d.path === known.activeDoc)) set({ activeDoc: known.activeDoc })
        for (let i = 0; i < Math.min(known.shells ?? 0, 5); i++) await get().addShell()          // las terminales que se dejaron abiertas
        set({ focus: 'tree' })
      }
      if (open && get().project === path) { await get().openDoc(open); set({ activeDoc: open, focus: 'editor' }) }       // `tutti archivo`: queda delante
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
