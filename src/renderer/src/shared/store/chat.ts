import { create } from 'zustand'
import type { ChatHistoryMessage, ChatEffort, ChatImage, ChatQuestion, ChatEvent, ChatSendRequest } from '@/shared/types'

export interface ChatMessage { id: number; role: 'user' | 'assistant' | 'tool' | 'error'; text: string; detail?: string; images?: string[]; live?: boolean; context?: string; toolId?: string; body?: string; file?: string; result?: string; resultError?: boolean }      // images: data URLs para mostrarlas
/** Lo que está seleccionado en el editor: el chat lo ofrece como contexto. */
export interface EditorSelection { path: string; startLine: number; endLine: number; text: string }
/** Lo gastado en la conversación: coste y tokens (la caché leída es lo que no se vuelve a pagar entero). */
export interface ChatUsage { cost: number; input: number; output: number; cacheRead: number; cacheWrite: number }
export interface ChatAsk { id: string; questions: ChatQuestion[] }
export interface ChatPermission { id: string; tool: string; input: string }

/** Una conversación abierta como pestaña; la activa vive en los campos de arriba y aquí queda su última copia. */
export interface ChatTab { id: number; messages: ChatMessage[]; session: string | null; project: string | null; usage: ChatUsage }

interface ChatState {
  tabs: ChatTab[]
  tab: number              // la pestaña activa
  newTab: () => void
  switchTab: (id: number) => void
  closeTab: (id: number) => void
  messages: ChatMessage[]
  running: boolean
  session: string | null
  project: string | null              // el proyecto de la conversación: al cambiar de proyecto empieza una nueva
  permissions: ChatPermission[]
  selection: EditorSelection | null
  asks: ChatAsk[]
  queued: string | null              // una petición hecha desde fuera del panel (la pestaña Tutti): el panel la envía con su modelo, esfuerzo y modo
  queue: (text: string) => void
  load: (session: string, project: string | null, history: ChatHistoryMessage[]) => void      // retoma una conversación guardada: la muestra y los próximos mensajes la continúan
  reply: (id: string, answers: Record<string, string> | null) => void
  usage: ChatUsage
  setSelection: (selection: EditorSelection | null) => void
  send: (text: string, opts: { project: string | null; model: string; effort: ChatEffort; mode: ChatSendRequest['mode']; shown?: string; images?: ChatImage[] }) => void      // `shown`: lo que se ve en la conversación si no es todo el texto
  cancel: () => void
  answer: (id: string, allow: boolean, always?: boolean) => void
  clear: () => void
}

const ZERO: ChatUsage = { cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
let nextTab = 2
const blank = (id: number, project: string | null): ChatTab => ({ id, messages: [], session: null, project, usage: ZERO })
type Live = Pick<ChatState, 'tabs' | 'tab' | 'messages' | 'session' | 'project' | 'usage'>
/** Las pestañas con la activa al día. */
const saved = (s: Live): ChatTab[] => s.tabs.map((t) => (t.id === s.tab ? { ...t, messages: s.messages, session: s.session, project: s.project, usage: s.usage } : t))
/** Pone una pestaña como la activa (permisos y preguntas pendientes son de la anterior y no pasan). */
const show = (tabs: ChatTab[], t: ChatTab): Partial<ChatState> => ({ tabs, tab: t.id, messages: t.messages, session: t.session, project: t.project, usage: t.usage, permissions: [], asks: [] })
let nextId = 1
const add = (messages: ChatMessage[], m: Omit<ChatMessage, 'id'>): ChatMessage[] => [...messages, { ...m, id: nextId++ }]

/** La conversación del chat: vive fuera del panel para no perderse al cerrarlo. */
export const useChat = create<ChatState>((set, get) => ({
  tabs: [blank(1, null)], tab: 1,
  newTab: () => { const s = get(); if (s.running || !s.messages.length) return; const t = blank(nextTab++, s.project); set(show([...saved(s), t], t)) },
  switchTab: (id) => { const s = get(); if (s.running || id === s.tab) return; const tabs = saved(s); const t = tabs.find((x) => x.id === id); if (t) set(show(tabs, t)) },
  closeTab: (id) => {
    const s = get()
    if (s.running && id === s.tab) return
    const tabs = saved(s), at = tabs.findIndex((x) => x.id === id)
    const rest = tabs.filter((x) => x.id !== id)
    if (!rest.length) { const t = blank(nextTab++, s.project); set(show([t], t)); return }
    if (id === s.tab) set(show(rest, rest[Math.min(at, rest.length - 1)]))
    else set({ tabs: rest })
  },
  messages: [], running: false, session: null, project: null, permissions: [], selection: null, asks: [], queued: null,
  queue: (text) => set({ queued: text }),
  load: (session, project, history) => {
    const s = get()
    if (s.running) return
    const messages = history.map((m): ChatMessage => ({ id: nextId++, role: m.role, text: m.text }))
    const opened = s.tabs.find((x) => x.session === session)          // ya abierta: se va a ella
    if (opened && opened.id !== s.tab) { get().switchTab(opened.id); return }
    const into = s.messages.length ? { ...blank(nextTab++, project), messages, session } : { ...blank(s.tab, project), messages, session }          // la pestaña vacía se reutiliza
    set(show(s.messages.length ? [...saved(s), into] : saved(s).map((x) => (x.id === s.tab ? into : x)), into))
  },
  reply: (id, answers) => { set((s) => ({ asks: s.asks.filter((a) => a.id !== id) })); void window.api.chat.reply(id, answers) }, usage: ZERO,
  setSelection: (selection) => set({ selection }),
  send: (text, opts) => {
    const s = get()
    if (s.running || (!text.trim() && !opts.images?.length)) return
    const fresh = s.project !== opts.project          // otro proyecto: otra conversación
    set({ messages: add(fresh ? [] : s.messages, { role: 'user', text: opts.shown ?? text, images: opts.images?.map((i) => `data:${i.mediaType};base64,${i.data}`) }), running: true, project: opts.project, session: fresh ? null : s.session, permissions: [] })
    void window.api.chat.send({ text, project: opts.project, model: opts.model, effort: opts.effort, mode: opts.mode, images: opts.images, session: fresh ? null : s.session })
  },
  cancel: () => { void window.api.chat.cancel() },
  answer: (id, allow, always) => { set((s) => ({ permissions: s.permissions.filter((p) => p.id !== id) })); void window.api.chat.answer(id, allow, always) },
  clear: () => { if (!get().running) set({ messages: [], session: null, permissions: [], asks: [], usage: ZERO }) }
}))

const onEvent = (e: ChatEvent): void => {
  const s = useChat.getState()
  switch (e.kind) {
    case 'session': if (s.session !== e.id) useChat.setState({ session: e.id }); break
    case 'context': {          // se cuelga del último mensaje del usuario
      const i = s.messages.map((m) => m.role).lastIndexOf('user')
      if (i >= 0) useChat.setState({ messages: s.messages.map((m, j) => (j === i ? { ...m, context: e.text } : m)) })
      break
    }
    case 'blockstart': useChat.setState({ messages: add(s.messages, { role: 'assistant', text: '', live: true }) }); break
    case 'delta': {
      const i = s.messages.map((m) => !!m.live).lastIndexOf(true)
      useChat.setState({ messages: i < 0 ? add(s.messages, { role: 'assistant', text: e.text, live: true }) : s.messages.map((m, j) => (j === i ? { ...m, text: m.text + e.text } : m)) })
      break
    }
    case 'text': {          // el bloque ya completo: sustituye al que se iba escribiendo (el primero aún en vivo) o, si no lo hubo, se añade
      const i = s.messages.findIndex((m) => m.live)
      useChat.setState({ messages: i < 0 ? add(s.messages, { role: 'assistant', text: e.text }) : s.messages.map((m, j) => (j === i ? { ...m, text: e.text, live: false } : m)) })
      break
    }
    case 'tool': useChat.setState({ messages: add(s.messages, { role: 'tool', text: e.name, detail: e.input, toolId: e.id, body: e.body, file: e.file }) }); break
    case 'toolResult': useChat.setState({ messages: s.messages.map((m) => (m.toolId === e.id ? { ...m, result: e.text, resultError: e.error } : m)) }); break
    case 'usage': useChat.setState({ usage: { cost: s.usage.cost + e.cost, input: s.usage.input + e.input, output: s.usage.output + e.output, cacheRead: s.usage.cacheRead + e.cacheRead, cacheWrite: s.usage.cacheWrite + e.cacheWrite } }); break
    case 'permission': useChat.setState({ permissions: [...s.permissions, { id: e.id, tool: e.tool, input: e.input }] }); break
    case 'question': useChat.setState({ asks: [...s.asks, { id: e.id, questions: e.questions }] }); break
    case 'error': useChat.setState({ messages: add(s.messages, { role: 'error', text: e.message }) }); break
    case 'done': useChat.setState({ running: false, permissions: [], asks: [], messages: s.messages.filter((m) => !(m.live && !m.text)).map((m) => (m.live ? { ...m, live: false } : m)) }); break
  }
}
if (typeof window !== 'undefined' && window.api?.chat) window.api.chat.onEvent(onEvent)
