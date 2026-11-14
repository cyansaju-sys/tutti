import type { ChatCommand } from '@/shared/types'
import { probe } from './probe'

/** Los comandos «/» disponibles: los de Claude Code y los de las skills del usuario y del proyecto abierto. */
export const listCommands = (cwd?: string): Promise<ChatCommand[]> => probe(async (q) =>
  (await q.supportedCommands()).map((c) => ({ name: c.name, description: c.description, hint: c.argumentHint, builtin: Boolean(c.builtin) })), cwd)
