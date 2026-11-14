import { clsx } from 'clsx'
import { useState } from 'react'
import { MdChevronRight, MdPlayArrow } from 'react-icons/md'
import type { SpecInfo, SpecsState } from '@/shared/types'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { FileIcon } from '@/renderer/src/shared/components/FileIcon'
import { useStore } from '@/renderer/src/shared/store'
import { applyPrompt } from '@/renderer/src/features/tutti/lib/specs'
import { useAskAgent } from '@/renderer/src/features/tutti/lib/useAskAgent'

const ICON_BUTTON = 'grid size-5 shrink-0 place-items-center rounded text-muted opacity-0 transition-all hover:text-accent group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30'

/** Los archivos que tiene una spec, para abrirlos desde su fila. */
const FILES: Array<{ key: keyof Pick<SpecInfo, 'hasRequirements' | 'hasDesign' | 'hasTasks'>; file: string }> = [
  { key: 'hasRequirements', file: 'requirements.md' }, { key: 'hasDesign', file: 'design.md' }, { key: 'hasTasks', file: 'tasks.md' }
]

/** El contenido de la sección Specs: cada spec de `.tutti/specs` con su avance, sus tres archivos y un botón para implementarla con el agente. */
export function SpecsBody({ state }: { state: SpecsState | null }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const ask = useAskAgent()
  const [open, setOpen] = useState<Set<string>>(new Set())
  if (!state) return null

  const apply = async (name: string): Promise<void> => {
    if (!(await ask.send(applyPrompt(lang, state.rel, name)))) toast(t('sa.noAgent'), 'error')
  }

  return (
    <div>
      {state.specs.length === 0 && <p className="px-2 pl-5 text-[11px] text-muted">{t('sp.noSpecs')}</p>}
      <ul>
        {state.specs.map((c) => {
          const finished = c.total > 0 && c.done === c.total
          return (
            <li key={c.name}>
              <div className="group flex h-7 items-center rounded transition-colors hover:bg-accent-bg">
                <button onClick={() => setOpen((s) => { const n = new Set(s); if (!n.delete(c.name)) n.add(c.name); return n })} aria-expanded={open.has(c.name)} className="flex h-full min-w-0 flex-1 items-center gap-1 px-2 pl-3 text-left text-[12px]">
                  <MdChevronRight size={14} className={clsx('shrink-0 text-muted transition-transform', open.has(c.name) && 'rotate-90')} />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  {c.total > 0 && <span title={t('sp.tasks', { done: c.done, total: c.total })} className={clsx('shrink-0 rounded-full px-1.5 text-[9px] font-medium', finished ? 'bg-accent/20 text-accent' : 'bg-ov/[0.07] text-muted')}>{c.done}/{c.total}</span>}
                </button>
                <button disabled={!ask.selected} title={ask.selected ? t('sp.apply') : t('sa.noAgent')} onClick={() => void apply(c.name)} className={clsx(ICON_BUTTON, 'mr-1')}><MdPlayArrow size={14} /></button>
              </div>
              {open.has(c.name) && FILES.filter((f) => c[f.key]).map((f) => (
                <button key={f.file} onClick={() => void openDoc(`${c.dir}/${f.file}`)} className="flex h-7 w-full items-center gap-2 rounded px-2 pl-9 text-left text-[12px] transition-colors hover:bg-accent-bg">
                  <FileIcon name={f.file} /><span className="truncate">{f.file}</span>
                </button>
              ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
