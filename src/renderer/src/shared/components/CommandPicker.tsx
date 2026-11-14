import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MdChevronRight } from 'react-icons/md'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { useListNav } from '@/renderer/src/shared/lib/useListNav'
import { FileIcon } from '@/renderer/src/shared/components/FileIcon'
import { fuzzyScore } from '@/renderer/src/shared/lib/fuzzy'
import type { ChatCommand, ChatItem, ChatProjectItems } from '@/shared/types'

/** «/» son los comandos del SDK; «#» lo que tiene Tutti en el proyecto (.tutti o .agents). */
export type Trigger = '/' | '#' | '@'
export type Group = 'skills' | 'plugins' | 'help' | 'roles' | 'hooks' | 'mcp' | 'steering' | 'powers' | 'specs' | 'roadmap' | 'file' | 'dir'
export const GROUPS: Record<Trigger, Group[]> = {
  '/': ['skills', 'plugins', 'help'],
  '#': ['roles', 'specs', 'roadmap', 'hooks', 'steering', 'powers', 'file', 'dir'],
  '@': []
}
const PLUGINS = new Set(['plugin-authoring', 'reload-plugins'])
const SHOWN = new Set(['clear', ...PLUGINS])
type ItemGroup = Exclude<Group, 'plugins' | 'help' | 'file' | 'dir'>
/** Lo que se escribe en el input al elegir un elemento de «#». */
const INSERT: Record<ItemGroup, (name: string) => string> = {
  roles: (n) => `#role:${n} `, skills: (n) => `#skill:${n} `, hooks: (n) => `#hook:${n} `, mcp: (n) => `#mcp:${n} `, steering: (n) => `#steering:${n} `, powers: (n) => `#power:${n} `, specs: (n) => `#spec:${n} `, roadmap: (n) => `#road:${n} `
}
const label = (g: Group, trigger: Trigger): string => `chat.group${g[0].toUpperCase()}${g.slice(1)}${trigger === '/' && g === 'skills' ? 'Cmd' : ''}`

/**
 * Lista encima de la caja de escritura (`anchor` = su rectángulo en pantalla). Con «/» muestra `clear` y los grupos de comandos del SDK;
 * con «#», los grupos de lo que hay en el proyecto. Si se ha escrito algo tras el signo (`filter`), busca entre todo.
 */
export function CommandPicker({ anchor, trigger, commands, items, files = null, filter, initial = null, onPick, onClose }: {
  anchor: DOMRect; trigger: Trigger; initial?: Group | null; commands: ChatCommand[] | null; items: ChatProjectItems | null; files?: string[] | null; filter: string; onPick: (text: string) => void; onClose: () => void
}) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const [group, setGroup] = useState<Group | null>(initial)

  useEffect(() => {
    const down = (e: PointerEvent): void => { if (!box.current?.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); if (group) setGroup(null); else onClose() } }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true) }
  }, [onClose, group])

  const query = filter.trim().toLowerCase()
  const back = useCallback(() => setGroup(null), [])
  useListNav(box, `${group ?? ''}|${query}|${commands ? 1 : 0}${items ? 1 : 0}`, group && !query ? back : undefined)
  const line = (key: string, label: string, detail: string, text: string): JSX.Element => (
    <button key={key} data-row onClick={() => onPick(text)} className="flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent-bg data-[active=true]:bg-accent-bg">
      <span className="truncate text-[12px] text-text">{label}</span>
      {detail && <span className="truncate text-[10.5px] text-muted">{detail}</span>}
    </button>
  )
  const cmdRow = (c: ChatCommand): JSX.Element => line(`c:${c.name}`, `/${c.name}${c.hint ? ' ' + c.hint : ''}`, c.description, `/${c.name} `)
  const itemRow = (g: ItemGroup, i: ChatItem): JSX.Element => line(`${g}:${i.name}`, i.name, i.description, INSERT[g](i.name))
  const empty = (text: string): JSX.Element => <div className="px-2 py-1.5 text-[12px] text-muted">{text}</div>
  const rows = (list: JSX.Element[]): JSX.Element[] | JSX.Element => (list.length ? list : empty(t('chat.noCommands')))

  /** Filas de archivos y carpetas: sin escribir nada solo lo de la raíz (por orden alfabético); escribiendo, busca en todo. `only` limita a archivos o a carpetas. */
  const fileRows = (prefix: string, only: 'file' | 'dir' | null): JSX.Element[] => {
    if (!files) return [empty(t('chat.loadingModels'))]
    const pool = (query ? files : files.filter((f) => !f.replace(/\/$/, '').includes('/'))).filter((f) => only === null || f.endsWith('/') === (only === 'dir'))
    const ranked = pool.map((f) => ({ f, s: fuzzyScore(query, f) })).filter((x): x is { f: string; s: number } => x.s !== null)
      .sort((a, b) => a.s - b.s || (query ? a.f.length - b.f.length : a.f.localeCompare(b.f))).slice(0, 50)
    return ranked.map(({ f }) => {
      const dir = f.endsWith('/'), clean = f.replace(/\/$/, ''), name = clean.split('/').pop() ?? clean, parent = clean.slice(0, clean.length - name.length).replace(/\/$/, '')
      return (
        <button key={`f:${f}`} data-row onClick={() => onPick(`${prefix}${f} `)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent-bg data-[active=true]:bg-accent-bg">
          <FileIcon name={name} dir={dir} />
          <span className="shrink-0 text-[12px] text-text">{name}{dir ? '/' : ''}</span>
          {parent && <span className="min-w-0 truncate text-[10.5px] text-muted">{parent}</span>}
        </button>
      )
    })
  }

  const inGroup = (g: Group): JSX.Element[] => {
    if (trigger === '/') {
      const list = (commands ?? []).filter((c) => (g === 'plugins' ? PLUGINS.has(c.name) : g === 'help' ? c.builtin && !SHOWN.has(c.name) : !c.builtin && !PLUGINS.has(c.name)))
      return list.map(cmdRow)
    }
    if (g === 'file' || g === 'dir') return fileRows(`#${g}:`, g)
    if (g === 'plugins' || g === 'help') return []
    const list = items?.[g] ?? []
    const local = list.filter((i) => i.scope === 'local'), global = list.filter((i) => i.scope === 'global')
    const title = (text: string): JSX.Element => <div key={`h:${text}`} className="px-2 pb-1 pt-2 text-[12px] font-medium text-muted">{text}</div>
    return [...(local.length ? [title(t('chat.scopeLocal')), ...local.map((i) => itemRow(g, i))] : []), ...(global.length ? [title(t('chat.scopeGlobal')), ...global.map((i) => itemRow(g, i))] : [])]
  }

  const groupRow = (g: Group): JSX.Element => (
      <button key={g} data-row data-enter onClick={() => (query ? onPick(`${trigger}${g}`) : setGroup(g))} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent-bg data-[active=true]:bg-accent-bg">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] text-text">{trigger}{g}</span>
          <span className="block truncate text-[10.5px] text-muted">{t(label(g, trigger) as never)}</span>
        </span>
        <MdChevronRight size={15} className="shrink-0 text-muted" />
      </button>
    )

  let body: JSX.Element[] | JSX.Element
  if (trigger === '@') {
    body = rows(fileRows('@', null))
  } else if (!commands || !items) body = empty(t('chat.loadingModels'))
  else if (query) {
    const groups = GROUPS[trigger].filter((g) => g.startsWith(query)).map(groupRow)      // «#stee» propone el grupo #steering
    const all = trigger === '/'
      ? [...groups, ...commands.filter((c) => c.name.toLowerCase().includes(query)).map(cmdRow)]
      : [...groups, ...(GROUPS['#'].filter((g) => g !== 'file' && g !== 'dir') as ItemGroup[]).flatMap((g) => items[g].filter((i) => i.name.toLowerCase().includes(query)).map((i) => itemRow(g, i)))]
    body = rows(all)
  } else if (group) body = rows(inGroup(group))
  else {
    const entries = GROUPS[trigger].map(groupRow)
    const clear = trigger === '/' ? commands.find((c) => c.name === 'clear') : undefined
    body = [...(clear ? [cmdRow(clear)] : []), ...entries]
  }

  return createPortal(
    <div ref={box} style={{ left: anchor.left, width: anchor.width, bottom: window.innerHeight - anchor.top + 4, maxHeight: Math.min(300, Math.max(160, anchor.top - 14)) }}
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
      <div className="shrink-0 px-3 pb-1 pt-2 text-[11px] text-muted">{group && !query ? `${trigger}${group}` : trigger === '#' ? 'Tutti' : trigger === '@' ? t('chat.files') : t('chat.commandsTitle')}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">{body}</div>
    </div>, document.body
  )
}
