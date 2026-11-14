import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MdChevronLeft, MdChevronRight } from 'react-icons/md'
import { useT } from '@/renderer/src/shared/lib/i18n'
import type { ChatCommand, ChatItem, ChatProjectItems } from '@/shared/types'

type Group = 'mcp' | 'skills' | 'plugins' | 'hooks' | 'help'
/** Las entradas que se ven al abrir la lista: `clear` directo y cinco grupos. Skills, hooks y mcp salen de lo que tiene el proyecto (.tutti o .agents); plugins y help, de los comandos del SDK. */
const ROOT: Array<{ name: string; group?: Group }> = [{ name: 'mcp', group: 'mcp' }, { name: 'skills', group: 'skills' }, { name: 'plugins', group: 'plugins' }, { name: 'hooks', group: 'hooks' }, { name: 'clear' }, { name: 'help', group: 'help' }]
const PLUGINS = new Set(['plugin-authoring', 'reload-plugins'])
const SHOWN = new Set(['clear', ...PLUGINS])
/** Lo que se escribe en el input al elegir un elemento de cada grupo. */
const INSERT: Record<'mcp' | 'skills' | 'hooks', (name: string) => string> = { skills: (n) => `/${n} `, hooks: (n) => `hook:${n} `, mcp: (n) => `mcp:${n} ` }

/**
 * Lista de comandos «/» encima de la caja de escritura (`anchor` = su rectángulo en pantalla). Muestra cinco entradas y, al abrir un grupo, sus comandos.
 * Si se ha escrito algo tras la barra (`filter`), busca entre todos.
 */
export function CommandPicker({ anchor, commands, items, filter, onPick, onClose }: {
  anchor: DOMRect; commands: ChatCommand[] | null; items: ChatProjectItems | null; filter: string; onPick: (text: string) => void; onClose: () => void
}) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const [group, setGroup] = useState<Group | null>(null)

  useEffect(() => {
    const down = (e: PointerEvent): void => { if (!box.current?.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); if (group) setGroup(null); else onClose() } }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true) }
  }, [onClose, group])

  const query = filter.trim().toLowerCase()
  const line = (key: string, label: string, detail: string, text: string): JSX.Element => (
    <button key={key} onClick={() => onPick(text)} className="flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent-bg">
      <span className="truncate text-[12px] text-text">{label}</span>
      {detail && <span className="truncate text-[10.5px] text-muted">{detail}</span>}
    </button>
  )
  const cmdRow = (c: ChatCommand): JSX.Element => line(`c:${c.name}`, `/${c.name}${c.hint ? ' ' + c.hint : ''}`, c.description, `/${c.name} `)
  const itemRow = (g: 'mcp' | 'skills' | 'hooks', i: ChatItem): JSX.Element => line(`${g}:${i.name}`, i.name, i.description, INSERT[g](i.name))
  const empty = (text: string): JSX.Element => <div className="px-2 py-1.5 text-[12px] text-muted">{text}</div>
  const rows = (list: JSX.Element[]): JSX.Element[] | JSX.Element => (list.length ? list : empty(t('chat.noCommands')))

  const inGroup = (g: Group): JSX.Element[] => {
    if (g === 'plugins') return (commands ?? []).filter((c) => PLUGINS.has(c.name)).map(cmdRow)
    if (g === 'help') return (commands ?? []).filter((c) => c.builtin && !SHOWN.has(c.name)).map(cmdRow)
    return (items?.[g] ?? []).map((i) => itemRow(g, i))
  }

  let body: JSX.Element[] | JSX.Element
  if (!commands || !items) body = empty(t('chat.loadingModels'))
  else if (query) {
    const all = [
      ...commands.filter((c) => c.name.toLowerCase().includes(query)).map(cmdRow),
      ...(['skills', 'hooks', 'mcp'] as const).flatMap((g) => items[g].filter((i) => i.name.toLowerCase().includes(query)).map((i) => itemRow(g, i)))
    ]
    body = rows(all)
  } else if (group) body = rows(inGroup(group))
  else {
    body = ROOT.map((r) => {
      if (!r.group) {
        const cmd = commands.find((c) => c.name === r.name)
        return cmd ? cmdRow(cmd) : line(r.name, `/${r.name}`, '', `/${r.name} `)
      }
      const g = r.group
      return (
        <button key={r.name} onClick={() => setGroup(g)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent-bg">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] text-text">/{r.name}</span>
            <span className="block truncate text-[10.5px] text-muted">{t(`chat.group${r.name[0].toUpperCase()}${r.name.slice(1)}` as never)}</span>
          </span>
          <MdChevronRight size={15} className="shrink-0 text-muted" />
        </button>
      )
    })
  }

  return createPortal(
    <div ref={box} style={{ left: anchor.left, width: anchor.width, bottom: window.innerHeight - anchor.top + 4, maxHeight: Math.min(300, Math.max(160, anchor.top - 14)) }}
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
      {group && !query
        ? <button onClick={() => setGroup(null)} className="flex shrink-0 items-center gap-1 px-2 pb-1 pt-2 text-left text-[11px] text-muted transition-colors hover:text-text"><MdChevronLeft size={14} />{t('chat.back')} · /{group}</button>
        : <div className="shrink-0 px-3 pb-1 pt-2 text-[11px] text-muted">{t('chat.commandsTitle')}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">{body}</div>
    </div>, document.body
  )
}
