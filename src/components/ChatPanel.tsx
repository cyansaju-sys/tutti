import { selectionMessage, selectionRef } from '@/features/files/lib/selectionRef'
import { FileIcon } from '@/components/FileIcon'
import { listProjectFiles } from '@/lib/projectFiles'
import { basename, relative, toPosix } from '@/lib/paths'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MdAdd, MdArrowUpward, MdChatBubbleOutline, MdCheckCircleOutline, MdChevronRight, MdClose, MdCode, MdExpandMore, MdOutlineBuild, MdOutlineDescription, MdOutlineSchedule, MdLanguage, MdOutlineFileUpload, MdStop, MdTerminal, MdVerticalSplit } from 'react-icons/md'
import { useT } from '@/lib/i18n'
import { useStore } from '@/store'
import { useChat, useChat2 } from '@/store/chat'
import { Markdown } from '@/features/files/components/Markdown'
import type { ChatCommand, ChatEffort, ChatImage, ChatModel, ChatProjectItems } from '@/shared/types'
import { CommandPicker, GROUPS, type Group, type Trigger } from './CommandPicker'
import { effortLabel, ModelPicker } from './ModelPicker'
import { ModePicker, MODES, type ChatMode } from './ModePicker'
import { ChatQuestions } from './ChatQuestion'
import { ChatSubagent, isSubagentTool } from './ChatSubagent'
import { ChatThinking } from './ChatThinking'
import { ChatPlanCard } from './ChatPlan'
import { ChatBtwCard } from './ChatBtw'
import { IconButton } from './ui'
import { Menu } from './Menu'

/** Las dos formas de empezar: charlar y construir (Vibe) o planificar antes de construir (Spec, el modo plan). */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

const FLOWS: Array<{ id: 'vibe' | 'spec'; icon: ReactNode; mode: ChatMode }> = [
  { id: 'vibe', icon: <MdChatBubbleOutline size={15} />, mode: 'auto' },
  { id: 'spec', icon: <MdOutlineDescription size={15} />, mode: 'plan' }
]

/** Panel de chat con Claude (SDK): va al lado opuesto de la barra lateral. */
export function ChatPanel({ fill = false, slot = 0 }: { fill?: boolean; slot?: 0 | 1 }) {
  const t = useT()
  const set = useStore((s) => s.set)
  const width = useStore((s) => s.chatWidth)
  const store = slot === 1 ? useChat2 : useChat          // con el chat partido, cada columna lleva su conversación
  const chat = store()
  const split = useStore((s) => s.chatSplit)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }) }, [chat.messages, chat.permissions, chat.asks, chat.plans, chat.btw])
  const [text, setText] = useState('')
  const [models, setModels] = useState<ChatModel[] | null>(null)
  const [model, setModel] = useState('default')
  const [effort, setEffort] = useState<ChatEffort>('medium')
  const [mode, setMode] = useState<ChatMode>('auto')
  const [modes, setModes] = useState<DOMRect | null>(null)
  const [attachMenu, setAttachMenu] = useState<DOMRect | null>(null)          // el «+» del compositor: subir imágenes, añadir contexto, buscar en la web
  const [plus, setPlus] = useState<DOMRect | null>(null)          // el menú del «+»: otra conversación de Claude o Claude Code en una terminal
  const [picker, setPicker] = useState<DOMRect | null>(null)
  const composer = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const project = useStore((s) => s.project)
  const [commands, setCommands] = useState<ChatCommand[] | null>(null)
  const [dismissed, setDismissed] = useState('')          // la selección que se quitó con la X (para no volver a ofrecerla hasta que cambie)
  const selKey = chat.selection ? `${chat.selection.path}:${chat.selection.startLine}-${chat.selection.endLine}:${chat.selection.text.length}` : ''
  const hideSel = !selKey || dismissed === selKey
  const activePath = useStore((s) => { const d = s.docs.find((x) => x.path === s.activeDoc); return d?.kind === 'text' ? d.path : null })      // el archivo abierto en el editor
  const file = hideSel && activePath && dismissed !== activePath ? activePath : null          // sin selección, se ofrece el archivo entero
  const [images, setImages] = useState<ChatImage[]>([])          // las imágenes adjuntas al mensaje
  const fileInput = useRef<HTMLInputElement>(null)
  /** Adjunta imágenes (pegadas, soltadas o elegidas): hasta 5, de hasta 5 MB y de los tipos que acepta el modelo. */
  const attach = async (list: File[]): Promise<void> => {
    const ok = list.filter((f) => IMAGE_TYPES.includes(f.type) && f.size <= 5 * 1024 * 1024)
    if (ok.length < list.filter((f) => f.type.startsWith('image/')).length) useStore.getState().toast(t('chat.imageRejected'), 'error')
    const read = await Promise.all(ok.map((f) => new Promise<ChatImage>((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve({ mediaType: f.type as ChatImage['mediaType'], data: String(r.result).split(',')[1] ?? '' })
      r.readAsDataURL(f)
    })))
    setImages((prev) => [...prev, ...read].slice(0, 5))
  }
  const [openTools, setOpenTools] = useState<Set<number>>(new Set())          // las herramientas abiertas para ver su detalle
  // el campo crece con el texto hasta un tope (140 px) y entonces hace scroll
  useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [text])
  const marks = useRef<HTMLDivElement>(null)          // el fondo del input, donde se resaltan las menciones
  const [files, setFiles] = useState<string[] | null>(null)          // los archivos del proyecto, relativos, para «@»
  const [items, setItems] = useState<ChatProjectItems | null>(null)
  const [slash, setSlash] = useState<DOMRect | null>(null)
  const [trigger, setTrigger] = useState<Trigger>('/')          // «/» comandos del SDK, «#» lo que tiene Tutti en el proyecto
  const [group, setGroup] = useState<Group | null>(null)          // grupo con el que se abre la lista (al enviar «/skills», por ejemplo)

  /** Abre la lista (los comandos se piden al SDK y lo de Tutti al proyecto; ambos dependen del proyecto abierto). */
  const openCommands = (initial: Group | null = null, kind: Trigger = '/'): void => {
    setPicker(null)
    setTrigger(kind)
    setGroup(initial)
    setSlash(composer.current?.getBoundingClientRect() ?? null)
    if (kind === '@' || kind === '#') {
      if (project) void listProjectFiles(project, true).then((all) => setFiles(all.map((f) => toPosix(relative(project, f.replace(/\/$/, ''))) + (f.endsWith('/') ? '/' : '')))).catch(() => setFiles([]))
      else setFiles([])
      if (kind === '@') return
    }
    window.api.chat.commands(project ?? undefined, chat.agent).then(setCommands).catch(() => setCommands([]))
    window.api.chat.items(project, chat.agent).then((list) => {
      setItems(list)
      if (kind === '/') window.api.chat.mcpStatus(project, chat.agent).then((st) => setItems((cur) => cur && { ...cur, mcp: cur.mcp.map((i) => ({ ...i, status: st[i.name] ?? i.status })) })).catch(() => undefined)      // el estado de cada MCP llega después, del SDK
    }).catch(() => setItems({ skills: [], hooks: [], mcp: [], roles: [], steering: [], powers: [], specs: [], roadmap: [], docs: [], changes: [] }))
  }
  /** Al escribir «/» o «#» (sin espacio todavía) se abre la lista y se va filtrando con lo escrito; al pasar de ahí, se cierra. */
  const onType = (value: string): void => {
    setText(value)
    const mention = /(?:^|\s)@(\S*)$/.test(value)          // «@» en cualquier parte del texto: menciona un archivo
    if (mention) { if (!slash || trigger !== '@') openCommands(null, '@'); return }
    if (slash && trigger === '@') setSlash(null)
    const kind = value[0] === '/' || value[0] === '#' || value[0] === '@' ? (value[0] as Trigger) : null
    const typing = kind !== null && !/\s/.test(value)
    if (typing && (!slash || kind !== trigger)) openCommands(null, kind)
    else if (!typing && slash) setSlash(null)
  }
  /** Enviar: «/skills», «#roles»… muestran su lista en lugar de enviarse. */
  const submit = (): void => {
    const kind = text.trim()[0] as Trigger
    const word = text.trim().slice(1).toLowerCase()
    if ((kind === '/' || kind === '#') && (GROUPS[kind] as string[]).includes(word)) { setText(''); openCommands(word as Group, kind); return }
    if (slash && trigger === '@' && /(?:^|\s)@\S*$/.test(text)) return      // con la lista de archivos abierta, Enter no envía
    if ((kind === '#' || text.trim() === '/') && !/\s/.test(text.trim())) { if (!slash) openCommands(null, kind); return }      // «#algo» suelto o «/» no se envían: son para elegir de la lista
    const aside = /^\/btw(?:\s+([\s\S]*))?$/i.exec(text.trim())          // «/btw pregunta»: una nota al margen, se puede hacer aunque Claude esté respondiendo
    if (aside) { setSlash(null); if (aside[1]?.trim()) { chat.askBtw(aside[1], { project, model: current?.value ?? model }); setText('') } return }
    const auth = /^\/(login|logout)$/.exec(text.trim())          // el inicio y cierre de sesión van en una terminal (el primero es interactivo)
    if (auth) { setText(''); setSlash(null); void useStore.getState().openAgent({ name: 'Claude Code', command: 'claude' }, ['auth', auth[1]], { cwd: project ?? undefined, title: `Claude Code · ${auth[1]}` }); return }
    if (text.trim() === '/clear') { setText(''); setSlash(null); chat.clear(); return }
    if (text.trim() === '/new') { setText(''); setSlash(null); chat.newTab(chat.agent); return }          // «/new» de Codex: otra conversación
    if ((!text.trim() && !images.length) || chat.running) return
    setSlash(null)
    const fileRef = file && project ? `@${toPosix(relative(project, file))}\n` : ''
    const sel = chat.selection && project && !hideSel ? chat.selection : null
    const body = sel ? selectionMessage('claude', toPosix(relative(project!, sel.path)), sel.startLine, sel.endLine, sel.text) + text.trim() : fileRef + text.trim()
    chat.send(body, { project, model: current?.value ?? model, effort, mode, thinking: current?.thinking, images: images.length ? images : undefined, shown: sel ? `${selectionRef('claude', toPosix(relative(project!, sel.path)), sel.startLine, sel.endLine)}\n${text.trim()}` : fileRef ? fileRef + text.trim() : undefined })
    setText(''); setImages([])
  }
  const pick = (value: string): void => {
    if (trigger === '@' && value[0] === '@') { setText(text.replace(/@\S*$/, value)); setSlash(null); input.current?.focus(); return }
    const kind = value[0] as Trigger, word = value.slice(1)
    if ((kind === '/' || kind === '#') && (GROUPS[kind] as string[]).includes(word)) { setText(''); openCommands(word as Group, kind); return }      // un grupo elegido en la búsqueda: se abre
    setText(value); setSlash(null); input.current?.focus()
  }
  const current = models?.find((m) => m.value === model) ?? models?.[0]

  // lo que se le pide desde la pestaña Tutti se envía aquí, con el modelo, el esfuerzo y el modo elegidos; si está respondiendo, espera su turno
  useEffect(() => {
    if (!chat.queued || chat.running || !project) return
    chat.send(chat.queued, { project, model: current?.value ?? model, effort, mode, thinking: current?.thinking, shown: chat.queuedShown ?? undefined })
    store.setState({ queued: null, queuedShown: null })
  }, [chat.queued, chat.running, project])      // eslint-disable-line react-hooks/exhaustive-deps

  // los modelos se piden al abrir el panel: la pastilla ya muestra el actual
  useEffect(() => {
    setModels(null); setModel('default')
    window.api.chat.models(chat.agent).then(setModels).catch(() => undefined)
    // el modelo y el esfuerzo que se eligieron la última vez con este agente (cada uno guarda los suyos)
    window.api.settings.get(`chat.model.${chat.agent}`).then((v) => { if (typeof v === 'string') setModel(v) }).catch(() => undefined)
    window.api.settings.get(`chat.effort.${chat.agent}`).then((v) => { if (typeof v === 'string') setEffort(v as ChatEffort) }).catch(() => undefined)
  }, [chat.agent])          // los modelos de la cuenta del agente de la pestaña

  return (
    <aside data-chat-slot={slot} style={fill ? undefined : { width }} className={`flex flex-col overflow-hidden rounded-lg border border-line bg-panel ${fill ? 'min-w-0 flex-1' : 'shrink-0'}`}>
      <div className="flex h-[28px] shrink-0 items-center bg-bg pr-1">
      {(
        <div className="flex min-w-0 flex-1 items-stretch justify-start gap-0 self-stretch overflow-x-auto [scrollbar-width:none]">
          {chat.tabs.map((x) => {
            const active = x.id === chat.tab
            const first = (active ? chat.messages : x.messages).find((m) => m.role === 'user')?.text.trim().replace(/\s+/g, ' ')
            const agent = active ? chat.agent : x.agent
            const busy = active && chat.running          // respondiendo ahora mismo
            return (
              <div key={x.id} title={first || undefined} onAuxClick={(e) => { if (e.button === 1 && !(chat.running && active)) { e.preventDefault(); chat.closeTab(x.id) } }} className={`group relative flex h-full max-w-[150px] shrink-0 items-center gap-1 rounded-none border-x pl-2 pr-1 text-[11px] transition-colors ${active ? 'border-line bg-panel text-text' : 'border-transparent text-muted hover:text-text'}`}>
                {agent === 'codex' ? <MdCode size={12} className={`shrink-0 ${active ? 'text-accent' : ''} ${busy ? 'animate-pulse' : ''}`} /> : <MdChatBubbleOutline size={11} className={`shrink-0 ${active ? 'text-accent' : ''} ${busy ? 'animate-pulse' : ''}`} />}<button disabled={chat.running && !active} onClick={() => chat.switchTab(x.id)} className="min-w-0 truncate text-left disabled:opacity-50">{first || t('chat.newChat')}</button>
                <button disabled={chat.running && active} title={t('chat.closeTab')} onClick={() => chat.closeTab(x.id)} className={`grid size-3.5 shrink-0 place-items-center rounded text-muted transition-opacity hover:bg-ov/10 hover:text-text disabled:opacity-40 ${active ? '' : 'opacity-0 group-hover:opacity-100'}`}><MdClose size={10} /></button>
              </div>
            )
          })}
        </div>
      )}
        <div className="ml-auto flex shrink-0 items-center">
          <IconButton title={t('chat.newChat')} onClick={(e) => setPlus(e.currentTarget.getBoundingClientRect())}><MdAdd size={16} /></IconButton>
          {slot === 0 && <IconButton title={t(split ? 'chat.unsplit' : 'chat.split')} onClick={() => {
            if (!split) useChat2.getState().setAgent(chat.agent === 'claude' ? 'codex' : 'claude')          // la segunda columna empieza con el otro agente
            set({ chatSplit: !split })
          }}><MdVerticalSplit size={15} className={split ? 'text-accent' : ''} /></IconButton>}
          <IconButton title={t('chat.close')} onClick={() => (slot === 1 ? set({ chatSplit: false }) : set({ chatOpen: false }))}><MdClose size={15} /></IconButton>
        </div>
      </div>
      <div ref={list} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden break-words px-4 py-3 [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_table]:block">
        {chat.messages.length === 0 && (
          <div className={`m-auto flex w-full flex-col items-center gap-3 ${fill ? 'max-w-[760px]' : ''}`}>
            <div className="text-center">
              <div className="text-[20px] font-semibold text-accent">{t('chat.buildTitle')}</div>
              <div className="text-[11px] text-muted">{t('chat.buildSub')}</div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              {FLOWS.map((f) => {
                const on = (f.id === 'spec') === (mode === 'plan')          // Spec = planificar primero; Vibe = cualquier otro modo
                return (
                  <button key={f.id} onClick={() => { setMode(f.mode); input.current?.focus() }}
                    className={`no-drag flex flex-col items-start gap-1.5 rounded-lg border p-2.5 text-left transition-colors ${on ? 'border-accent/60 bg-accent-bg' : 'border-line hover:bg-accent-bg/50'}`}>
                    <span className={`flex items-center gap-1.5 text-[12px] font-medium ${on ? 'text-accent' : 'text-text'}`}>{f.icon}{t(`chat.${f.id}` as never)}</span>
                    <span className="text-[10.5px] leading-snug text-muted">{t(`chat.${f.id}D` as never)}</span>
                  </button>
                )
              })}
            </div>
            <div className="w-full px-1 text-[11px] text-text/90">
              <div className="mb-1">{t('chat.great')}</div>
              <ul className="list-disc space-y-0.5 pl-4 text-muted">
                {[1, 2, 3].map((n) => <li key={n}>{t(`chat.${mode === 'plan' ? 'spec' : 'vibe'}${n}` as never)}</li>)}
              </ul>
            </div>
          </div>
        )}
        {chat.messages.filter((m) => !m.parent).map((m) => isSubagentTool(m) ? <ChatSubagent key={m.id} m={m} all={chat.messages} live={chat.running} /> : m.role === 'thinking' ? <ChatThinking key={m.id} text={m.text} live={m.liveThink} /> : m.role === 'user' ? (
          <div key={m.id} className="min-w-0 max-w-full self-stretch whitespace-pre-wrap rounded-xl border border-line bg-line/25 px-3 py-2 text-[12px] text-text [overflow-wrap:anywhere]">
            {m.images && <div className="mb-1 flex flex-wrap gap-1">{m.images.map((src, i) => <img key={i} src={src} alt="" className="max-h-24 max-w-full rounded-md" />)}</div>}{(() => {
              const ref = /^@(\S+?)(:\d+(?:-\d+)?)?\n([\s\S]*)$/.exec(m.text)          // el archivo (o las líneas) que se mandó con el mensaje: va como una pastilla encima del texto
              return ref ? <><span className="mb-1.5 flex w-fit max-w-full items-center gap-1.5 text-[12px] text-text" title={ref[1] + (ref[2] ?? '')}><FileIcon name={basename(ref[1])} /><span className="truncate">{basename(ref[1])}</span>{ref[2] && <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-accent/30 px-1 text-[10px] leading-none">{(() => { const [a, b] = ref[2].slice(1).split('-').map(Number); return (b ?? a) - a + 1 })()}</span>}</span>{ref[3]}</> : m.text
            })()}
            {m.context && (
              <div className="mt-1.5 border-t border-line/60 pt-1 text-[10.5px] text-muted">
                <button onClick={() => setOpenTools((s) => { const n = new Set(s); if (!n.delete(m.id)) n.add(m.id); return n })} aria-expanded={openTools.has(m.id)} className="no-drag flex items-center gap-1 hover:text-text">
                  {openTools.has(m.id) ? <MdExpandMore size={13} /> : <MdChevronRight size={13} />}{t('chat.sentContext')}
                </button>
                {openTools.has(m.id) && <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-panel/70 px-2 py-1.5 font-mono text-[10.5px] leading-snug">{m.context.split('\n').map((l, i) => <span key={i} className={`block ${l.startsWith('+') && !l.startsWith('+++') ? 'text-accent' : l.startsWith('-') && !l.startsWith('---') ? 'text-danger' : ''}`}>{l || ' '}</span>)}</pre>}
              </div>
            )}
          </div>
        ) : m.role === 'tool' ? (
          <div key={m.id} className="min-w-0 text-[11px] text-muted">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setOpenTools((s) => { const n = new Set(s); if (!n.delete(m.id)) n.add(m.id); return n })} aria-expanded={openTools.has(m.id)} className="no-drag flex shrink-0 items-center gap-1.5 hover:text-text">
                {openTools.has(m.id) ? <MdExpandMore size={13} /> : <MdChevronRight size={13} />}<MdOutlineBuild size={12} /><span className="font-medium">{m.text}</span>
              </button>
              {m.file ? <button onClick={() => void useStore.getState().openDoc(m.file!)} title={m.file} className="no-drag min-w-0 truncate text-left hover:text-accent hover:underline">{m.detail}</button> : <span className="truncate">{m.detail}</span>}
              {m.resultError && <span className="shrink-0 text-danger">!</span>}
            </div>
            {openTools.has(m.id) && (
              <div className="mt-1 flex flex-col gap-1">
                {m.body && <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-line/25 px-2 py-1.5 font-mono text-[10.5px] leading-snug">{m.body.split('\n').map((l, i) => <span key={i} className={`block ${l.startsWith('+ ') ? 'text-accent' : l.startsWith('- ') ? 'text-danger' : ''}`}>{l}</span>)}</pre>}
                {m.result && <pre className={`max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-line/25 px-2 py-1.5 font-mono text-[10.5px] leading-snug ${m.resultError ? 'text-danger' : ''}`}>{m.result}</pre>}
              </div>
            )}
          </div>
        ) : m.role === 'note' ? (
          <div key={m.id} className="flex items-center gap-1.5 text-[11px] text-muted"><MdCheckCircleOutline size={13} className="shrink-0 text-accent" />{m.text}</div>
        ) : m.role === 'error' ? (
          <div key={m.id} className="whitespace-pre-wrap break-words border-l-2 border-danger/60 py-0.5 pl-3 text-[11.5px] text-danger">{m.text}</div>
        ) : <div key={m.id} className="min-w-0"><Markdown text={m.text} /></div>)}
        {chat.asks.map((a) => <ChatQuestions key={a.id} ask={a} onReply={(answers) => chat.reply(a.id, answers)} />)}
        {chat.permissions.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-line bg-line/20 px-3 py-2.5">
            <div className="text-[12px] text-text">{t('chat.wantsTool', { tool: p.tool })}</div>
            {p.input && <div className="truncate font-mono text-[11px] text-muted">{p.input}</div>}
            <div className="flex gap-1.5">
              <button onClick={() => chat.answer(p.id, true)} className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-bg hover:brightness-110">{t('chat.allow')}</button>
              <button onClick={() => chat.answer(p.id, true, true)} title={t('chat.allowAlwaysTip')} className="rounded-md border border-accent/50 px-2.5 py-1 text-[11px] text-accent hover:bg-accent-bg">{t('chat.allowAlways')}</button>
              <button onClick={() => chat.answer(p.id, false)} className="rounded-md border border-line px-2.5 py-1 text-[11px] text-muted hover:text-text">{t('chat.deny')}</button>
            </div>
          </div>
        ))}
        {chat.plans.map((p) => <ChatPlanCard key={p.id} plan={p.plan} onDecide={(d) => chat.planReply(p.id, d)} />)}
        {chat.btw && <ChatBtwCard btw={chat.btw} onClose={chat.closeBtw} />}
        {chat.running && chat.permissions.length === 0 && chat.asks.length === 0 && chat.plans.length === 0 && <div className="text-[11px] text-muted">{t('chat.thinking')}</div>}
      </div>
      <div className={`mx-auto w-full shrink-0 p-2 ${fill ? 'max-w-[760px]' : ''}`}>
        <div ref={composer} onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }} onDrop={(e) => { const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')); if (files.length) { e.preventDefault(); void attach(files) } }}
          className="flex flex-col overflow-hidden rounded-xl border border-accent/40 bg-panel transition-colors focus-within:border-accent/60">
          <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden onChange={(e) => { void attach([...(e.target.files ?? [])]); e.target.value = '' }} />
          {images.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2">
              {images.map((img, i) => (
                <div key={i} className="group relative">
                  <img src={`data:${img.mediaType};base64,${img.data}`} alt="" className="size-12 rounded-md border border-line object-cover" />
                  <button title={t('chat.dropSelection')} onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} className="no-drag absolute -right-1 -top-1 hidden size-4 place-items-center rounded-full bg-panel text-text shadow group-hover:grid"><MdClose size={11} /></button>
                </div>
              ))}
            </div>
          )}
          {!hideSel && chat.selection && (
            <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[11px] text-muted">
              <FileIcon name={basename(chat.selection.path)} />
              <span className="min-w-0 truncate" title={`${basename(chat.selection.path)}:${chat.selection.startLine}-${chat.selection.endLine}`}>{t('chat.linesSelected', { n: String(chat.selection.endLine - chat.selection.startLine + 1) })}</span>
              <button title={t('chat.dropSelection')} onClick={() => setDismissed(selKey)} className="no-drag grid size-4 shrink-0 place-items-center hover:text-text"><MdClose size={13} /></button>
            </div>
          )}
          {file && (
            <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[11px] text-muted">
              <FileIcon name={basename(file)} />
              <span className="min-w-0 truncate" title={toPosix(project ? relative(project, file) : file)}>{basename(file)}</span>
              <button title={t('chat.dropSelection')} onClick={() => setDismissed(file)} className="no-drag grid size-4 shrink-0 place-items-center hover:text-text"><MdClose size={13} /></button>
            </div>
          )}
          <div className="relative">
            <div ref={marks} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 pb-2 pt-2.5 text-[12px] leading-[1.35] text-transparent [scrollbar-gutter:stable]">{mentions(text)}</div>
          <textarea ref={input} rows={1} onPaste={(e) => { const files = [...e.clipboardData.items].filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i) => i.getAsFile()).filter((f): f is File => !!f); if (files.length) { e.preventDefault(); void attach(files) } }} onScroll={(e) => { if (marks.current) marks.current.scrollTop = e.currentTarget.scrollTop }} value={text} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } else if (e.key === 'Tab' && !e.shiftKey && !text && chat.suggestion) { e.preventDefault(); const s = chat.takeSuggestion(); if (s) onType(s) } else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); setMode(MODES[(MODES.findIndex((m) => m.id === mode) + 1) % MODES.length].id) } }} placeholder={chat.suggestion ? `${chat.suggestion}   ⇥ Tab` : t('chat.placeholder')}
            className="relative block max-h-[140px] w-full resize-none bg-transparent px-3 pb-2 pt-2.5 text-[12px] leading-[1.35] text-text outline-none [scrollbar-gutter:stable] placeholder:text-muted" />
          </div>
          <div className="flex items-center py-1 pl-0.5 pr-1">
            <button title={t('chat.attach')} onClick={(e) => setAttachMenu(e.currentTarget.getBoundingClientRect())} className="no-drag grid size-[22px] place-items-center text-muted"><MdAdd size={17} /></button>
            <button title={t('chat.commands')} onClick={() => (slash ? setSlash(null) : openCommands())} className="no-drag grid size-[22px] place-items-center text-muted"><span className="text-[15px] font-medium leading-none">/</span></button>
            <span title={chat.usage.cost > 0 || (chat.agent === 'codex' && chat.usage.input + chat.usage.output > 0) ? t('chat.usageTip', { input: String(chat.usage.input), output: String(chat.usage.output), cache: String(Math.round((chat.usage.cacheRead / Math.max(1, chat.usage.cacheRead + chat.usage.cacheWrite + chat.usage.input)) * 100)) }) : t('chat.cacheTip')} className="no-drag ml-1 flex h-[22px] cursor-default items-center gap-1 px-1.5 text-[11px] text-muted"><MdOutlineSchedule size={14} />{chat.agent === 'codex' ? tokens(chat.usage.input + chat.usage.output) : chat.usage.cost > 0 ? `$${chat.usage.cost.toFixed(chat.usage.cost < 0.1 ? 3 : 2)}` : '60m'}</span>
            <button title={t('chat.mode')} onClick={() => { setSlash(null); setPicker((p) => (p ? null : composer.current?.getBoundingClientRect() ?? null)) }} className="no-drag ml-1 flex h-[22px] items-center whitespace-nowrap rounded-full bg-line/30 px-2.5 text-[11px] text-text transition-colors hover:bg-line/60">
              {current?.displayName.replace(/\s*\(recommended\)/i, '') ?? '…'}<span className="ml-1.5 text-muted">{effortLabel(effort)}</span>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <button title={t('chat.modes')} onClick={() => { setSlash(null); setPicker(null); setModes((m) => (m ? null : composer.current?.getBoundingClientRect() ?? null)) }}
                className="no-drag flex h-[22px] items-center gap-1 rounded-md px-1.5 text-[11px] text-muted transition-colors hover:text-text">
                {MODES.find((m) => m.id === mode)?.icon}{t(`chat.mode.${mode}` as never)}
              </button>
              {chat.running
                ? <button title={t('chat.stop')} onClick={chat.cancel} className="no-drag grid size-[22px] place-items-center rounded-md bg-accent text-bg transition-[filter] hover:brightness-110"><MdStop size={14} /></button>
                : <button title={t('chat.send')} onClick={submit} disabled={!text.trim() && !images.length} className="no-drag grid size-[22px] place-items-center rounded-md bg-accent text-bg transition-[filter] hover:brightness-110 disabled:cursor-default disabled:opacity-40 disabled:hover:brightness-100"><MdArrowUpward size={14} /></button>}
            </div>
          </div>
        </div>
      </div>
      {slash && <CommandPicker files={files} key={`${trigger}${group ?? ''}`} anchor={slash} trigger={trigger} commands={commands} items={items} initial={group} filter={trigger === '@' ? (/(?:^|\s)@(\S*)$/.exec(text)?.[1] ?? '') : text[0] === trigger ? text.slice(1) : ''} onPick={pick} onClose={() => setSlash(null)} />}
      {plus && <Menu anchor={plus} onClose={() => setPlus(null)} items={[
        { label: 'Claude', icon: <MdChatBubbleOutline size={14} />, onClick: () => chat.newTab() },
        { label: 'Codex', icon: <MdTerminal size={14} />, onClick: () => chat.newTab('codex') },
        { label: 'Code', icon: <MdTerminal size={14} />, onClick: () => void useStore.getState().openAgent({ name: 'Claude Code', command: 'claude' }, [], { cwd: project ?? undefined, title: 'Claude Code' }) }
      ]} />}
      {attachMenu && <Menu anchor={attachMenu} alignLeft onClose={() => setAttachMenu(null)} items={[
        { label: t('chat.upload'), icon: <MdOutlineFileUpload size={15} />, onClick: () => fileInput.current?.click() },
        { label: t('chat.addContext'), icon: <MdOutlineDescription size={15} />, onClick: () => { setText((v) => (v && !/\s$/.test(v) ? `${v} @` : `${v}@`)); input.current?.focus(); openCommands(null, '@') } },
        { label: t('chat.browseWeb'), icon: <MdLanguage size={15} />, onClick: () => { setText((v) => v || t('chat.browsePrefix')); input.current?.focus() } }
      ]} />}
      {modes && <ModePicker anchor={modes} mode={mode} onMode={setMode} onClose={() => setModes(null)} />}
      {picker && <ModelPicker anchor={picker} models={models} model={current?.value ?? model} effort={effort} onModel={(v) => { setModel(v); void window.api.settings.set(`chat.model.${chat.agent}`, v) }} onEffort={(v) => { setEffort(v); void window.api.settings.set(`chat.effort.${chat.agent}`, v) }} onClose={() => setPicker(null)} />}
    </aside>
  )
}

/** Tokens en forma corta: 1.2k, 3.4M. */
const tokens = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n))

/** El texto del input con las menciones («@archivo», «#role:nombre») sobre un fondo de color; el texto va transparente porque lo pinta el input. */
function mentions(text: string): JSX.Element[] {
  const out: JSX.Element[] = []
  let at = 0
  for (const m of text.matchAll(/(^|\s)(@\S*|#\w+:\S+)/g)) {
    const start = (m.index ?? 0) + m[1].length
    if (start > at) out.push(<span key={`t${at}`}>{text.slice(at, start)}</span>)
    out.push(<span key={`m${start}`} className="rounded-sm bg-accent/30">{m[2]}</span>)
    at = start + m[2].length
  }
  out.push(<span key="end">{text.slice(at)}</span>)
  return out
}
