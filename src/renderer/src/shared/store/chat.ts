import { create } from 'zustand'
import type { ChatEffort, ChatEvent, ChatSendRequest } from '@/shared/types'

export interface ChatMessage { id: number; role: 'user' | 'assistant' | 'tool' | 'error'; text: string; detail?: string }
export interface ChatPermission { id: string; tool: string; input: string }

interface ChatState {
  messages: ChatMessage[]
  running: boolean
  session: string | null
  project: string | null              // el proyecto de la conversación: al cambiar de proyecto empieza una nueva
  permissions: ChatPermission[]
  send: (text: string, opts: { project: string | null; model: string; effort: ChatEffort; mode: ChatSendRequest['mode'] }) => void
  cancel: () => void
  answer: (id: string, allow: boolean) => void
  clear: () => void
}

let nextId = 1
const add = (messages: ChatMessage[], m: Omit<ChatMessage, 'id'>): ChatMessage[] => [...messages, { ...m, id: nextId++ }]

/** La conversación del chat: vive fuera del panel para no perderse al cerrarlo. */
export const useChat = create<ChatState>((set, get) => ({
  messages: [], running: false, session: null, project: null, permissions: [],
  send: (text, opts) => {
    const s = get()
    if (s.running || !text.trim()) return
    const fresh = s.project !== opts.project          // otro proyecto: otra conversación
    set({ messages: add(fresh ? [] : s.messages, { role: 'user', text }), running: true, project: opts.project, session: fresh ? null : s.session, permissions: [] })
    void window.api.chat.send({ text, project: opts.project, model: opts.model, effort: opts.effort, mode: opts.mode, session: fresh ? null : s.session })
  },
  cancel: () => { void window.api.chat.cancel() },
  answer: (id, allow) => { set((s) => ({ permissions: s.permissions.filter((p) => p.id !== id) })); void window.api.chat.answer(id, allow) },
  clear: () => { if (!get().running) set({ messages: [], session: null, permissions: [] }) }
}))

const onEvent = (e: ChatEvent): void => {
  const s = useChat.getState()
  switch (e.kind) {
    case 'session': if (s.session !== e.id) useChat.setState({ session: e.id }); break
    case 'text': useChat.setState({ messages: add(s.messages, { role: 'assistant', text: e.text }) }); break
    case 'tool': useChat.setState({ messages: add(s.messages, { role: 'tool', text: e.name, detail: e.input }) }); break
    case 'permission': useChat.setState({ permissions: [...s.permissions, { id: e.id, tool: e.tool, input: e.input }] }); break
    case 'error': useChat.setState({ messages: add(s.messages, { role: 'error', text: e.message }) }); break
    case 'done': useChat.setState({ running: false, permissions: [] }); break
  }
}
if (typeof window !== 'undefined' && window.api?.chat) window.api.chat.onEvent(onEvent)
