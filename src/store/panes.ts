import type { StateCreator } from 'zustand'
import { tr } from './helpers'
import type { State, PanesSlice } from './types'

export const MAX_VISIBLE = 6     // la vista dividida: hasta 3 en horizontal y 2 en vertical
/** Si hay un hueco libre en la vista dividida, el agente nuevo lo ocupa y el que estaba delante se queda a su lado. */
const openSlot = (s: State): { paneSplit?: string[] } => {
  const shown = s.paneSplit.filter((id) => s.panes.some((p) => p.id === id))
  const prev = s.panes.some((p) => p.id === s.activePane) ? s.activePane : null
  return prev && s.paneWant > shown.length + 1 ? { paneSplit: [...shown, prev] } : {}
}
let paneId = 1   // solo para la terminal (los agentes piden su id a la app)

export const createPanesSlice: StateCreator<State, [], [], PanesSlice> = (set, get) => ({
  panes: [], shells: [], shellActive: null, shellMax: false, activePane: null, paneSplit: [], paneWant: 1, paneInbox: {}, paneAsking: [], paneRoles: {}, paneLeader: null,

  openAgent: async (agent, args = [], opts = {}) => {
    const cwd = opts.cwd || get().project
    if (!cwd) { get().toast(tr(get, 'store.openProjectFirst'), 'error'); return }
    const id = await window.api.orchestra.newId()          // los ids los reparte la app: así no chocan con los de los sub-agentes
    const title = opts.title ?? agent.name
    set((s) => ({ panes: [...s.panes, { id, kind: 'agent', title, name: agent.name, command: agent.command, args: [...(agent.args ?? []), ...args], cwd, ...(opts.prompt && { prompt: opts.prompt }) }], activePane: id, focus: 'pane', modal: null, ...openSlot(s) }))
  },
  /** Un agente pidió abrir otro (reparto de tareas): se añade su panel y la terminal inicia el proceso con la tarea. */
  addPane: (pane) => set((s) => {
    if (s.panes.some((p) => p.id === pane.id)) return s
    // un sub-agente (reparto de tareas) se abre dividiendo la vista: el que lo creó a un lado y él al otro
    // los que ya se veían se quedan y el nuevo se suma a la cuadrícula (hasta 6; si no cabe, deja sitio quitando el más antiguo)
    const keep = s.paneSplit.filter((id) => id !== pane.parentId && s.panes.some((p) => p.id === id))
    const split = pane.parentId && s.panes.some((p) => p.id === pane.parentId) ? { activePane: pane.parentId, paneSplit: [...keep, pane.id].slice(-(MAX_VISIBLE - 1)) } : {}
    return { panes: [...s.panes, pane], ...split, ...(split.paneSplit && { paneWant: Math.max(s.paneWant, split.paneSplit.length + 1) }) }
  }),
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
    const wasShown = s.panes.some((p) => p.id === id) && (s.activePane === id || s.paneSplit.includes(id))
    const paneSplit = s.paneSplit.filter((x) => x !== id)
    return { panes, shells, shellActive, activePane, paneSplit, paneWant: wasShown ? Math.max(1, s.paneWant - 1) : s.paneWant, shellMax: shells.length ? s.shellMax : false, focus: 'pane', paneFocus: s.paneFocus + 1 }      // el teclado pasa al panel que queda
  }),
  closeSlot: () => {
    const s = get()
    const shown = new Set([...s.paneSplit, s.activePane].filter((id): id is string => !!id && s.panes.some((p) => p.id === id)))
    const slots = s.paneWant - Math.max(shown.size, 1)
    if (s.panes.length === 0 || slots <= 0) return false
    set({ paneWant: s.paneWant - 1 })
    return true
  },
  splitPanes: (n) => set((s) => {
    const want = Math.min(Math.max(Math.floor(n), 1), MAX_VISIBLE)
    const i = s.panes.findIndex((p) => p.id === s.activePane)
    const from = i < 0 ? s.panes.length - 1 : i
    const count = Math.min(want, s.panes.length) - 1          // los que faltan quedan como huecos para elegir agente
    return { paneWant: want, paneSplit: Array.from({ length: Math.max(count, 0) }, (_, k) => s.panes[(from + 1 + k) % s.panes.length].id) }      // los siguientes agentes de la lista
  }),
  focusPane: (id) => set((s) => ({ activePane: id, ...(s.paneSplit.includes(id) && s.activePane && s.panes.some((p) => p.id === s.activePane) && { paneSplit: s.paneSplit.map((x) => (x === id ? s.activePane! : x)) }),  focus: 'pane', paneFocus: s.paneFocus + 1, ...(s.shells.some((p) => p.id === id) && { shellActive: id }) })),
})
