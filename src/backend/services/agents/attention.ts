import { awaitingInput } from './launch'
import * as pty from './pty'
import { toUi } from './runtime'
import { INPUT_ROWS } from './tasks'

const PAUSE_SECONDS = 3       // sin salida durante este tiempo y con la pregunta en pantalla = está esperando
const ROWS = 15
const asking = new Map<string, string>()       // agente -> lo que pregunta (para no avisar dos veces de lo mismo)
const told = new Map<string, string>()

/** Los agentes parados ahora mismo esperando un permiso (la pestaña los marca). */
export const askingIds = (): string[] => [...asking.keys()]

/**
 * Cada vez que un agente se queda parado esperando un permiso, avisa una vez a la interfaz (que decide si el usuario ya lo está viendo).
 * Si tras responder la pregunta sigue visible en pantalla, es la misma y no se avisa otra vez; una pregunta distinta sí avisa.
 */
export function checkAttention(): void {
  const live = new Set(pty.agentSessions().map((m) => m.id))
  asking.clear()
  for (const m of pty.agentSessions()) {
    if (pty.idleFor(m.id) < PAUSE_SECONDS) continue
    const screen = pty.screenText(m.id, INPUT_ROWS)
    if (!awaitingInput(screen)) { told.delete(m.id); continue }
    const question = screen.split('\n').slice(-ROWS).map((l) => l.trim()).filter(Boolean).join('\n')
    asking.set(m.id, question)
    if (told.get(m.id) === question) continue
    told.set(m.id, question)
    toUi('orchestra:attention', { id: m.id, name: m.name })
  }
  for (const id of [...told.keys()]) if (!live.has(id)) told.delete(id)
}
