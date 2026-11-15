/** Los avisos «[Tutti]» para los agentes: esperan en una bandeja y se les escriben, juntos, cuando están libres. */
import { currentLeader } from './leader'
import * as pty from './pty'

interface Notice { text: string; at: number }
const inbox = new Map<string, Notice[]>()
const TYPING_QUIET_SECONDS = 10          // si el usuario tecleó en el panel hace menos, no se le escribe encima
const PATIENCE_MS = 60_000               // si el agente sigue ocupado tanto tiempo, el aviso se entrega igualmente

/** Deja un aviso para un agente: se le escribe cuando está libre y el usuario no está tecleando en su panel (o lo pide con get_updates). */
export function notify(agentId: string, text: string): void {
  if (!pty.hasSession(agentId)) {          // quien lo esperaba se cerró: lo recibe el líder, que sigue el trabajo
    const leader = currentLeader()
    if (!leader || leader.id === agentId) return
    agentId = leader.id
  }
  inbox.set(agentId, [...(inbox.get(agentId) ?? []), { text, at: Date.now() }])
}

/** Entrega los avisos pendientes de cada agente, todos juntos en un solo mensaje. */
export function deliverNotices(): void {
  for (const [id, list] of inbox) {
    if (!pty.hasSession(id)) { inbox.delete(id); continue }
    if (pty.typedFor(id) < TYPING_QUIET_SECONDS) continue          // nunca encima de lo que escribe el usuario
    if (pty.idleFor(id) < 3 && Date.now() - list[0].at < PATIENCE_MS) continue          // ocupado: si tarda mucho, se le entrega igual
    inbox.delete(id)
    pty.sendPrompt(id, list.map((n) => n.text).join('\n\n'))
  }
}

/** Se lleva los avisos pendientes de un agente (get_updates): ya no se le escriben. */
export function takeNotices(agentId: string): string[] {
  const list = inbox.get(agentId) ?? []
  inbox.delete(agentId)
  return list.map((n) => n.text)
}

/** Cuántos avisos espera cada agente abierto. */
export const noticeCounts = (): Record<string, number> =>
  Object.fromEntries([...inbox].filter(([id]) => pty.hasSession(id)).map(([id, list]) => [id, list.length]))
