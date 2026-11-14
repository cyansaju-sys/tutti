import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MdAdd, MdArrowUpward, MdChatBubbleOutline, MdClose, MdOutlineBuild, MdOutlineDeleteSweep, MdOutlineDescription, MdOutlineSchedule, MdStop } from 'react-icons/md'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { useStore } from '@/renderer/src/shared/store'
import { useChat } from '@/renderer/src/shared/store/chat'
import { Markdown } from '@/renderer/src/features/files/components/Markdown'
import type { ChatCommand, ChatEffort, ChatModel, ChatProjectItems } from '@/shared/types'
import { CommandPicker, GROUPS, type Group, type Trigger } from './CommandPicker'
import { effortLabel, ModelPicker } from './ModelPicker'
import { ModePicker, MODES, type ChatMode } from './ModePicker'
import { IconButton } from './ui'

/** Las dos formas de empezar: charlar y construir (Vibe) o planificar antes de construir (Spec, el modo plan). */
const FLOWS: Array<{ id: 'vibe' | 'spec'; icon: ReactNode; mode: ChatMode }> = [
  { id: 'vibe', icon: <MdChatBubbleOutline size={15} />, mode: 'auto' },
  { id: 'spec', icon: <MdOutlineDescription size={15} />, mode: 'plan' }
]

/** Panel de chat con Claude (SDK): va al lado opuesto de la barra lateral. */
export function ChatPanel() {
  const t = useT()
  const set = useStore((s) => s.set)
  const chat = useChat()
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }) }, [chat.messages, chat.permissions])
  const [text, setText] = useState('')
  const [models, setModels] = useState<ChatModel[] | null>(null)
  const [model, setModel] = useState('default')
  const [effort, setEffort] = useState<ChatEffort>('medium')
  const [mode, setMode] = useState<ChatMode>('auto')
  const [modes, setModes] = useState<DOMRect | null>(null)
  const [picker, setPicker] = useState<DOMRect | null>(null)
  const composer = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const project = useStore((s) => s.project)
  const [commands, setCommands] = useState<ChatCommand[] | null>(null)
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
    window.api.chat.commands(project ?? undefined).then(setCommands).catch(() => setCommands([]))
    window.api.chat.items(project).then(setItems).catch(() => setItems({ skills: [], hooks: [], mcp: [], roles: [], steering: [], powers: [], specs: [], roadmap: [] }))
  }
  /** Al escribir «/» o «#» (sin espacio todavía) se abre la lista y se va filtrando con lo escrito; al pasar de ahí, se cierra. */
  const onType = (value: string): void => {
    setText(value)
    const kind = value[0] === '/' || value[0] === '#' ? (value[0] as Trigger) : null
    const typing = kind !== null && !/\s/.test(value)
    if (typing && (!slash || kind !== trigger)) openCommands(null, kind)
    else if (!typing && slash) setSlash(null)
  }
  /** Enviar: «/skills», «#roles»… muestran su lista en lugar de enviarse. */
  const submit = (): void => {
    const kind = text.trim()[0] as Trigger
    const word = text.trim().slice(1).toLowerCase()
    if ((kind === '/' || kind === '#') && (GROUPS[kind] as string[]).includes(word)) { setText(''); openCommands(word as Group, kind); return }
    if (text.trim() === '/clear') { setText(''); setSlash(null); chat.clear(); return }
    if (!text.trim() || chat.running) return
    setSlash(null)
    chat.send(text.trim(), { project, model: current?.value ?? model, effort, mode })
    setText('')
  }
  const pick = (value: string): void => { setText(value); setSlash(null); input.current?.focus() }
  const current = models?.find((m) => m.value === model) ?? models?.[0]

  // los modelos se piden al abrir el panel: la pastilla ya muestra el actual
  useEffect(() => { window.api.chat.models().then(setModels).catch(() => undefined) }, [])

  return (
    <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex h-[34px] shrink-0 items-center justify-between pl-3 pr-1">
        <span className="flex items-center gap-2 text-[12px] font-medium text-muted"><MdChatBubbleOutline size={15} />{t('chat.title')}</span>
        <div className="flex items-center">
          <IconButton title={t('chat.newChat')} onClick={chat.clear}><MdOutlineDeleteSweep size={16} /></IconButton>
          <IconButton title={t('chat.close')} onClick={() => set({ chatOpen: false })}><MdClose size={15} /></IconButton>
        </div>
      </div>
      <div ref={list} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden break-words px-3 py-2 [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_table]:block">
        {chat.messages.length === 0 && (
          <div className="m-auto flex w-full flex-col items-center gap-3">
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
        {chat.messages.map((m) => m.role === 'user' ? (
          <div key={m.id} className="ml-6 self-end whitespace-pre-wrap break-words rounded-lg bg-line/50 px-2.5 py-1.5 text-[12px] text-text">{m.text}</div>
        ) : m.role === 'tool' ? (
          <div key={m.id} className="flex items-center gap-1.5 text-[11px] text-muted"><MdOutlineBuild size={12} className="shrink-0" /><span className="shrink-0 font-medium">{m.text}</span><span className="truncate">{m.detail}</span></div>
        ) : m.role === 'error' ? (
          <div key={m.id} className="whitespace-pre-wrap break-words rounded-md bg-danger/10 px-2.5 py-1.5 text-[11.5px] text-danger">{m.text}</div>
        ) : <div key={m.id} className="min-w-0"><Markdown text={m.text} /></div>)}
        {chat.permissions.map((p) => (
          <div key={p.id} className="flex flex-col gap-1.5 rounded-lg border border-accent/50 bg-accent-bg px-2.5 py-2">
            <div className="text-[12px] text-text">{t('chat.wantsTool', { tool: p.tool })}</div>
            {p.input && <div className="truncate font-mono text-[11px] text-muted">{p.input}</div>}
            <div className="flex gap-1.5">
              <button onClick={() => chat.answer(p.id, true)} className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-bg hover:brightness-110">{t('chat.allow')}</button>
              <button onClick={() => chat.answer(p.id, false)} className="rounded-md border border-line px-2.5 py-1 text-[11px] text-muted hover:text-text">{t('chat.deny')}</button>
            </div>
          </div>
        ))}
        {chat.running && chat.permissions.length === 0 && <div className="text-[11px] text-muted">{t('chat.thinking')}</div>}
      </div>
      <div className="shrink-0 p-2">
        <div ref={composer} className="flex flex-col overflow-hidden rounded-lg border border-line bg-panel transition-colors focus-within:border-accent/60">
          <input ref={input} value={text} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); setMode(MODES[(MODES.findIndex((m) => m.id === mode) + 1) % MODES.length].id) } }} placeholder={t('chat.placeholder')}
            className="w-full border-b border-line bg-transparent px-3 pb-2 pt-2.5 text-[12px] text-text outline-none placeholder:text-muted" />
          <div className="flex items-center py-1 pl-0.5 pr-1">
            <button title={t('chat.attach')} className="no-drag grid size-[22px] place-items-center text-muted"><MdAdd size={17} /></button>
            <button title={t('chat.commands')} onClick={() => (slash ? setSlash(null) : openCommands())} className="no-drag grid size-[22px] place-items-center text-muted"><span className="text-[15px] font-medium leading-none">/</span></button>
            <span title={t('chat.cacheTip')} className="no-drag ml-1 flex h-[22px] cursor-default items-center gap-1 px-1.5 text-[11px] text-muted"><MdOutlineSchedule size={14} />60m</span>
            <button title={t('chat.mode')} onClick={() => { setSlash(null); setPicker((p) => (p ? null : composer.current?.getBoundingClientRect() ?? null)) }} className="no-drag ml-1 flex h-[22px] items-center whitespace-nowrap rounded-full bg-line/50 px-2.5 text-[11px] text-text transition-colors hover:bg-line">
              {current?.displayName.replace(/\s*\(recommended\)/i, '') ?? '…'}<span className="ml-1.5 text-muted">{effortLabel(effort)}</span>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <button title={t('chat.modes')} onClick={() => { setSlash(null); setPicker(null); setModes((m) => (m ? null : composer.current?.getBoundingClientRect() ?? null)) }}
                className="no-drag flex h-[22px] items-center gap-1 rounded-md px-1.5 text-[11px] text-muted transition-colors hover:text-text">
                {MODES.find((m) => m.id === mode)?.icon}{t(`chat.mode.${mode}` as never)}
              </button>
              {chat.running
                ? <button title={t('chat.stop')} onClick={chat.cancel} className="no-drag grid size-[22px] place-items-center rounded-md bg-accent text-bg transition-[filter] hover:brightness-110"><MdStop size={14} /></button>
                : <button title={t('chat.send')} onClick={submit} disabled={!text.trim()} className="no-drag grid size-[22px] place-items-center rounded-md bg-accent text-bg transition-[filter] hover:brightness-110 disabled:cursor-default disabled:opacity-40 disabled:hover:brightness-100"><MdArrowUpward size={14} /></button>}
            </div>
          </div>
        </div>
      </div>
      {slash && <CommandPicker key={`${trigger}${group ?? ''}`} anchor={slash} trigger={trigger} commands={commands} items={items} initial={group} filter={text[0] === trigger ? text.slice(1) : ''} onPick={pick} onClose={() => setSlash(null)} />}
      {modes && <ModePicker anchor={modes} mode={mode} onMode={setMode} onClose={() => setModes(null)} />}
      {picker && <ModelPicker anchor={picker} models={models} model={current?.value ?? model} effort={effort} onModel={setModel} onEffort={setEffort} onClose={() => setPicker(null)} />}
    </aside>
  )
}
