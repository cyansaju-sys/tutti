import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { MdAccountTree, MdAdd, MdCallSplit, MdDeleteOutline, MdSmartToy } from 'react-icons/md'
import type { GitBranch, GitWorktree } from '@shared/types'
import { confirmAsk } from '@/shared/lib/confirm'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { basename } from '@/shared/lib/paths'
import { AgentIcon } from '@/features/agents/components/AgentIcon'
import { Modal } from '@/shared/components/ui'
import { Palette } from './Palette'
import { Tag } from './parts'

type WtItem = { kind: 'wt'; w: GitWorktree } | { kind: 'new' } | { kind: 'newAgent' } | { kind: 'branch'; b: GitBranch } | { kind: 'create'; name: string }

/** Árboles de trabajo (git worktree): abrir uno como proyecto, crear uno para una rama (existente o nueva) o quitarlo. */
export function WorktreeDialog() {
  const t = useT()
  const set = useStore((s) => s.set)
  const setProject = useStore((s) => s.setProject)
  const project = useStore((s) => s.project)!
  const toast = useStore((s) => s.toast)
  const [list, setList] = useState<GitWorktree[]>([])
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [picking, setPicking] = useState(false)
  const [withAgent, setWithAgent] = useState(false)          // tras crear el worktree se abre un agente en él (sin cambiar de proyecto)
  const [agentIn, setAgentIn] = useState<{ dir: string; label: string } | null>(null)
  const agents = useStore((s) => s.agents)
  const openAgent = useStore((s) => s.openAgent)
  const load = (): void => { void window.api.git.worktrees(project).then(setList) }
  useEffect(() => { load(); void window.api.git.branches(project).then(setBranches); void window.api.agents.detect().then((a) => set({ agents: a })) }, [project])  // eslint-disable-line react-hooks/exhaustive-deps
  const close = (): void => set({ modal: null })
  const free = branches.filter((b) => !b.remote && !list.some((w) => w.branch === b.name))
  const name = (w: GitWorktree): string => w.branch ?? basename(w.path)

  const create = async (branch: string, isNew: boolean): Promise<void> => {
    const res = await window.api.git.addWorktree(project, branch, isNew)
    if (!res.ok) { toast(res.message, 'error'); return }
    toast(t('wt.created', { dir: res.message }), 'ok')
    if (withAgent) { setAgentIn({ dir: res.message, label: branch }); return }
    close()
    setProject(res.message)
  }
  const remove = async (w: GitWorktree): Promise<void> => {
    if (!(await confirmAsk(t('wt.confirmRemove', { name: name(w) })))) return
    let error = await window.api.git.removeWorktree(project, w.path, false)
    if (error && /modified|untracked|contains/i.test(error) && (await confirmAsk(t('wt.confirmForce', { name: name(w) })))) error = await window.api.git.removeWorktree(project, w.path, true)
    if (error) toast(error, 'error'); else toast(t('wt.removed'), 'ok')
    load()
  }

  if (agentIn) {
    return (
      <Modal onClose={close} width={560}>
        <Palette
          placeholder={t('wt.pickAgent', { name: agentIn.label })} items={agents} label={(a) => a.name} empty={agents.length ? t('dlg.noAgentMatch') : t('dlg.noAgents')}
          render={(a) => (<><span className="grid size-7 shrink-0 place-items-center"><AgentIcon name={a.name} command={a.command} size={22} /></span><span className="flex-1 truncate">{a.name}</span><Tag>{a.command}</Tag></>)}
          onPick={(a) => { if (a) void openAgent(a, [], { cwd: agentIn.dir, title: `${a.name} · ${agentIn.label}` }) }}
        />
      </Modal>
    )
  }
  const items: WtItem[] = picking ? free.map((b) => ({ kind: 'branch' as const, b })) : list.map((w) => ({ kind: 'wt' as const, w }))
  return (
    <Modal onClose={close} width={560}>
      <Palette<WtItem>
        placeholder={picking ? t('wt.pickBranch') : t('wt.placeholder')} items={items} empty={picking ? t('wt.noBranch') : t('wt.empty')}
        label={(i) => (i.kind === 'wt' ? `wt:${i.w.path}` : i.kind === 'branch' ? i.b.name : i.kind === 'create' ? `create:${i.name}` : i.kind)}
        group={(i) => (i.kind === 'wt' ? t('wt.group') : i.kind === 'branch' ? t('br.group') : '')}
        extra={(q) => (picking ? (q && !branches.some((b) => b.name === q) ? [{ kind: 'create', name: q.replace(/\s+/g, '-') }] : []) : [{ kind: 'new' }, { kind: 'newAgent' }])}
        render={(i, active) => {
          if (i.kind === 'new') return <><span className="mt-0.5 shrink-0 text-muted"><MdAdd size={16} /></span><span>{t('wt.new')}</span></>
          if (i.kind === 'newAgent') return <><span className="mt-0.5 shrink-0 text-muted"><MdSmartToy size={16} /></span><span>{t('wt.newAgent')}</span></>
          if (i.kind === 'create') return <><span className="mt-0.5 shrink-0 text-muted"><MdAdd size={16} /></span><span>{t('wt.createNamed', { name: i.name })}</span></>
          if (i.kind === 'branch') return <><MdCallSplit size={16} className={clsx('mt-0.5 shrink-0', active ? 'text-accent' : 'text-muted')} /><span className="truncate">{i.b.name}</span></>
          const w = i.w
          return (
            <>
              <MdAccountTree size={16} className={clsx('mt-0.5 shrink-0', active ? 'text-accent' : 'text-muted')} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={clsx('truncate', w.current && 'font-semibold')}>{w.branch ?? t('wt.detached')}</span>
                  {w.current && <Tag tone="accent">{t('wt.current')}</Tag>}
                  {w.main && <Tag>{t('wt.main')}</Tag>}
                  {w.locked && <Tag>{t('wt.locked')}</Tag>}
                  {w.prunable && <Tag>{t('wt.prunable')}</Tag>}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">{[w.hash, w.path].filter(Boolean).join(' • ')}</span>
              </span>
              <span role="button" title={t('wt.openAgent')} onClick={(e) => { e.stopPropagation(); setAgentIn({ dir: w.path, label: name(w) }) }}
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded text-muted hover:bg-line hover:text-accent"><MdSmartToy size={14} /></span>
              {!w.main && !w.current && (
                <span role="button" title={t('wt.remove')} onClick={(e) => { e.stopPropagation(); void remove(w) }}
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded text-muted hover:bg-line hover:text-danger"><MdDeleteOutline size={14} /></span>
              )}
            </>
          )
        }}
        onPick={(i, query) => {
          if (!i) { if (picking && query.trim()) void create(query.trim().replace(/\s+/g, '-'), true); return }
          if (i.kind === 'new') { setWithAgent(false); setPicking(true) }
          else if (i.kind === 'newAgent') { setWithAgent(true); setPicking(true) }
          else if (i.kind === 'create') void create(i.name, true)
          else if (i.kind === 'branch') void create(i.b.name, false)
          else if (i.w.current) close()
          else { close(); setProject(i.w.path) }
        }}
      />
    </Modal>
  )
}
