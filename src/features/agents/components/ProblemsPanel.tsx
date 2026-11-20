import { clsx } from 'clsx'
import { useState } from 'react'
import { MdErrorOutline, MdKeyboardArrowDown, MdWarningAmber } from 'react-icons/md'
import { FileIcon } from '@/components/FileIcon'
import { useT } from '@/lib/i18n'
import { basename, relative } from '@/lib/paths'
import { useStore } from '@/store'
import { useProblems } from '../lib/problems'

/** ¿Coincide el problema con el filtro? Términos separados por coma: texto suelto, globs (como «src/**\/*.ts») y «!» para excluir. */
export function matchesFilter(filter: string, text: string, rel: string): boolean {
  const terms = filter.split(',').map((x) => x.trim()).filter(Boolean)
  if (!terms.length) return true
  const test = (term: string): boolean => {
    if (!/[*?]/.test(term)) return `${text}\n${rel}`.toLowerCase().includes(term.toLowerCase())
    const re = new RegExp('^' + term.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$', 'i')
    return re.test(rel) || re.test(rel.split('/').pop() ?? '')
  }
  const hit = terms.filter((x) => !x.startsWith('!'))
  const skip = terms.filter((x) => x.startsWith('!')).map((x) => x.slice(1)).filter(Boolean)
  return (!hit.length || hit.some(test)) && !skip.some(test)
}

/** La lista de problemas del proyecto; pulsar uno abre el archivo. */
export function ProblemsPanel({ filter = '' }: { filter?: string }) {
  const t = useT()
  const all = useProblems()
  const project = useStore((s) => s.project)
  const openDoc = useStore((s) => s.openDoc)
  const set = useStore((s) => s.set)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (path: string): void => setCollapsed((c) => { const n = new Set(c); if (!n.delete(path)) n.add(path); return n })
  const open = (path: string): void => { void openDoc(path).then(() => set({ activeDoc: path, focus: 'editor' })) }
  const problems = all.filter((p) => matchesFilter(filter, p.message, project ? relative(project, p.path).replace(/\\/g, '/') : p.path))
  if (!problems.length) return <p className="px-3 py-2 text-[11px] font-light text-muted">{t(all.length ? 'pb.noMatch' : 'pb.none')}</p>
  // agrupados por archivo, como el panel Problemas de VS Code
  const groups = new Map<string, typeof problems>()
  for (const p of problems) groups.set(p.path, [...(groups.get(p.path) ?? []), p])
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-2">
      {[...groups].map(([path, list]) => {
        const closed = collapsed.has(path)
        const dir = project ? relative(project, path).replace(/[^/\\]+$/, '').replace(/[/\\]$/, '') : ''
        return (
          <div key={path} className="shrink-0 overflow-hidden rounded-lg border border-line bg-ov/[0.025]">
            <div className={clsx('flex items-center gap-1.5 px-2 py-1 text-[11px] transition-colors hover:bg-accent-bg', !closed && 'border-b border-line')}>
              <button onClick={() => toggle(path)} className="grid size-4 shrink-0 place-items-center text-muted"><MdKeyboardArrowDown size={15} className={closed ? '-rotate-90' : ''} /></button>
              <button onClick={() => open(path)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                <FileIcon name={basename(path)} className="size-3.5 shrink-0" />
                <span className="shrink-0">{basename(path)}</span>
                {dir && <span className="min-w-0 truncate text-muted">{dir}</span>}
                <span className="ml-auto shrink-0 rounded-full bg-accent/30 px-1.5 text-[10px] leading-4">{list.length}</span>
              </button>
            </div>
            {!closed && list.map((p) => (
              <button key={p.id} onClick={() => open(p.path)} className="flex w-full items-start gap-2 px-3 py-1 text-left text-[11px] font-light transition-colors hover:bg-accent-bg">
                {p.kind === 'error' ? <MdErrorOutline size={15} className="shrink-0 text-danger" /> : <MdWarningAmber size={15} className="shrink-0 text-warn" />}
                <span className="min-w-0 break-words">{p.message}{p.line ? <span className="ml-1.5 text-muted">[Ln {p.line}]</span> : null}</span>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
