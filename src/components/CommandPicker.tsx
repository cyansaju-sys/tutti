import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MdChevronRight } from 'react-icons/md'
import { useT } from '@/lib/i18n'
import { useListNav } from '@/lib/useListNav'
import { FileIcon } from '@/components/FileIcon'
import { fuzzyScore } from '@/lib/fuzzy'
import type { ChatCommand, ChatItem, ChatProjectItems } from '@/shared/types'

/** «/» son los comandos del SDK; «#» lo que tiene Tutti en el proyecto (.tutti o .agents). */
export type Trigger = '/' | '#' | '@'
export type Group = 'skills' | 'plugins' | 'help' | 'roles' | 'hooks' | 'mcp' | 'steering' | 'powers' | 'specs' | 'roadmap' | 'docs' | 'changes' | 'file' | 'dir'
export const GROUPS: Record<Trigger, Group[]> = {
  '/': ['mcp', 'skills', 'plugins', 'help'],
  '#': ['roles', 'specs', 'roadmap', 'docs', 'hooks', 'steering', 'powers', 'changes', 'file', 'dir'],
  '@': []
}
/** Los que se ven al abrir la lista con «#»; los demás aparecen al escribir (y siguen funcionando como «#hooks» a mano). */
export const MAIN: Record<Trigger, Group[]> = { '/': ['mcp', 'skills', 'plugins', 'help'], '#': ['specs', 'roles', 'changes', 'file'], '@': [] }
const PLUGINS = new Set(['plugin-authoring', 'reload-plugins'])
const SHOWN = new Set(['clear', 'btw', ...PLUGINS])
type ItemGroup = Exclude<Group, 'plugins' | 'help' | 'file' | 'dir'>
/** Lo que se escribe en el input al elegir un elemento de «#». */
const INSERT: Record<ItemGroup, (name: string) => string> = {
  roles: (n) => `#role:${n} `, skills: (n) => `#skill:${n} `, hooks: (n) => `#hook:${n} `, mcp: (n) => `#mcp:${n} `, steering: (n) => `#steering:${n} `, powers: (n) => `#power:${n} `, specs: (n) => `#spec:${n} `, docs: (n) => `#doc:${n} `, changes: (n) => `#diff:${n} `, roadmap: (n) => `#road:${n.replace(/\s+/g, '_')} `
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
  const itemRow = (g: ItemGroup, i: ChatItem): JSX.Element => i.status === undefined && g !== 'mcp' ? line(`${g}:${i.name}`, i.name, i.description, INSERT[g](i.name)) : (
    <button key={`${g}:${i.name}`} data-row onClick={() => onPick(INSERT[g](i.name))} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent-bg data-[active=true]:bg-accent-bg">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12px] text-text">{i.name}</span>
        {i.description && <span className="truncate text-[10.5px] text-muted">{i.description}</span>}
      </span>
      <span className={`shrink-0 text-[10.5px] ${i.status === 'connected' ? 'text-accent' : i.status === 'failed' || i.status === 'needs-auth' ? 'text-danger' : 'text-muted'}`}>{i.status ? t(`chat.mcp.${i.status}` as never) : t('chat.mcp.pending' as never)}</span>
    </button>
  )
  const empty = (text: string): JSX.Element => <div className="px-2 py-1.5 text-[12px] text-muted">{text}</div>
  const rows = (list: JSX.Element[]): JSX.Element[] | JSX.Element => (list.length ? list : empty(t('chat.noCommands')))

  /** Filas de archivos y carpetas: sin escribir nada solo lo de la raíz (por orden alfabético); escribiendo, busca en todo. `only` limita a archivos o a carpetas. */
  const fileRows = (prefix: string, only: 'file' | 'dir' | null): JSX.Element[] => {
    if (!files) return [empty(t('chat.loadingModels'))]
    const own = (f: string): boolean => /^\.(tutti|agents)(\/|$)/.test(f)          // lo de .tutti y .agents ya tiene sus propios grupos
    const pool = (query ? files : files.filter((f) => !f.replace(/\/$/, '').includes('/'))).filter((f) => !own(f) && (only === null || f.endsWith('/') === (only === 'dir')))
    const ranked = pool.map((f) => ({ f, s: fuzzyScore(query, f) })).filter((x): x is { f: string; s: number } => x.s !== null)
      .sort((a, b) => (query ? a.s - b.s : 0) || Number(b.f.endsWith('/')) - Number(a.f.endsWith('/')) || (query ? a.f.length - b.f.length : a.f.localeCompare(b.f))).slice(0, 50)      // sin escribir: carpetas primero y luego archivos
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
    if (trigger === '/' && g === 'mcp') return (items?.mcp ?? []).map((i) => itemRow('mcp', i))
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
    const groups = GROUPS[trigger].filter((g) => g.startsWith(query) && (g !== 'powers' || items.powers.length > 0)).map(groupRow)          // «#powers» solo si hay Powers (en .tutti o .agents)      // «#stee» propone el grupo #steering
    const all = trigger === '/'
      ? [...groups, ...commands.filter((c) => c.name.toLowerCase().includes(query)).map(cmdRow)]
      : [...groups, ...(GROUPS['#'].filter((g) => g !== 'file' && g !== 'dir') as ItemGroup[]).flatMap((g) => items[g].filter((i) => i.name.toLowerCase().includes(query)).map((i) => itemRow(g, i)))]
    body = rows(all)
  } else if (group) body = rows(inGroup(group))
  else {
    const main = trigger === '#' && items.powers.length > 0 ? ([...MAIN['#'].slice(0, 2), 'powers', ...MAIN['#'].slice(2)] as Group[]) : MAIN[trigger]          // los Powers salen en la lista solo si el proyecto (o el usuario) tiene alguno
    const entries = main.map(groupRow)
    const top = trigger === '/' ? ['clear', 'btw'].map((n) => commands.find((c) => c.name === n)).filter((c): c is ChatCommand => !!c) : []          // los dos comandos de Tutti arriba
    body = [...top.map(cmdRow), ...entries]
  }

  return createPortal(
    <div ref={box} style={{ left: anchor.left, width: anchor.width, bottom: window.innerHeight - anchor.top + 4, maxHeight: Math.min(300, Math.max(160, anchor.top - 14)) }}
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-line bg-panel/85 backdrop-blur-md shadow-[0_6px_18px_-6px_rgba(0,0,0,0.4)]">
      {trigger !== '@' && <div className="shrink-0 px-3 pb-1 pt-2 text-[11px] text-muted">{group && !query ? `${trigger}${group}` : trigger === '#' ? 'Tutti' : t('chat.commandsTitle')}</div>}
      <div className={`min-h-0 flex-1 overflow-y-auto px-1 pb-1${trigger === '@' ? ' pt-1' : ''}`}>{body}</div>
    </div>, document.body
  )
}
