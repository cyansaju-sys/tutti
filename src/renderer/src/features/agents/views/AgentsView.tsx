import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { MdAdd, MdCheckCircle, MdClose, MdDeleteSweep, MdErrorOutline, MdOpenInNew, MdPauseCircle } from 'react-icons/md'
import type { TaskInfo } from '@shared/types'
import { AgentIcon } from '@/features/agents/components/AgentIcon'
import { fmtDelta } from '@/shared/lib/format'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'

/** Duración con segundos mientras es corta (fmtDelta solo llega a minutos). */
const span = (ms: number): string => (ms < 60_000 ? `${Math.max(0, Math.floor(ms / 1000))} s` : fmtDelta(ms))

const SHOWN = 5
const BORDER = { working: 'border-accent', needs_input: 'border-accent', done: 'border-ok/60', blocked: 'border-accent/60', failed: 'border-danger/60', closed: 'border-line' } as const
const STATUS = {
  working: ['ag.working', 'text-accent'], needs_input: ['ag.needsInput', 'text-accent'], done: ['ag.done', 'text-ok'],
  blocked: ['ag.blocked', 'text-accent'], failed: ['ag.failed', 'text-danger'], closed: ['ag.closed', 'text-muted']
} as const
const ICON = { done: <MdCheckCircle size={12} />, blocked: <MdPauseCircle size={12} />, failed: <MdErrorOutline size={12} />, closed: <MdErrorOutline size={12} /> } as const
const busy = (status: TaskInfo['status']): boolean => status === 'working' || status === 'needs_input'

/** Tareas que un agente delegó a otros: a quién, con qué modelo, cuánto lleva y si ya terminó. */
function Tasks() {
  const t = useT()
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [now, setNow] = useState(Date.now())
  const [all, setAll] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const panes = useStore((s) => s.panes)
  useEffect(() => {
    const load = (): void => { void window.api.orchestra.tasks().then((list) => { setTasks(list); setNow(Date.now()) }) }
    load()
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [])
  if (!tasks.length) return null
  const finished = tasks.some((x) => !busy(x.status))
  const running = tasks.filter((x) => busy(x.status)).length
  const shown = all ? tasks : tasks.slice(0, SHOWN)
  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
      <div className="flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        <span>{t('ag.delegated')}{running > 0 && <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] normal-case tracking-normal text-accent">{t('ag.running', { n: running })}</span>}</span>
        {finished && (
          <button onClick={() => void window.api.orchestra.clearTasks().then(() => window.api.orchestra.tasks()).then(setTasks)} title={t('ag.clearDone')}
            className="grid size-6 place-items-center rounded-md transition-colors hover:bg-accent-bg hover:text-accent"><MdDeleteSweep size={15} /></button>
        )}
      </div>
      <ul className="flex flex-col gap-0.5 px-1.5">
        {shown.map((task) => {
          const [label, tone] = STATUS[task.status]
          const open = panes.some((p) => p.id === task.agentId)
          return (
            <li key={task.id} onClick={() => setExpanded(expanded === task.id ? null : task.id)}
              className={clsx('cursor-pointer rounded-md border-l-2 px-2.5 py-1.5 transition-colors hover:bg-accent-bg', BORDER[task.status])}>
              <div className="flex items-center gap-2 text-[12px]">
                <span className={clsx('flex shrink-0 items-center gap-1 text-[10px] font-medium', tone)}>
                  {busy(task.status) ? <span className="size-2 animate-pulse rounded-full bg-accent" /> : ICON[task.status as keyof typeof ICON]}{t(label)}
                </span>
                <span className="min-w-0 flex-1 truncate">{task.agent}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted">{span((task.endedAt ?? now) - task.startedAt)}</span>
                {open && <button title={t('ag.goTo')} onClick={(e) => { e.stopPropagation(); useStore.getState().focusPane(task.agentId) }} className="grid size-5 shrink-0 place-items-center rounded text-muted hover:text-accent"><MdOpenInNew size={12} /></button>}
              </div>
              <div className={clsx('mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-snug text-muted', expanded !== task.id && 'line-clamp-2')}>{task.task}</div>
              {task.question && <div className={clsx('mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-snug text-accent', expanded !== task.id && 'line-clamp-2')}>{t('ag.question')}: {task.question}</div>}
              {task.summary && (
                <div className={clsx('mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-snug', STATUS[task.status][1], expanded !== task.id && 'line-clamp-2')}>
                  {t('ag.summary')}: {task.summary}{expanded === task.id && task.files?.length ? `\n${task.files.join('\n')}` : ''}
                </div>
              )}
              <div className="mt-0.5 truncate text-[10px] text-muted/80">{t('ag.from', { caller: task.caller })}{task.model ? ` · ${task.model}` : ''}{task.difficulty ? ` · ${task.difficulty}` : ''}{task.role ? ` · ${t('ag.role', { role: task.role })}` : ''}</div>
            </li>
          )
        })}
      </ul>
      {tasks.length > SHOWN && (
        <button onClick={() => setAll(!all)} className="mx-1.5 rounded-md px-2.5 py-1 text-left text-[11px] text-muted transition-colors hover:bg-accent-bg hover:text-accent">
          {all ? t('ag.less') : t('ag.all', { n: tasks.length })}
        </button>
      )}
    </div>
  )
}

export function AgentsView() {
  const t = useT()
  const agents = useStore((s) => s.agents)
  const openAgent = useStore((s) => s.openAgent)
  const set = useStore((s) => s.set)
  const refresh = (): void => { void window.api.agents.detect().then((agents) => set({ agents })) }
  useEffect(refresh, [set])   // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (command: string): Promise<void> => { await window.api.agents.removeCustom(command); refresh() }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-3 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {t('ag.title')}
        <button onClick={() => set({ modal: 'addAgent' })} title={t('ag.addTip')} className="grid size-6 place-items-center rounded-md text-muted transition-colors hover:bg-accent-bg hover:text-accent">
          <MdAdd size={15} />
        </button>
      </div>
      {!agents.length && <p className="px-3 py-2 text-[12px] text-muted">{t('ag.none')}</p>}
      <ul className="flex flex-col gap-0.5 px-1.5">
        {agents.map((a) => (
          <li key={a.command} className="group relative">
            <button onClick={() => void openAgent(a)} title={a.path} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-accent-bg">
              <AgentIcon name={a.name} command={a.command} size={20} />
              {a.name}
              {a.custom && <span className="rounded-full bg-ov/[0.05] px-1.5 py-0.5 text-[9px] text-muted">{t('ag.custom')}</span>}
            </button>
            {a.custom && (
              <button onClick={() => void remove(a.command)} title={t('ag.removeTip')} className="absolute right-1.5 top-1/2 hidden size-6 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-[#3a1620] hover:text-danger group-hover:grid">
                <MdClose size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <Tasks />
    </div>
  )
}
