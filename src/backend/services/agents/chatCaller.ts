/** El chat integrado como «llamador» del servidor MCP: reparte tareas como un agente abierto, pero no tiene panel ni terminal. */
import type { Meta } from './pty'

const chats = new Map<string, Meta>()

/** Id con el que el chat de una ventana se presenta al servidor MCP. */
export const chatId = (windowId: number): string => `chat${windowId}`

/** `command`: el agente que responde en ese chat (Claude o Codex). */
export function registerChat(id: string, cwd: string, command = 'claude'): void {
  chats.set(id, { id, kind: 'agent', name: 'Chat', command, cwd })
}
export const unregisterChat = (id: string): void => { chats.delete(id) }
export const chatMeta = (id: string): Meta | undefined => chats.get(id)
/** El `slot` (columna) de un chat a partir de su id: `chat<ventana + slot × 100000>`. */
export const slotOf = (id: string): number => Math.floor(Number(id.replace('chat', '')) / 100_000)
export const isChat = (id: string): boolean => chats.has(id)
