import { clsx } from 'clsx'
import { useEffect, useState, type ReactNode } from 'react'
import { MdAccountTree, MdAdd, MdCallSplit, MdCloudQueue } from 'react-icons/md'
import type { GitBranch } from '@/shared/types'
import { ago } from '@/renderer/src/shared/lib/format'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { refreshGit } from '@/renderer/src/features/git/lib/gitSync'
import { useStore } from '@/renderer/src/shared/store'
import { Modal } from '@/renderer/src/shared/components/ui'
import { Rich } from './helpers'
import { Palette } from './Palette'
import { Tag } from './parts'

type BranchItem =
  | { kind: 'new' } | { kind: 'newFrom' } | { kind: 'detach' } | { kind: 'worktrees' } | { kind: 'create'; name: string }
  | { kind: 'branch'; b: GitBranch }
type Step = { step: 'list' } | { step: 'base'; detach: boolean } | { step: 'name'; base?: string; initial: string }

/** Selector de ramas al estilo de VS Code: acciones arriba (crear, crear desde…, desproteger) y las ramas con su último commit. */
export function BranchPicker() {
  const t = useT()
  const set = useStore((s) => s.set)
  const project = useStore((s) => s.project)!
  const toast = useStore((s) => s.toast)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [view, setView] = useState<Step>({ step: 'list' })
  useEffect(() => { void window.api.git.branches(project).then(setBranches) }, [project])
  const done = async (error: string): Promise<void> => {
    await refreshGit()
    if (error) toast(error, 'error'); else set({ modal: null })
  }
  const close = (): void => set({ modal: null })

  if (view.step === 'name') {
    return (
      <Modal onClose={close} width={560}>
        <NameStep initial={view.initial} base={view.base} branches={branches} project={project} onBack={() => setView({ step: 'list' })} onDone={done} />
      </Modal>
    )
  }
  const picking = view.step === 'base'
  const row = (b: GitBranch, active: boolean): ReactNode => (
    <>
      {b.remote ? <MdCloudQueue size={16} className={clsx('mt-0.5 shrink-0', active ? 'text-accent' : 'text-muted')} /> : <MdCallSplit size={16} className={clsx('mt-0.5 shrink-0', active ? 'text-accent' : 'text-muted')} />}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={clsx('truncate', b.current && 'font-semibold')}>{b.name}</span>
          {b.date && <span className="shrink-0 text-[11px] text-muted">{ago(b.date)}</span>}
          {b.current && <Tag tone="accent">{t('br.current')}</Tag>}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted">{[b.author, b.hash, b.subject].filter(Boolean).join(' • ')}</span>
      </span>
    </>
  )
  const action = (icon: ReactNode, text: string): ReactNode => <><span className="mt-0.5 shrink-0 text-muted">{icon}</span><span>{text}</span></>
  return (
    <Modal onClose={close} width={560}>
      <Palette<BranchItem>
        placeholder={picking ? (view.detach ? t('br.pickDetach') : t('br.pickBase')) : t('br.placeholder')}
        items={[...branches.filter((b) => !b.remote), ...branches.filter((b) => b.remote)].map((b) => ({ kind: 'branch' as const, b }))} empty={t('br.noMatch')}
        label={(i) => (i.kind === 'branch' ? i.b.name : i.kind === 'create' ? `create:${i.name}` : i.kind)}
        group={(i) => (i.kind === 'branch' ? (i.b.remote ? t('br.remoteGroup') : t('br.group')) : '')}
        extra={(q) => {
          if (picking) return []
          if (q && !branches.some((b) => b.name === q)) return [{ kind: 'create', name: q.replace(/\s+/g, '-') }]
          return [{ kind: 'new' }, { kind: 'newFrom' }, { kind: 'detach' }, { kind: 'worktrees' }]
        }}
        render={(i, active) => {
          if (i.kind === 'branch') return row(i.b, active)
          if (i.kind === 'create') return action(<MdAdd size={16} />, t('br.createNamed', { name: i.name }))
          if (i.kind === 'new') return action(<MdAdd size={16} />, t('br.createNew'))
          if (i.kind === 'newFrom') return action(<MdAdd size={16} />, t('br.createFrom'))
          if (i.kind === 'worktrees') return action(<MdAccountTree size={16} />, t('br.worktrees'))
          return action(<MdCallSplit size={16} />, t('br.detach'))
        }}
        onPick={(i, query) => {
          if (!i) { if (query.trim() && !picking) setView({ step: 'name', initial: query.trim().replace(/\s+/g, '-') }); return }
          if (i.kind === 'new') setView({ step: 'name', initial: '' })
          else if (i.kind === 'create') setView({ step: 'name', initial: i.name })
          else if (i.kind === 'newFrom') setView({ step: 'base', detach: false })
          else if (i.kind === 'detach') setView({ step: 'base', detach: true })
          else if (i.kind === 'worktrees') set({ modal: 'worktrees' })
          else if (picking && view.detach) void window.api.git.checkoutDetached(project, i.b.name).then(done)
          else if (picking) setView({ step: 'name', initial: '', base: i.b.name })
          else if (!i.b.current) void window.api.git.checkout(project, i.b.name, i.b.remote).then(done)
          else close()
        }}
      />
    </Modal>
  )
}

/** Último paso de «nueva rama»: solo el nombre (Enter crea y te cambia a ella; Esc cancela). */
function NameStep({ initial, base, branches, project, onBack, onDone }: {
  initial: string; base?: string; branches: GitBranch[]; project: string; onBack: () => void; onDone: (error: string) => Promise<void>
}) {
  const t = useT()
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  const valid = /^(?!-)[A-Za-z0-9._/-]+$/.test(name) && !name.includes('..') && !name.includes('//') && !/[/.]$/.test(name) && !name.endsWith('.lock')
  const taken = branches.some((b) => !b.remote && b.name === name)
  const from = base ?? branches.find((b) => b.current)?.name ?? 'HEAD'
  const create = async (): Promise<void> => {
    if (!valid || taken || busy) return
    setBusy(true)
    const error = await window.api.git.createBranch(project, name, base, true)
    setBusy(false)
    await onDone(error)
  }
  const problem = name && !valid ? t('br.invalid') : taken ? t('br.taken') : ''
  return (
    <div>
      <div className="p-1.5 pb-1">
        <div className={clsx('flex items-center rounded-md border bg-ov/[0.04] px-2.5', problem ? 'border-danger/70' : 'border-transparent')}>
          <input autoFocus value={name} spellCheck={false} placeholder={t('br.namePlaceholder')}
            onChange={(e) => setName(e.target.value.replace(/\s+/g, '-'))}
            onKeyDown={(e) => { if (e.key === 'Enter') void create(); else if (e.key === 'Escape') { e.stopPropagation(); onBack() } }}
            className="h-8 flex-1 bg-transparent text-[13px] caret-accent outline-none placeholder:text-muted/80" />
        </div>
      </div>
      <p className={clsx('px-3 pb-2 pt-1 text-[11px]', problem ? 'text-danger' : 'text-muted')}>
        {problem || (busy ? t('br.creating') : <Rich text={t('br.willCreate', { from: '\u0001' })} node={<span className="text-text">{from}</span>} />)}
      </p>
    </div>
  )
}
