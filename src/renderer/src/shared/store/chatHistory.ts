import type { ChatTurn } from '@shared/types'

const KEY = 'chat_history'
const MAX_TURNS = 40
const MAX_PROJECTS = 20
let queue: Promise<unknown> = Promise.resolve()       // las escrituras van una tras otra: cada una lee, cambia y guarda el conjunto

const readAll = async (): Promise<Record<string, ChatTurn[]>> => {
  const raw = await window.api.settings.get(KEY)
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, ChatTurn[]>) : {}
}

/** La conversación guardada de un proyecto (vacía si no hay). */
export async function loadChat(project: string): Promise<ChatTurn[]> {
  const turns = (await readAll())[project]
  return Array.isArray(turns) ? turns.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string') : []
}

/** Guarda la conversación de un proyecto: sin lo adjunto (pesa mucho), con los últimos mensajes y sin pasar de unos cuantos proyectos. */
export function saveChat(project: string, turns: ChatTurn[]): void {
  const slim = turns.slice(-MAX_TURNS).map(({ role, text }) => ({ role, text }))
  queue = queue.then(async () => {
    const all = await readAll()
    delete all[project]                                // el más reciente va al final
    if (slim.length) all[project] = slim
    const keys = Object.keys(all)
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PROJECTS))) delete all[k]
    await window.api.settings.set(KEY, all)
  }).catch(() => undefined)
}
