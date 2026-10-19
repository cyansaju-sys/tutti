/** El líder: el agente que reparte el trabajo y recibe los avisos de los demás. */
import * as pty from './pty'

let chosen: string | null = null

/** El líder: el que eligió el usuario si sigue abierto; si no, el agente abierto más antiguo. */
export function currentLeader(): pty.Meta | undefined {
  const open = pty.agentSessions()
  return open.find((m) => m.id === chosen) ?? open[0]
}

/** El usuario elige el líder; false si ese agente no está abierto. */
export function chooseLeader(id: string): boolean {
  if (!pty.agentSessions().some((m) => m.id === id)) return false
  chosen = id
  return true
}
