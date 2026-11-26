import { useCallback } from 'react'
import { useStore } from '@/store'
import { useChat } from '@/store/chat'
import type { AgentOption } from './agentTarget'

/** El destino de lo que se pide desde la pestaña Tutti: el chat integrado. */
const CHAT: AgentOption = { key: 'chat', name: 'Chat', command: 'claude' }
const OPTIONS = [CHAT]

/**
 * Pedirle algo a Claude desde la pestaña Tutti: la petición va al chat (se abre si estaba cerrado) y se envía con el modelo, el esfuerzo
 * y el modo que tenga elegidos.
 */
export function useAskAgent() {
  const toast = useStore((s) => s.toast)
  const setPicked = useCallback((_key: string): void => undefined, [])
  /** Envía la petición al chat; devuelve su nombre. */
  const send = async (prompt: string): Promise<string | null> => {
    useStore.getState().setEditorFull(true)          // el chat solo está en «Modo agentes»
    useStore.getState().set({ chatOpen: true })
    useChat.getState().queue(prompt)
    return CHAT.name
  }
  return { options: OPTIONS, selected: CHAT as AgentOption | null, setPicked, send, toast }
}
