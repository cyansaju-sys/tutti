import { create } from 'zustand'
import type { ChatHistoryMessage, ChatEffort, ChatImage, ChatPlanDecision, ChatQuestion, ChatEvent, ChatSendRequest } from '@/shared/types'

export interface ChatMessage { id: number; role: 'user' | 'assistant' | 'tool' | 'thinking' | 'error' | 'note'; text: string; liveThink?: boolean; detail?: string; images?: string[]; live?: boolean; context?: string; toolId?: string; body?: string; file?: string; result?: string; resultError?: boolean; parent?: string; sub?: string; task?: ChatTask }      // images: data URLs para mostrarlas; parent: la herramienta Agent de la que es parte; sub/task: en la herramienta Agent, el rol y su progreso
/** El progreso de un subagente: lo que lleva hecho y la última herramienta que usó. */
export interface ChatTask { status: 'running' | 'completed' | 'failed' | 'stopped'; tools: number; tokens: number; ms: number; last?: string }
/** Lo que está seleccionado en el editor: el chat lo ofrece como contexto. */
export interface EditorSelection { path: string; startLine: number; endLine: number; text: string }
/** Lo gastado en la conversación: coste y tokens (la caché leída es lo que no se vuelve a pagar entero). */
export interface ChatUsage { cost: number; input: number; output: number; cacheRead: number; cacheWrite: number }
export interface ChatAsk { id: string; questions: ChatQuestion[] }
export interface ChatPermission { id: string; tool: string; input: string }
/** El plan que Claude espera que se apruebe. */
export interface ChatPlan { id: string; plan: string }
/** La pregunta al margen (/btw) y su respuesta, que no forma parte de la conversación. */
export interface ChatBtw { id: string; question: string; answer: string; done: boolean; error?: string }

/** Una conversación abierta como pestaña; la activa vive en los campos de arriba y aquí queda su última copia. */
export interface ChatTab { agent: 'claude' | 'codex'; id: number; messages: ChatMessage[]; session: string | null; project: string | null; usage: ChatUsage }

interface ChatState {
  tabs: ChatTab[]
  tab: number              // la pestaña activa
  newTab: (agent?: 'claude' | 'codex') => void
  setAgent: (agent: 'claude' | 'codex') => void      // cambia el agente de la pestaña activa si aún está vacía
  agent: 'claude' | 'codex'              // quién responde en la pestaña activa
  switchTab: (id: number) => void
  closeTab: (id: number) => void
  messages: ChatMessage[]
  running: boolean
  session: string | null
  project: string | null              // el proyecto de la conversación: al cambiar de proyecto empieza una nueva
  permissions: ChatPermission[]
  selection: EditorSelection | null
  asks: ChatAsk[]
  plans: ChatPlan[]
  btw: ChatBtw | null
  suggestion: string | null      // el mensaje que Claude propone como siguiente: se ve de placeholder y Tab lo rellena
  takeSuggestion: () => string | null      // lo devuelve y lo quita
  askBtw: (question: string, opts: { project: string | null; model: string }) => void      // /btw: responde sin tocar la conversación, aunque otra respuesta siga en curso
  closeBtw: () => void
  planReply: (id: string, d: ChatPlanDecision) => void
  queued: string | null              // una petición hecha desde fuera del panel (la pestaña Tutti): el panel la envía con su modelo, esfuerzo y modo
  queuedShown: string | null         // lo que se ve en la conversación de la petición en cola, si no es todo el texto
  queue: (text: string, shown?: string) => void
  note: (text: string) => void      // una línea tenue en la conversación (un aviso, como «Codex ya terminó»)
  load: (session: string, project: string | null, history: ChatHistoryMessage[]) => void      // retoma una conversación guardada: la muestra y los próximos mensajes la continúan
  reply: (id: string, answers: Record<string, string> | null) => void
  usage: ChatUsage
  setSelection: (selection: EditorSelection | null) => void
  send: (text: string, opts: { project: string | null; model: string; effort: ChatEffort; mode: ChatSendRequest['mode']; thinking?: boolean; shown?: string; images?: ChatImage[] }) => void      // `shown`: lo que se ve en la conversación si no es todo el texto (con '' no se ve el mensaje: solo la respuesta)
  cancel: () => void
  answer: (id: string, allow: boolean, always?: boolean) => void
  clear: () => void
}

const ZERO: ChatUsage = { cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
let nextTab = 2
const blank = (id: number, project: string | null, agent: 'claude' | 'codex' = 'claude'): ChatTab => ({ agent, id, messages: [], session: null, project, usage: ZERO })
type Live = Pick<ChatState, 'agent' | 'tabs' | 'tab' | 'messages' | 'session' | 'project' | 'usage'>
/** Las pestañas con la activa al día. */
const saved = (s: Live): ChatTab[] => s.tabs.map((t) => (t.id === s.tab ? { ...t, agent: s.agent, messages: s.messages, session: s.session, project: s.project, usage: s.usage } : t))
/** Pone una pestaña como la activa (permisos y preguntas pendientes son de la anterior y no pasan). */
const show = (tabs: ChatTab[], t: ChatTab): Partial<ChatState> => ({ tabs, tab: t.id, agent: t.agent, messages: t.messages, session: t.session, project: t.project, usage: t.usage, permissions: [], asks: [], plans: [], btw: null, suggestion: null })
let nextId = 1
const add = (messages: ChatMessage[], m: Omit<ChatMessage, 'id'>): ChatMessage[] => [...messages, { ...m, id: nextId++ }]

/** La conversación del chat: vive fuera del panel para no perderse al cerrarlo. */
/** Un chat con sus pestañas. Hay dos, uno por columna cuando el chat se parte en 2 (`slot`): cada uno tiene su conversación y sus respuestas en curso. */
const createChat = (slot: number) => create<ChatState>((set, get) => ({
  tabs: [blank(1, null)], tab: 1, agent: 'claude',
  setAgent: (agent) => { const s = get(); if (!s.running && !s.messages.length) set({ agent, session: null }) },
  newTab: (agent = 'claude') => { const s = get(); if (s.running) return; const t = blank(nextTab++, s.project, agent); set(show([...saved(s), t], t)) },
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
  messages: [], running: false, session: null, project: null, permissions: [], selection: null, asks: [], plans: [], btw: null, suggestion: null, queued: null, queuedShown: null,
  queue: (text, shown) => set({ queued: text, queuedShown: shown ?? null }),
  note: (text) => set((s) => ({ messages: add(s.messages, { role: 'note', text }) })),
  load: (session, project, history) => {
    const s = get()
    if (s.running) return
    const messages = history.map((m): ChatMessage => ({ ...m, id: nextId++ }))
    const opened = s.tabs.find((x) => x.session === session)          // ya abierta: se va a ella
    if (opened && opened.id !== s.tab) { get().switchTab(opened.id); return }
    const into = s.messages.length ? { ...blank(nextTab++, project), messages, session } : { ...blank(s.tab, project), messages, session }          // la pestaña vacía se reutiliza
    set(show(s.messages.length ? [...saved(s), into] : saved(s).map((x) => (x.id === s.tab ? into : x)), into))
  },
  reply: (id, answers) => { set((s) => ({ asks: s.asks.filter((a) => a.id !== id) })); void window.api.chat.reply(id, answers, slot) }, usage: ZERO,
  setSelection: (selection) => set({ selection }),
  send: (text, opts) => {
    const s = get()
    if (s.running || (!text.trim() && !opts.images?.length)) return
    const fresh = s.project !== opts.project          // otro proyecto: otra conversación
    set({ messages: opts.shown === '' ? (fresh ? [] : s.messages) : add(fresh ? [] : s.messages, { role: 'user', text: opts.shown ?? text, images: opts.images?.map((i) => `data:${i.mediaType};base64,${i.data}`) }), running: true, project: opts.project, session: fresh ? null : s.session, permissions: [], suggestion: null })
    void window.api.chat.send({ text, project: opts.project, model: opts.model, effort: opts.effort, mode: opts.mode, thinking: opts.thinking, images: opts.images, agent: s.agent, slot, session: fresh ? null : s.session })
  },
  askBtw: (question, opts) => {
    const q = question.trim()
    if (!q) return
    const prev = get().btw
    if (prev && !prev.done) void window.api.chat.btwCancel(prev.id)          // una a la vez: la nueva sustituye a la anterior
    const id = `b${nextId++}`
    set({ btw: { id, question: q, answer: '', done: false } })
    void window.api.chat.btw({ slot, id, question: q, project: opts.project, session: get().session, model: opts.model })
  },
  closeBtw: () => { const b = get().btw; if (b && !b.done) void window.api.chat.btwCancel(b.id); set({ btw: null }) },
  planReply: (id, d) => { set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })); void window.api.chat.planReply(id, d, slot) },
  takeSuggestion: () => { const text = get().suggestion; if (text) set({ suggestion: null }); return text },
  cancel: () => { void window.api.chat.cancel(slot) },
  answer: (id, allow, always) => { set((s) => ({ permissions: s.permissions.filter((p) => p.id !== id) })); void window.api.chat.answer(id, allow, always, slot) },
  clear: () => { if (!get().running) set({ messages: [], session: null, permissions: [], asks: [], usage: ZERO, suggestion: null }) }
}))
export const useChat = createChat(0)
export const useChat2 = createChat(1)
const stores = [useChat, useChat2]


const onEvent = (ev: ChatEvent & { slot?: number }): void => {
  const e: ChatEvent = ev
  const store = stores[ev.slot ?? 0] ?? useChat          // el evento dice a qué chat va (sin `slot`, al primero)
  const s = store.getState()
  switch (e.kind) {
    case 'session': if (s.session !== e.id) store.setState({ session: e.id }); break
    case 'context': {          // se cuelga del último mensaje del usuario
      const i = s.messages.map((m) => m.role).lastIndexOf('user')
      if (i >= 0) store.setState({ messages: s.messages.map((m, j) => (j === i ? { ...m, context: e.text } : m)) })
      break
    }
    case 'blockstart': store.setState({ messages: add(s.messages, e.think ? { role: 'thinking', text: '', liveThink: true } : { role: 'assistant', text: '', live: true }) }); break
    case 'delta': {
      if (e.think) {          // el razonamiento que se va escribiendo
        const k = s.messages.map((m) => !!m.liveThink).lastIndexOf(true)
        store.setState({ messages: k < 0 ? add(s.messages, { role: 'thinking', text: e.text, liveThink: true }) : s.messages.map((m, j) => (j === k ? { ...m, text: m.text + e.text } : m)) })
        break
      }
      const i = s.messages.map((m) => !!m.live).lastIndexOf(true)
      store.setState({ messages: i < 0 ? add(s.messages, { role: 'assistant', text: e.text, live: true }) : s.messages.map((m, j) => (j === i ? { ...m, text: m.text + e.text } : m)) })
      break
    }
    case 'text': {          // el bloque ya completo: sustituye al que se iba escribiendo (el primero aún en vivo) o, si no lo hubo, se añade
      if (e.parent) { store.setState({ messages: add(s.messages, { role: 'assistant', text: e.text, parent: e.parent }) }); break }          // lo de un subagente va dentro de su bloque
      const i = s.messages.findIndex((m) => m.live)
      store.setState({ messages: i < 0 ? add(s.messages, { role: 'assistant', text: e.text }) : s.messages.map((m, j) => (j === i ? { ...m, text: e.text, live: false } : m)) })
      break
    }
    case 'thinking': {          // el razonamiento completo: sustituye al que se iba escribiendo o, si no lo hubo (o es de un subagente), se añade
      const k = e.parent ? -1 : s.messages.findIndex((m) => m.liveThink)
      store.setState({ messages: k < 0 ? add(s.messages, { role: 'thinking', text: e.text, parent: e.parent }) : s.messages.map((m, j) => (j === k ? { ...m, text: e.text, liveThink: false } : m)) })
      break
    }
    case 'suggestion': store.setState({ suggestion: e.text }); break
    case 'plan': store.setState({ plans: [...s.plans, { id: e.id, plan: e.plan }] }); break
    case 'btw': {
      const b = s.btw
      if (!b || b.id !== e.id) break
      store.setState({ btw: { ...b, answer: b.answer + (e.text ?? ''), done: b.done || !!e.done, error: e.error ?? b.error } })
      break
    }
    case 'tool': store.setState({ messages: add(s.messages, { role: 'tool', text: e.name, detail: e.input, toolId: e.id, body: e.body, file: e.file, parent: e.parent, sub: e.sub }) }); break
    case 'task': store.setState({ messages: s.messages.map((m) => (m.toolId === e.id ? { ...m, task: { status: e.status, tools: e.tools ?? m.task?.tools ?? 0, tokens: e.tokens ?? m.task?.tokens ?? 0, ms: e.ms ?? m.task?.ms ?? 0, last: e.last ?? m.task?.last } } : m)) }); break
    case 'toolResult': store.setState({ messages: s.messages.map((m) => (m.toolId === e.id ? { ...m, result: e.text, resultError: e.error } : m)) }); break
    case 'usage': store.setState({ usage: { cost: s.usage.cost + e.cost, input: s.usage.input + e.input, output: s.usage.output + e.output, cacheRead: s.usage.cacheRead + e.cacheRead, cacheWrite: s.usage.cacheWrite + e.cacheWrite } }); break
    case 'permission': store.setState({ permissions: [...s.permissions, { id: e.id, tool: e.tool, input: e.input }] }); break
    case 'question': store.setState({ asks: [...s.asks, { id: e.id, questions: e.questions }] }); break
    case 'error': store.setState({ messages: add(s.messages, { role: 'error', text: e.message }) }); break
    case 'done': store.setState({ running: false, permissions: [], asks: [], plans: [], messages: s.messages.filter((m) => !(m.live && !m.text) && !(m.liveThink && !m.text)).map((m) => (m.liveThink ? { ...m, liveThink: false } : m)).map((m) => (m.live ? { ...m, live: false } : m)).map((m) => (m.task?.status === 'running' ? { ...m, task: { ...m.task, status: 'stopped' as const } } : m)) }); break
  }
}
if (typeof window !== 'undefined' && window.api?.chat) window.api.chat.onEvent(onEvent)

/** Los subagentes (roles) que ahora mismo están trabajando en el chat: los de una herramienta Agent aún sin terminar. */
export const workingSubagents = (messages: ChatMessage[], running: boolean): Set<string> => new Set(
  running ? messages.filter((m) => m.role === 'tool' && m.sub && (m.text === 'Agent' || m.text === 'Task') && (m.task ? m.task.status === 'running' : m.result === undefined)).map((m) => m.sub!) : []
)
