import { MdErrorOutline, MdWarningAmber } from 'react-icons/md'
import { FileIcon } from '@/components/FileIcon'
import { useT } from '@/lib/i18n'
import { basename, relative } from '@/lib/paths'
import { useStore } from '@/store'
import { useProblems } from '../lib/problems'

/** La lista de problemas del proyecto; pulsar uno abre el archivo. */
export function ProblemsPanel() {
  const t = useT()
  const problems = useProblems()
  const project = useStore((s) => s.project)
  const openDoc = useStore((s) => s.openDoc)
  const set = useStore((s) => s.set)
  const open = (path: string): void => { void openDoc(path).then(() => set({ activeDoc: path, focus: 'editor' })) }
  if (!problems.length) return <p className="px-3 py-2 text-[12px] font-light text-muted">{t('pb.none')}</p>
  return (
    <ul className="h-full overflow-y-auto py-1">
      {problems.map((p) => (
        <li key={p.id}>
          <button onClick={() => open(p.path)} className="flex w-full items-center gap-2 px-3 py-[3px] text-left text-[12px] font-light transition-colors hover:bg-accent-bg">
            {p.kind === 'error' ? <MdErrorOutline size={15} className="shrink-0 text-danger" /> : <MdWarningAmber size={15} className="shrink-0 text-warn" />}
            <span className="shrink-0">{p.message}</span>
            <FileIcon name={basename(p.path)} className="size-3.5 shrink-0" />
            <span className="shrink-0">{basename(p.path)}</span>
            <span className="min-w-0 truncate text-muted">{project ? relative(project, p.path).replace(/[^/\\]+$/, '') : ''}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
