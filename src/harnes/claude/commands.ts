import type { ChatCommand, ChatItem } from '@/shared/types'
import { probe } from './probe'
import { tm } from '@/backend/utils/i18n'

/** Los comandos «/» disponibles: los de Claude Code y los de las skills del usuario y del proyecto abierto. */
export const listCommands = (cwd?: string): Promise<ChatCommand[]> => probe(async (q) => {
  const list = (await q.supportedCommands()).filter((c) => !['login', 'logout'].includes(c.name)).map((c) => ({ name: c.name, description: c.description, hint: c.argumentHint, builtin: Boolean(c.builtin) }))
  // /btw, /login y /logout los resuelve Tutti (una pregunta al margen; abrir `claude auth login` en una terminal), no el SDK: se ofrecen siempre
  const own = [{ name: 'btw', description: tm('chat.btwDesc'), hint: tm('chat.btwHint'), builtin: true }, { name: 'login', description: tm('chat.loginDesc'), hint: '', builtin: true }, { name: 'logout', description: tm('chat.logoutDesc'), hint: '', builtin: true }]
  return [...list, ...own.filter((o) => !list.some((c) => c.name === o.name))]
}, cwd)

/** El estado de conexión de cada servidor MCP que ve Claude en el proyecto; espera un poco a que dejen de estar «pending». */
export const mcpStatus = (project: string | null): Promise<Record<string, NonNullable<ChatItem['status']>>> => probe(async (q) => {
  let list = await q.mcpServerStatus()
  for (let i = 0; i < 20 && list.some((s) => s.status === 'pending'); i++) { await new Promise((r) => setTimeout(r, 500)); list = await q.mcpServerStatus() }
  return Object.fromEntries(list.map((s) => [s.name, s.status]))
}, project ?? undefined).catch(() => ({}))
