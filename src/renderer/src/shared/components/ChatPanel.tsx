import { useEffect, useRef, useState } from 'react'
import { MdAdd, MdArrowUpward, MdChatBubbleOutline, MdClose, MdOutlineSchedule } from 'react-icons/md'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { useStore } from '@/renderer/src/shared/store'
import type { ChatCommand, ChatEffort, ChatModel, ChatProjectItems } from '@/shared/types'
import { CommandPicker } from './CommandPicker'
import { effortLabel, ModelPicker } from './ModelPicker'
import { IconButton } from './ui'

/** Panel de chat: va al lado opuesto de la barra lateral. Por ahora solo la estructura. */
export function ChatPanel() {
  const t = useT()
  const set = useStore((s) => s.set)
  const [text, setText] = useState('')
  const [models, setModels] = useState<ChatModel[] | null>(null)
  const [model, setModel] = useState('default')
  const [effort, setEffort] = useState<ChatEffort>('medium')
  const [picker, setPicker] = useState<DOMRect | null>(null)
  const composer = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const project = useStore((s) => s.project)
  const [commands, setCommands] = useState<ChatCommand[] | null>(null)
  const [items, setItems] = useState<ChatProjectItems | null>(null)
  const [slash, setSlash] = useState<DOMRect | null>(null)

  /** Abre la lista de comandos (se piden al SDK la primera vez; dependen del proyecto abierto). */
  const openCommands = (): void => {
    setPicker(null)
    setSlash(composer.current?.getBoundingClientRect() ?? null)
    window.api.chat.commands(project ?? undefined).then(setCommands).catch(() => setCommands([]))
    window.api.chat.items(project).then(setItems).catch(() => setItems({ skills: [], hooks: [], mcp: [] }))
  }
  const pick = (value: string): void => { setText(value); setSlash(null); input.current?.focus() }
  const current = models?.find((m) => m.value === model) ?? models?.[0]

  // los modelos se piden al abrir el panel: la pastilla ya muestra el actual
  useEffect(() => { window.api.chat.models().then(setModels).catch(() => undefined) }, [])

  return (
    <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex h-[34px] shrink-0 items-center justify-between pl-3 pr-1">
        <span className="flex items-center gap-2 text-[12px] font-medium text-muted"><MdChatBubbleOutline size={15} />{t('chat.title')}</span>
        <IconButton title={t('chat.close')} onClick={() => set({ chatOpen: false })}><MdClose size={15} /></IconButton>
      </div>
      <div className="min-h-0 flex-1" />
      <div className="shrink-0 p-2">
        <div ref={composer} className="flex flex-col overflow-hidden rounded-lg border border-line bg-panel transition-colors focus-within:border-accent/60">
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chat.placeholder')}
            className="w-full border-b border-line bg-transparent px-3 pb-2 pt-2.5 text-[12px] text-text outline-none placeholder:text-muted" />
          <div className="flex items-center py-1 pl-0.5 pr-1">
            <button title={t('chat.attach')} className="no-drag grid size-[22px] place-items-center text-muted"><MdAdd size={17} /></button>
            <button title={t('chat.commands')} onClick={() => (slash ? setSlash(null) : openCommands())} className="no-drag grid size-[22px] place-items-center text-muted"><span className="text-[15px] font-medium leading-none">/</span></button>
            <span title={t('chat.cacheTip')} className="no-drag ml-1 flex h-[22px] cursor-default items-center gap-1 px-1.5 text-[11px] text-muted"><MdOutlineSchedule size={14} />60m</span>
            <button title={t('chat.mode')} onClick={() => { setSlash(null); setPicker((p) => (p ? null : composer.current?.getBoundingClientRect() ?? null)) }} className="no-drag ml-1 flex h-[22px] items-center whitespace-nowrap rounded-full bg-line/50 px-2.5 text-[11px] text-text transition-colors hover:bg-line">
              {current?.displayName.replace(/\s*\(recommended\)/i, '') ?? '…'}<span className="ml-1.5 text-muted">{effortLabel(effort)}</span>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <button title={t('chat.send')} disabled={!text.trim()} className="no-drag grid size-[22px] place-items-center rounded-md bg-accent text-bg transition-[filter] hover:brightness-110 disabled:cursor-default disabled:opacity-40 disabled:hover:brightness-100"><MdArrowUpward size={14} /></button>
            </div>
          </div>
        </div>
      </div>
      {slash && <CommandPicker anchor={slash} commands={commands} items={items} filter={text.startsWith('/') ? text.slice(1) : ''} onPick={pick} onClose={() => setSlash(null)} />}
      {picker && <ModelPicker anchor={picker} models={models} model={current?.value ?? model} effort={effort} onModel={setModel} onEffort={setEffort} onClose={() => setPicker(null)} />}
    </aside>
  )
}
