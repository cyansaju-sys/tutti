import type { ChatCommand, ChatItem } from '@/shared/types'
import { probe } from './probe'

/** Los comandos «/» disponibles: los de Claude Code y los de las skills del usuario y del proyecto abierto. */
export const listCommands = (cwd?: string): Promise<ChatCommand[]> => probe(async (q) =>
  (await q.supportedCommands()).map((c) => ({ name: c.name, description: c.description, hint: c.argumentHint, builtin: Boolean(c.builtin) })), cwd)

/** El estado de conexión de cada servidor MCP que ve Claude en el proyecto; espera un poco a que dejen de estar «pending». */
export const mcpStatus = (project: string | null): Promise<Record<string, NonNullable<ChatItem['status']>>> => probe(async (q) => {
  let list = await q.mcpServerStatus()
  for (let i = 0; i < 20 && list.some((s) => s.status === 'pending'); i++) { await new Promise((r) => setTimeout(r, 500)); list = await q.mcpServerStatus() }
  return Object.fromEntries(list.map((s) => [s.name, s.status]))
}, project ?? undefined).catch(() => ({}))
