import { clsx } from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MdArrowUpward, MdWarningAmber, MdArticle, MdBolt, MdCallSplit, MdClose, MdDeleteSweep, MdDescription, MdDifference, MdExplore, MdFactCheck, MdFlag, MdFolderOpen, MdFormatQuote, MdHistory, MdInsertDriveFile, MdMenuBook, MdMoreHoriz, MdStop, MdTerminal, MdWebhook } from 'react-icons/md'
import type { AgentInfo, ChatRefPreview, ChatRefs, ChatUsage, ProjectRef, SlashCommand } from '@shared/types'
import type { MsgKey } from '@shared/i18n'
import { Markdown } from '@/features/files/components/Markdown'
import { CHAT_MODELS } from '@shared/chatModels'
import { ChatMessage } from './ChatMessage'
import { fuzzyScore } from '@/shared/lib/fuzzy'
import { iconFor } from '@/shared/lib/icons'
import { useT } from '@/shared/lib/i18n'
import { relative, toPosix } from '@/shared/lib/paths'
import { useStore } from '@/shared/store'
import { IconButton } from './ui'

/** Una opción de los menús de «/» y de «#». */
interface Item { key: string; label: string; hint: string; tag?: string; icon?: string; glyph?: React.ReactNode; apply: () => void }
/** Lo que se está eligiendo tras un #: archivos, carpetas, «otros» o una lista concreta. */
type RefKind = 'file' | 'dir' | 'other' | 'commit' | 'spec' | 'steering' | 'skill' | 'doc' | 'terminal'
/** Las referencias que se eligen de una lista: su clave en ChatRefs, su texto y su icono. */
const LISTS: Array<{ kind: 'commit' | 'spec' | 'steering' | 'skill' | 'doc' | 'terminal'; label: MsgKey; hint: MsgKey; glyph: React.ReactNode }> = [
  { kind: 'commit', label: 'chat.ref.commit', hint: 'chat.ref.commitHint', glyph: <MdHistory size={15} /> },
  { kind: 'spec', label: 'chat.ref.spec', hint: 'chat.ref.specHint', glyph: <MdFactCheck size={15} /> },
  { kind: 'steering', label: 'chat.ref.steering', hint: 'chat.ref.steeringHint', glyph: <MdExplore size={15} /> },
  { kind: 'skill', label: 'chat.ref.skill', hint: 'chat.ref.skillHint', glyph: <MdBolt size={15} /> },
  { kind: 'doc', label: 'chat.ref.doc', hint: 'chat.ref.docHint', glyph: <MdMenuBook size={15} /> },
  { kind: 'terminal', label: 'chat.ref.terminal', hint: 'chat.ref.terminalHint', glyph: <MdTerminal size={15} /> }
]
/** Cuanto más bajo, antes: primero los que empiezan por lo escrito (por el nombre o por la ruta). */
const rank = (path: string, q: string): number => {
  const lower = path.toLowerCase().replace(/\/$/, ''), query = q.toLowerCase()
  return (lower.split('/').pop() ?? lower).startsWith(query) ? 0 : lower.startsWith(query) ? 1 : 2
}

/**
 * El panel de chat: se abre desde la barra de título, al lado contrario de la barra lateral. Se conversa con un agente instalado sin abrirlo en una
 * terminal (cada mensaje lanza su CLI en modo no interactivo, solo para conversar: no edita archivos). «/» lista comandos y «#» cita archivos y carpetas del proyecto.
 */
export function ChatPanel() {
  const t = useT()
  const width = useStore((s) => s.chatWidth)
  const messages = useStore((s) => s.chatMessages)
  const chosen = useStore((s) => s.chatAgent)
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const set = useStore((s) => s.set)
  const docs = useStore((s) => s.docs)
  const activeDoc = useStore((s) => s.activeDoc)
  const selection = useStore((s) => s.editorSelection)
  const [agents, setAgents] = useState<AgentInfo[] | null>(null)
  const [text, setText] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [partial, setPartial] = useState('')          // lo que lleva escrito el agente mientras responde
  const [slash, setSlash] = useState<SlashCommand[]>([])          // los «/comandos» del agente elegido
  const openDoc = useStore((s) => s.openDoc)
  const git = useStore((s) => s.git)
  const chatModel = useStore((s) => s.chatModel)
  const [usage, setUsage] = useState<ChatUsage | null>(null)          // lo que gastó la última respuesta (si el agente lo informa)
  const [preview, setPreview] = useState<ChatRefPreview[]>([])          // lo que adjuntarían los # del mensaje que se escribe
  const inline = useRef<Record<string, string>>({})          // el texto de las selecciones citadas, tal como estaba en el editor
  const listBox = useRef<HTMLDivElement>(null)
  const [refs, setRefs] = useState<{ project: string; list: ProjectRef[]; at: number } | null>(null)          // archivos y carpetas para «#» (se leen al escribir la primera)
  const [refKind, setRefKind] = useState<RefKind | null>(null)          // lo elegido tras escribir #: solo archivos, solo carpetas, «otros» o una de sus listas
  const [extra, setExtra] = useState<{ project: string; data: ChatRefs } | null>(null)
  const [caret, setCaret] = useState(0)
  const [pick, setPick] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const agent = agents?.find((a) => a.command === chosen) ?? agents?.[0] ?? null

  useEffect(() => { void window.api.chat.agents().then(setAgents) }, [])
  useEffect(() => window.api.chat.onChunk(setPartial), [])
  useEffect(() => { void window.api.settings.get('chat_models').then((v) => { if (v && typeof v === 'object' && !Array.isArray(v)) set({ chatModel: v as Record<string, string> }) }) }, [set])
  useEffect(() => { if (project && refs?.project !== project) void window.api.chat.refs(project).then((list) => setRefs({ project, list, at: Date.now() })) }, [project])  // eslint-disable-line react-hooks/exhaustive-deps
  const setChat = useStore((s) => s.setChat)
  useEffect(() => { if (agent) void window.api.chat.slash(project, agent.command).then(setSlash) }, [agent?.command, project])  // eslint-disable-line react-hooks/exhaustive-deps
  // al cerrar el panel se deja de esperar la respuesta
  useEffect(() => () => { void window.api.ai.cancel('chat') }, [])
  useLayoutEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages, waiting, partial])
  // el campo empieza de una línea y crece con el texto (hasta un tope)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  // el menú de «/»: mientras se escribe el nombre del comando (aún sin espacio); /clear es del propio chat
  const local: SlashCommand[] = [{ name: 'clear', description: t('chat.clear'), source: 'builtin', file: '' }, { name: 'help', description: t('chat.helpDesc'), source: 'builtin', file: '' }]
  const all: SlashCommand[] = [...local, ...slash.filter((c) => !local.some((l) => l.name === c.name))]
  const typing = /^\/(\S*)$/.exec(text)
  const slashItems: Item[] = typing && !dismissed
    ? all.filter((c) => c.name.toLowerCase().includes(typing[1].toLowerCase())).slice(0, 8).map((c) => ({
      key: `${c.source}:${c.name}`, label: `/${c.name}`, hint: c.description, tag: t(c.source === 'project' ? 'chat.slashProject' : c.source === 'user' ? 'chat.slashUser' : 'chat.slashBuiltin'), apply: () => choose(c)
    }))
    : []
  // el menú de «#»: la palabra bajo el cursor que empieza por # (archivos, carpetas y lo demás que se puede citar)
  const before = text.slice(0, caret)
  const hash = /(?:^|\s)#([^\s#]*)$/.exec(before)
  const hashStart = hash ? before.length - hash[1].length - 1 : -1
  const query = (hash?.[1] ?? '').toLowerCase()
  useEffect(() => {
    if (hash && project) {                  // al escribir # se vuelve a leer: hay commits y terminales nuevos, y archivos
      if (refs?.project !== project || Date.now() - refs.at > 30_000) void window.api.chat.refs(project).then((list) => setRefs({ project, list, at: Date.now() }))          // la lista de archivos se reutiliza medio minuto
      void window.api.chat.extraRefs(project).then((data) => setExtra({ project, data }))
    }
    if (!hash) setRefKind(null)
  }, [!!hash, project])  // eslint-disable-line react-hooks/exhaustive-deps
  const insertRef = (token: string): void => {
    const next = `${text.slice(0, hashStart)}#${token} ${text.slice(caret)}`
    const at = hashStart + token.length + 2
    setText(next); setCaret(at); setPick(0); setRefKind(null)
    setTimeout(() => { box.current?.focus(); box.current?.setSelectionRange(at, at) })
  }
  const open = (k: RefKind): void => { setRefKind(k); setPick(0); box.current?.focus() }
  const rel = (path: string): string => toPosix(relative(project ?? '', path))
  const data = extra?.project === project ? extra.data : null
  const openFile = docs.find((d) => d.path === activeDoc && d.kind === 'text' && !d.diffOf && project && d.path.startsWith(project))
  const sel = selection && project && selection.path.startsWith(project) ? selection : null
  // lo que se cita con una sola palabra (o un submenú que lleva a una lista)
  const others: Item[] = [
    { key: 'cambios', label: t('chat.ref.changes'), hint: t('chat.ref.changesHint'), glyph: <MdDifference size={15} />, apply: () => insertRef('cambios') },
    { key: 'rama', label: t('chat.ref.branch'), hint: t('chat.ref.branchHint'), glyph: <MdCallSplit size={15} />, apply: () => insertRef('rama') },
    ...(openFile ? [{ key: 'open', label: t('chat.ref.openFile'), hint: rel(openFile.path), glyph: <MdDescription size={15} />, apply: () => insertRef(rel(openFile.path)) }] : []),
    ...(sel ? [{ key: 'sel', label: t('chat.ref.selection'), hint: `${rel(sel.path)}:${sel.startLine}-${sel.endLine}`, glyph: <MdFormatQuote size={15} />, apply: () => { const token = `sel:${rel(sel.path)}:${sel.startLine}-${sel.endLine}`; inline.current[token] = sel.text; insertRef(token) } }] : []),
    ...(data?.roadmap ? [{ key: 'roadmap', label: t('chat.ref.roadmap'), hint: t('chat.ref.roadmapHint'), glyph: <MdFlag size={15} />, apply: () => insertRef('roadmap') }] : []),
    { key: 'contexto', label: t('chat.ref.context'), hint: t('chat.ref.contextHint'), glyph: <MdArticle size={15} />, apply: () => insertRef('contexto') },
    ...(data?.hooks ? [{ key: 'hooks', label: t('chat.ref.hooks'), hint: t('chat.ref.hooksHint'), glyph: <MdWebhook size={15} />, apply: () => insertRef('hooks') }] : []),
    ...(LISTS.filter((l) => data?.[l.kind].length).map((l): Item => ({ key: l.kind, label: t(l.label), hint: t(l.hint), glyph: l.glyph, tag: '›', apply: () => open(l.kind) })))
  ]
  const entries = (): Item[] => {
    if (!hash || dismissed) return []
    if (refKind === 'other') return others.filter((o) => (o.label + o.hint).toLowerCase().includes(query))
    const list = LISTS.find((l) => l.kind === refKind)
    if (list) return (data?.[list.kind] ?? []).filter((o) => (o.label + o.hint).toLowerCase().includes(query)).slice(0, 12).map((o) => ({ key: o.id, label: o.label, hint: o.hint, glyph: list.glyph, apply: () => insertRef(`${list.kind}:${o.id}`) }))
    if (!refKind && !query) {                // un # solo: primero se elige qué citar
      return [
        { key: 'file', label: t('chat.refFile'), hint: t('chat.refFileHint'), glyph: <MdInsertDriveFile size={15} />, apply: () => open('file') },
        { key: 'dir', label: t('chat.refDir'), hint: t('chat.refDirHint'), glyph: <MdFolderOpen size={15} />, apply: () => open('dir') },
        { key: 'other', label: t('chat.refOther'), hint: t('chat.refOtherHint'), glyph: <MdMoreHoriz size={15} />, tag: '›', apply: () => open('other') }
      ]
    }
    // archivos y carpetas (solo de una clase si ya se eligió); si se escribe sin elegir, también lo de «otros» que coincida
    const openPaths = new Set(docs.map((d) => rel(d.path)))
    const changed = new Set((git?.files ?? []).map((f) => toPosix(f.path)))
    const boost = (path: string): number => (openPaths.has(path) ? -0.6 : changed.has(path) ? -0.3 : 0)          // los abiertos y los que tienen cambios, primero
    const found: Item[] = refs?.project === project
      ? refs.list.filter((r) => !refKind || r.isDir === (refKind === 'dir'))
        .map((r) => ({ r, score: fuzzyScore(query, r.path) })).filter((x): x is { r: ProjectRef; score: number } => x.score !== null)
        .sort((x, y) => x.score + boost(x.r.path) - (y.score + boost(y.r.path)) || x.r.path.length - y.r.path.length).slice(0, 40).map(({ r }) => ({
          key: r.path, label: r.path, hint: '', icon: iconFor(r.path.replace(/\/$/, '').split('/').pop() ?? r.path, r.isDir), tag: openPaths.has(r.path) ? t('chat.refOpen') : changed.has(r.path) ? t('chat.refChanged') : undefined, apply: () => insertRef(r.path)
        }))
      : []
    return refKind ? found : [...others.filter((o) => !o.tag && (o.label + o.hint).toLowerCase().includes(query)), ...found].slice(0, 40)
  }
  const hashItems = entries()
  const items = slashItems.length ? slashItems : hashItems
  // lo que adjuntarían los # del mensaje que se escribe: tamaño y avisos, un momento después de dejar de teclear
  useEffect(() => {
    if (!project || !/(?:^|\s)#[^\s#]/.test(text)) { setPreview([]); return }
    const timer = setTimeout(() => { void window.api.chat.preview(project, text, inline.current).then(setPreview) }, 350)
    return () => clearTimeout(timer)
  }, [text, project])
  const dropRef = (token: string): void => setText((v) => v.replace(new RegExp(`(^|\\s)#${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g'), '$1').replace(/ {2,}/g, ' ').trimStart())
  const promptTokens = Math.ceil(messages.reduce((n, m) => n + m.text.length + (m.attached?.length ?? 0), 0) / 4)
  const models = agent ? CHAT_MODELS[agent.command] ?? [] : []
  useLayoutEffect(() => { listBox.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [pick, items.length])
  const choose = (c: SlashCommand): void => {
    if (c.name === 'help') { setChat([...messages, { role: 'user', text: '/help' }, { role: 'assistant', text: `${t('chat.helpIntro')}\n\n${all.map((x) => `- \`/${x.name}\`${x.description ? `: ${x.description}` : ''}`).join('\n')}` }]); setText(''); return }
    if (c.name === 'clear') { void window.api.ai.cancel('chat'); setWaiting(false); setPartial(''); setChat([]); setText(''); return }
    setText(`/${c.name} `); setPick(0); box.current?.focus()
  }

  const send = async (): Promise<void> => {
    const message = text.trim()
    if (!message || !agent || waiting) return
    if (message === '/clear' || message === '/help') { choose(all.find((c) => `/${c.name}` === message)!); return }
    const history = [...messages, { role: 'user' as const, text: message }]
    setChat(history)
    setText(''); setPreview([]); setPartial(''); setWaiting(true)
    const used = Object.fromEntries(Object.entries(inline.current).filter(([token]) => message.includes(`#${token}`)))          // solo las selecciones que el mensaje cita
    const res = await window.api.chat.ask(project, agent.command, history, { inline: used, model: chatModel[agent.command] || undefined })
    inline.current = {}
    setUsage(res.usage ?? null)
    setWaiting(false); setPartial('')
    const now = useStore.getState().chatMessages
    if (now.length < history.length || now[history.length - 1]?.text !== message) return          // se borró la conversación o se cambió de proyecto mientras tanto
    if (res.ok && res.text) setChat([...now.slice(0, history.length - 1), { ...now[history.length - 1], attached: res.attached }, { role: 'assistant', text: res.text }])
    else if (res.message) toast(res.message, 'error')
  }

  return (
    <aside style={{ width }} className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex items-center gap-1 py-1 pl-3.5 pr-1.5">
        <h3 className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted/75">{t('title.chat')}</h3>
        <IconButton title={t('chat.clear')} onClick={() => { void window.api.ai.cancel('chat'); setWaiting(false); setPartial(''); setChat([]) }}><MdDeleteSweep size={16} /></IconButton>
        <IconButton title={t('title.close')} onClick={() => set({ chatOpen: false })}><MdClose size={15} /></IconButton>
      </div>
      <div className="sect-scroll selectable flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
        {messages.length === 0 && <p className="m-auto px-4 text-center text-[12px] leading-snug text-muted">{agents && !agent ? t('chat.noAgent') : t('chat.empty')}</p>}
        {messages.map((m, i) => <ChatMessage key={i} turn={m} files={refs?.project === project ? refs.list : []} onOpen={(path) => void openDoc(`${project}/${path}`)} />)}
        {waiting && partial && <div className="max-w-[92%] self-start rounded-lg bg-ov/[0.05] px-3 py-2 text-[12px] leading-relaxed"><Markdown text={partial} /></div>}
        {waiting && !partial && <p className="self-start animate-pulse px-1 text-[11px] text-muted">{t('chat.thinking', { agent: agent?.name ?? '' })}</p>}
        <div ref={end} />
      </div>
      {messages.length > 0 && (
        <p className={clsx('px-3.5 pb-0.5 text-[10px] leading-snug', promptTokens > 30000 ? 'text-danger' : 'text-muted')} title={promptTokens > 30000 ? t('chat.usageBig') : undefined}>
          {t('chat.usage', { n: promptTokens })}
          {usage && ` · ${t('chat.usageLast', { input: usage.inputTokens, output: usage.outputTokens })}${usage.costUsd !== undefined ? ` · $${usage.costUsd.toFixed(3)}` : ''}`}
          {promptTokens > 30000 && ` · ${t('chat.usageBig')}`}
        </p>
      )}
      <div className="relative p-2">
        {items.length > 0 && (
          <div ref={listBox} role="listbox" className="absolute inset-x-2 bottom-full mb-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-panel shadow-lg">
            {items.map((it, i) => (
              <button key={it.key} role="option" aria-selected={i === pick} onMouseEnter={() => setPick(i)} onMouseDown={(e) => { e.preventDefault(); it.apply() }}
                className={clsx('flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px]', i === pick && 'bg-accent-bg')}>
                {it.icon && <img src={it.icon} alt="" className="size-4 shrink-0" draggable={false} />}
                {it.glyph && <span className="shrink-0 text-accent">{it.glyph}</span>}
                <span className={clsx('min-w-0 truncate', it.icon ? 'flex-1' : 'shrink-0 font-medium', !it.icon && !it.glyph && 'text-accent')}>{it.label}</span>
                {!it.icon && <span className="min-w-0 flex-1 truncate text-[11px] text-muted">{it.hint}</span>}
                {it.tag && <span className="shrink-0 rounded bg-ov/[0.07] px-1.5 py-px text-[9px] text-muted">{it.tag}</span>}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-line bg-ov/[0.03] transition-colors focus-within:border-accent">
          {preview.length > 0 && (
            <div className="flex flex-wrap gap-1 px-2 pt-2">
              {preview.map((r) => {
                const problem = r.note !== 'ok'
                return (
                  <span key={r.token} title={t(`chat.note.${r.note}` as MsgKey)} className={clsx('flex max-w-full items-center gap-1 rounded-md bg-ov/[0.08] py-px pl-1.5 pr-0.5 text-[10px]', problem ? 'text-danger' : 'text-muted')}>
                    {problem && <MdWarningAmber size={11} className="shrink-0" />}
                    <span className="min-w-0 truncate">#{r.token}</span>
                    {r.chars > 0 && <span className="shrink-0 opacity-70">{t('ctx.tokens', { n: Math.ceil(r.chars / 4) })}</span>}
                    <button onClick={() => dropRef(r.token)} aria-label={t('chat.refRemove')} title={t('chat.refRemove')} className="grid size-4 shrink-0 place-items-center rounded hover:text-text"><MdClose size={11} /></button>
                  </span>
                )
              })}
            </div>
          )}
          <textarea ref={box} value={text} onChange={(e) => { setText(e.target.value); setCaret(e.target.selectionStart); setPick(0); setDismissed(false) }} onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)} onClick={(e) => setCaret(e.currentTarget.selectionStart)} rows={1} spellCheck={false} disabled={!agent}
            onKeyDown={(e) => {
            if (items.length) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setPick((p) => (p + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length); return }
              if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && !(slashItems.length && typing && all.some((c) => c.name === typing[1])))) { e.preventDefault(); items[Math.min(pick, items.length - 1)].apply(); return }
              if (e.key === 'Escape') { e.preventDefault(); setDismissed(true); return }
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
          }} className="block max-h-40 w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[12px] leading-relaxed text-text outline-none" />
          <div className="flex items-center gap-1.5 px-2 pb-2">
            <button onClick={() => { setText((v) => (v.startsWith('/') ? v : `/${v}`)); setPick(0); setDismissed(false); box.current?.focus() }} disabled={!agent} title={t('chat.commands')} aria-label={t('chat.commands')}
              className="grid size-6 place-items-center rounded-md border border-line text-[12px] font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40">/</button>
            {agents && agents.length > 0 && (
              <select value={agent?.command ?? ''} onChange={(e) => set({ chatAgent: e.target.value })} title={t('chat.agent')}
                className="no-drag max-w-36 truncate rounded-full bg-ov/[0.07] px-2.5 py-0.5 text-[11px] text-muted outline-none transition-colors hover:text-text">
                {agents.map((a) => <option key={a.command} value={a.command} className="bg-panel">{a.name}</option>)}
              </select>
            )}
            {models.length > 0 && agent && (
              <select value={chatModel[agent.command] ?? ''} title={t('chat.model')}
                onChange={(e) => { const next = { ...chatModel, [agent.command]: e.target.value }; set({ chatModel: next }); void window.api.settings.set('chat_models', next) }}
                className="no-drag max-w-32 truncate rounded-full bg-ov/[0.07] px-2.5 py-0.5 text-[11px] text-muted outline-none transition-colors hover:text-text">
                <option value="" className="bg-panel">{t('chat.modelDefault')}</option>
                {models.map((m) => <option key={m} value={m} className="bg-panel">{m}</option>)}
              </select>
            )}
            <span className="flex-1" />
            {waiting
              ? <button onClick={() => { void window.api.ai.cancel('chat') }} title={t('chat.stop')} aria-label={t('chat.stop')} className="grid size-7 place-items-center rounded-lg bg-accent-bg text-accent transition-[filter] hover:brightness-110"><MdStop size={16} /></button>
              : <button onClick={() => void send()} disabled={!text.trim() || !agent} title={t('sf.create')} aria-label={t('sf.create')} className="grid size-7 place-items-center rounded-lg bg-accent text-bg transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><MdArrowUpward size={17} /></button>}
          </div>
        </div>
      </div>
    </aside>
  )
}
