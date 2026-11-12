import { clsx } from 'clsx'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useT } from '@/shared/lib/i18n'
import { Kbd } from '@/shared/components/ui'
import { matches } from './helpers'

/**
 * Selector rápido (estilo de los de VS Code): barra de búsqueda sin borde de foco arriba y filas planas debajo. ↑↓ eligen, Enter acepta.
 * `extra` son filas que no se filtran (acciones) y van primero; `group` separa con una línea y rotula a la derecha; `footer` va bajo la lista.
 */
export function Palette<T>({ placeholder, items, label, render, onPick, empty, footer, group, extra, initial, emptyInitial, start, onActive }: {
  placeholder: string; items: T[]; initial?: T[]; emptyInitial?: string; label: (i: T) => string; render: (i: T, active: boolean) => ReactNode
  onPick: (i: T, query: string) => void; empty: string; footer?: (query: string) => ReactNode; group?: (i: T) => string
  extra?: (query: string) => T[]
  start?: number          // la fila resaltada al abrir (sin texto escrito)
  onActive?: (i: T | undefined) => void          // vista previa: se llama con la fila resaltada cada vez que cambia, y con undefined al cerrar
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(start ?? 0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const shown = useMemo(() => [...(extra?.(query.trim()) ?? []), ...(initial && !query ? initial : items.filter((i) => matches(label(i), query)))], [items, initial, query, extra])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => input.current?.focus(), [])
  useEffect(() => setIndex(query ? 0 : start ?? 0), [query])  // eslint-disable-line react-hooks/exhaustive-deps
  const active = shown[index]
  useEffect(() => { onActive?.(active) }, [active])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onActive?.(undefined), [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [index, shown])
  const key = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') { setIndex((i) => Math.min(i + 1, shown.length - 1)); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setIndex((i) => Math.max(i - 1, 0)); e.preventDefault() }
    else if (e.key === 'Enter') { if (shown[index]) onPick(shown[index], query); else if (query) onPick(undefined as T, query) }
  }
  let lastGroup = ''
  return (
    <div>
      <div className="p-1.5 pb-1">
        <div className="flex items-center rounded-md bg-ov/[0.04] px-2.5">
          <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={key} placeholder={placeholder}
            spellCheck={false} className="h-8 flex-1 bg-transparent text-[12px] caret-accent outline-none placeholder:text-muted/80" />
          {query && <span className="rounded bg-ov/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted">{shown.length}</span>}
        </div>
      </div>
      <ul ref={list} className="max-h-[420px] overflow-y-auto pb-1">
        {shown.map((item, i) => {
          const g = group?.(item) ?? ''
          const heading = g && g !== lastGroup ? g : ''
          lastGroup = g || lastGroup
          const active = i === index
          return (
            <li key={label(item)}>
              {heading && i > 0 && <div className="mx-0 my-1 border-t border-ov/[0.08]" />}
              {heading && <div className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/80">{heading}</div>}
              <button data-active={active} onMouseMove={() => setIndex(i)} onClick={() => onPick(item, query)}
                className={clsx('relative flex w-full items-start gap-2.5 px-3 py-1.5 text-left text-[12px] transition-colors', active ? 'bg-accent/[0.18]' : 'hover:bg-ov/[0.04]')}>
                {render(item, active)}
              </button>
            </li>
          )
        })}
        {shown.length === 0 && !footer && <li className="px-3 py-4 text-center text-[12px] text-muted">{initial && !query && emptyInitial ? emptyInitial : empty}</li>}
      </ul>
      {footer?.(query)}
      <div className="flex items-center gap-4 border-t border-ov/[0.06] bg-black/20 px-3 py-1.5 text-[10px] text-muted">
        <span><Kbd>↑↓</Kbd> {t('dlg.navigate')}</span><span><Kbd>↵</Kbd> {t('dlg.choose')}</span><span><Kbd>esc</Kbd> {t('dlg.closeKey')}</span>
      </div>
    </div>
  )
}
