import type { StateCreator } from 'zustand'
import { basename } from '@/shared/lib/paths'
import { tr } from './helpers'
import type { State, PanesSlice } from './types'

let paneId = 1   // solo para la terminal (los agentes piden su id a la app)

export const createPanesSlice: StateCreator<State, [], [], PanesSlice> = (set, get) => ({
  panes: [], shells: [], shellActive: null, shellMax: false, activePane: null,

  openAgent: async (agent, args = [], opts = {}) => {
    const cwd = opts.cwd || get().project
    if (!cwd) { get().toast(tr(get, 'store.openProjectFirst'), 'error'); return }
    const id = await window.api.orchestra.newId()          // los ids los reparte la app: así no chocan con los de los sub-agentes
    const title = opts.title ?? `${agent.name} · ${basename(cwd)}`
    set((s) => ({ panes: [...s.panes, { id, kind: 'agent', title, name: agent.name, command: agent.command, args: [...(agent.args ?? []), ...args], cwd }], activePane: id, focus: 'pane', modal: null }))
  },
  /** Un agente pidió abrir otro (reparto de tareas): se añade su panel y la terminal inicia el proceso con la tarea. */
  addPane: (pane) => set((s) => (s.panes.some((p) => p.id === pane.id) ? s : { panes: [...s.panes, pane] })),
  toggleShell: async () => {
    if (get().shells.length) get().closeShells()
    else await get().addShell()
  },
  addShell: async () => {
    const project = get().project
    const command = await window.api.agents.shell()
    const id = `s${paneId++}`
    const title = command.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') || 'terminal'
    set((s) => ({ shells: [...s.shells, { id, kind: 'shell', title, command, args: [], cwd: project ?? '' }], shellActive: id, activePane: id, focus: 'pane' }))
  },
  closeShells: () => {
    get().shells.forEach((sh) => window.api.pty.kill(sh.id))
    set({ shells: [], shellActive: null, shellMax: false, activePane: get().panes.at(-1)?.id ?? null })
  },
  closePane: (id) => set((s) => {
    window.api.pty.kill(id)
    const panes = s.panes.filter((p) => p.id !== id)
    const shells = s.shells.filter((p) => p.id !== id)
    const shellActive = s.shellActive === id ? (shells.at(-1)?.id ?? null) : s.shellActive
    const activePane = s.activePane === id ? (shellActive ?? panes.at(-1)?.id ?? null) : s.activePane
    return { panes, shells, shellActive, activePane, shellMax: shells.length ? s.shellMax : false }
  }),
})
