import type { StateCreator } from 'zustand'
import { basename } from '@/shared/lib/paths'
import { tr } from './helpers'
import type { State, PanesSlice } from './types'

const PENDING = '__pending__'   // paneSplit mientras se elige el agente que va en la segunda mitad
let paneId = 1   // solo para la terminal (los agentes piden su id a la app)

export const createPanesSlice: StateCreator<State, [], [], PanesSlice> = (set, get) => ({
  panes: [], shells: [], shellActive: null, shellMax: false, activePane: null, paneSplit: null, paneRoles: {}, paneInbox: {}, paneAsking: [], paneLeader: null,

  openAgent: async (agent, args = [], opts = {}) => {
    const cwd = opts.cwd || get().project
    if (!cwd) { get().toast(tr(get, 'store.openProjectFirst'), 'error'); return }
    const id = await window.api.orchestra.newId()          // los ids los reparte la app: así no chocan con los de los sub-agentes
    const title = opts.title ?? `${agent.name} · ${basename(cwd)}`
    set((s) => ({ panes: [...s.panes, { id, kind: 'agent', title, name: agent.name, command: agent.command, args: [...(agent.args ?? []), ...args], cwd, ...(opts.prompt && { prompt: opts.prompt }) }], activePane: id, focus: 'pane', modal: null, paneSplit: s.paneSplit === PENDING ? s.activePane : s.paneSplit }))
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
    return { panes, shells, shellActive, activePane, shellMax: shells.length ? s.shellMax : false, focus: 'pane', paneFocus: s.paneFocus + 1 }      // el teclado pasa al panel que queda
  }),
  toggleSplit: (on) => set((s) => {
    const i = s.panes.findIndex((p) => p.id === s.activePane)
    const want = on ?? !s.paneSplit
    if (!want) return { paneSplit: null }
    if (s.panes.length < 2) return s.panes.length ? { modal: 'agents', paneSplit: PENDING } : {}          // con un solo agente: abre el selector y el nuevo queda al lado
    return { paneSplit: s.panes[((i < 0 ? s.panes.length - 1 : i) + 1) % s.panes.length].id }          // el siguiente agente de la lista
  }),
  focusPane: (id) => set((s) => ({ activePane: id, ...(s.paneSplit === id && s.activePane && s.panes.some((p) => p.id === s.activePane) && { paneSplit: s.activePane }),  focus: 'pane', paneFocus: s.paneFocus + 1, ...(s.shells.some((p) => p.id === id) && { shellActive: id }) })),
})
