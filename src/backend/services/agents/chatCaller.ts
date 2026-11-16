/** El chat integrado como «llamador» del servidor MCP: reparte tareas como un agente abierto, pero no tiene panel ni terminal. */
import type { Meta } from './pty'

const chats = new Map<string, Meta>()

/** Id con el que el chat de una ventana se presenta al servidor MCP. */
export const chatId = (windowId: number): string => `chat${windowId}`

export function registerChat(id: string, cwd: string): void {
  chats.set(id, { id, kind: 'agent', name: 'Chat', command: 'claude', cwd })
}
export const unregisterChat = (id: string): void => { chats.delete(id) }
export const chatMeta = (id: string): Meta | undefined => chats.get(id)
export const isChat = (id: string): boolean => chats.has(id)
