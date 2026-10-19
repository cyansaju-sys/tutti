import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { MdDelete } from 'react-icons/md'
import type { PlanTemplateInfo, RoleInfo, RolePlanInfo } from '@shared/types'
import { FIELD, Modal } from '@/shared/components/ui'
import { fmtDelta } from '@/shared/lib/format'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'

/** Color de cada estado de un rol (como texto: los trazos del grafo usan currentColor). */
const TONE: Record<RoleInfo['status'], string> = {
  waiting: 'text-muted', ready: 'text-muted', running: 'text-accent', blocked: 'text-accent', failed: 'text-danger', review: 'text-accent', done: 'text-ok'
}
/** Duración con segundos mientras es corta (fmtDelta solo llega a minutos). */
const span = (ms: number): string => (ms < 60_000 ? `${Math.max(0, Math.floor(ms / 1000))} s` : fmtDelta(ms))

/** Columna de cada rol: 0 si no depende de nadie; si no, una más que la de su dependencia más tardía. */
export function depthOf(roles: Array<{ id: string; dependsOn: string[] }>): Map<string, number> {
  const byId = new Map(roles.map((r) => [r.id, r]))
  const memo = new Map<string, number>()
  const depth = (id: string, seen = new Set<string>()): number => {
    if (memo.has(id)) return memo.get(id)!
    if (seen.has(id)) return 0          // un ciclo no debería llegar aquí (el plan se valida), pero no se cuelga
    seen.add(id)
    const d = Math.max(-1, ...(byId.get(id)?.dependsOn ?? []).filter((x) => byId.has(x)).map((x) => depth(x, seen))) + 1
    memo.set(id, d)
    return d
  }
  for (const r of roles) depth(r.id)
  return memo
}

const W = 170, H = 46, GX = 56, GY = 14, PAD = 12

/** Grafo de dependencias: una columna por nivel, una flecha de cada rol a los que esperan por él, coloreado por estado. */
function Graph({ roles }: { roles: RoleInfo[] }) {
  const t = useT()
  const depth = depthOf(roles)
  const columns: RoleInfo[][] = []
  for (const r of roles) (columns[depth.get(r.id) ?? 0] ??= []).push(r)
  const pos = new Map<string, { x: number; y: number }>()
  columns.forEach((col, c) => col.forEach((r, i) => pos.set(r.id, { x: PAD + c * (W + GX), y: PAD + i * (H + GY) })))
  const width = PAD * 2 + columns.length * W + (columns.length - 1) * GX
  const height = PAD * 2 + Math.max(...columns.map((c) => c.length)) * (H + GY) - GY
  const cut = (text: string, n: number): string => (text.length > n ? `${text.slice(0, n - 1)}…` : text)
  return (
    <div className="overflow-auto rounded-md bg-ov/[0.03] p-1">
      <svg width={width} height={height} className="block" role="img" aria-label={t('ag.roles.graph')}>
        {roles.flatMap((r) => r.dependsOn.filter((d) => pos.has(d)).map((d) => {
          const a = pos.get(d)!, b = pos.get(r.id)!
          const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2
          const done = roles.find((x) => x.id === d)?.status === 'done'
          return (
            <path key={`${d}-${r.id}`} d={`M${x1},${y1} C${x1 + GX / 2},${y1} ${x2 - GX / 2},${y2} ${x2 - 4},${y2}`} fill="none"
              className={done ? 'text-ok' : 'text-muted'} stroke="currentColor" strokeOpacity={done ? 0.8 : 0.45} strokeWidth={1.5} markerEnd="url(#arrow)" />
          )
        }))}
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" className="text-muted" fill="currentColor" fillOpacity={0.7} />
          </marker>
        </defs>
        {roles.map((r) => {
          const p = pos.get(r.id)!
          const sub = [t(`ag.roles.${r.status}`), r.agent].filter(Boolean).join(' · ')
          return (
            <g key={r.id} className={TONE[r.status]} transform={`translate(${p.x},${p.y})`}>
              <title>{`${r.name} (${r.id})\n${r.responsibility}`}</title>
              <rect width={W} height={H} rx={6} fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeOpacity={0.55} strokeWidth={r.status === 'running' || r.status === 'review' ? 1.6 : 1} />
              <text x={10} y={19} className="fill-text text-[12px]">{cut(r.name, 22)}</text>
              <text x={10} y={35} fill="currentColor" className="text-[10px]">{cut(sub, 28)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Línea de tiempo: cuándo empezó y acabó cada rol, cuánto tardó y con qué agente y modelo. */
function Timeline({ roles }: { roles: RoleInfo[] }) {
  const t = useT()
  const now = Date.now()
  const started = roles.filter((r) => r.startedAt)
  const t0 = Math.min(...started.map((r) => r.startedAt!))
  const t1 = Math.max(now, ...started.map((r) => r.endedAt ?? now))
  const total = Math.max(1, t1 - t0)
  return (
    <div className="flex flex-col gap-1.5">
      {roles.map((r) => {
        const start = r.startedAt
        const end = r.endedAt ?? (r.status === 'done' ? start : now)
        return (
          <div key={r.id} className="flex items-center gap-2 text-[11px]">
            <span className="w-32 shrink-0 truncate" title={r.name}>{r.name}</span>
            <div className="relative h-4 min-w-0 flex-1 rounded bg-ov/[0.04]">
              {start && (
                <div className={clsx('absolute inset-y-0 rounded', TONE[r.status])}
                  style={{ left: `${((start - t0) / total) * 100}%`, width: `${Math.max(1, ((end! - start) / total) * 100)}%`, backgroundColor: 'currentColor', opacity: r.endedAt ? 0.55 : 0.85 }} />
              )}
            </div>
            <span className={clsx('w-44 shrink-0 truncate text-[10px]', start ? TONE[r.status] : 'text-muted')} title={[r.agent, r.model].filter(Boolean).join(' · ')}>
              {start ? `${span(end! - start)}${r.agent ? ` · ${r.agent}` : ''}${r.model ? ` · ${r.model}` : ''}` : t('ag.roles.notStarted')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** El plan en grande: su grafo de dependencias o su línea de tiempo. */
export function PlanView({ plan, onClose }: { plan: RolePlanInfo; onClose: () => void }) {
  const t = useT()
  const [tab, setTab] = useState<'graph' | 'timeline'>('graph')
  const tabClass = (on: boolean): string => clsx('rounded-md px-2.5 py-1 text-[12px] transition-colors', on ? 'bg-accent-bg text-accent' : 'text-muted hover:text-text')
  return (
    <Modal onClose={onClose} width={760} title={t('ag.roles.view')}>
      <div className="flex max-h-[calc(80vh-4.5rem)] flex-col gap-3 overflow-y-auto px-5 pb-5">
        {plan.summary && <p className="text-[12px] leading-snug text-muted">{plan.summary}</p>}
        <div className="flex gap-1">
          <button onClick={() => setTab('graph')} className={tabClass(tab === 'graph')}>{t('ag.roles.graph')}</button>
          <button onClick={() => setTab('timeline')} className={tabClass(tab === 'timeline')}>{t('ag.roles.timeline')}</button>
        </div>
        {tab === 'graph' ? <Graph roles={plan.roles} /> : <Timeline roles={plan.roles} />}
      </div>
    </Modal>
  )
}

/** Los roles de una plantilla en su orden: «Implementación → Tests → Revisión». */
const chain = (tpl: PlanTemplateInfo): string => {
  const depth = depthOf(tpl.roles)
  return [...tpl.roles].sort((a, b) => (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0)).map((r) => r.name).join(' → ')
}

/** Crea el plan del proyecto desde una plantilla (incluida o guardada por el usuario), con el resumen de qué hay que hacer. */
export function PlanFromTemplate({ project, onDone }: { project: string; onDone: (created: boolean) => void }) {
  const t = useT()
  const [templates, setTemplates] = useState<PlanTemplateInfo[]>([])
  const [picked, setPicked] = useState('')
  const [summary, setSummary] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const load = (): void => { void window.api.orchestra.planTemplates().then((list) => { setTemplates(list); setPicked((p) => (list.some((x) => x.id === p) ? p : list[0]?.id ?? '')) }) }
  useEffect(load, [])
  const create = async (): Promise<void> => {
    const res = await window.api.orchestra.planFromTemplate(project, picked, summary)
    if (res.ok) onDone(true)
    else setErrors(res.errors)
  }
  return (
    <Modal onClose={() => onDone(false)} width={480} title={t('ag.roles.fromTemplate')}>
      <div className="flex max-h-[calc(78vh-4.5rem)] flex-col gap-3 overflow-y-auto px-5 pb-4">
        <ul className="flex flex-col gap-1">
          {templates.map((tpl) => (
            <li key={tpl.id} className={clsx('group flex items-start gap-2 rounded-md border px-2.5 py-2 transition-colors', picked === tpl.id ? 'border-accent bg-accent-bg' : 'border-line hover:border-accent/50')}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                <input type="radio" checked={picked === tpl.id} onChange={() => setPicked(tpl.id)} className="mt-0.5 accent-accent" />
                <span className="min-w-0">
                  <span className="block text-[12px]">{tpl.name}{tpl.builtin && <span className="ml-1.5 text-[10px] text-muted">{t('ag.roles.builtin')}</span>}</span>
                  <span className="block truncate text-[11px] text-muted">{chain(tpl)}</span>
                </span>
              </label>
              {!tpl.builtin && (
                <button onClick={() => void window.api.orchestra.deletePlanTemplate(tpl.id).then(load)} title={t('ag.roles.deletePlanTemplate')}
                  className="grid size-6 shrink-0 place-items-center rounded text-muted opacity-0 transition-colors hover:text-danger group-hover:opacity-100"><MdDelete size={14} /></button>
              )}
            </li>
          ))}
        </ul>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">{t('ag.roles.summaryLabel')}</span>
          <textarea autoFocus className={clsx(FIELD, 'min-h-[72px] resize-y')} value={summary} onChange={(e) => setSummary(e.target.value)} spellCheck={false} />
        </label>
        {errors.length > 0 && <ul className="text-[12px] leading-snug text-danger">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="flex justify-end gap-2">
          <button onClick={() => onDone(false)} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('ag.roles.cancel')}</button>
          <button disabled={!picked || !summary.trim()} onClick={() => void create()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110 disabled:opacity-40">{t('ag.roles.create')}</button>
        </div>
      </div>
    </Modal>
  )
}

/** Guarda los roles del plan actual como plantilla de plan. */
export function SavePlanTemplate({ project, onDone }: { project: string; onDone: () => void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const save = async (): Promise<void> => {
    const res = await window.api.orchestra.savePlanTemplate(project, name)
    if (!res.ok) { setErrors(res.errors); return }
    useStore.getState().toast(t('ag.roles.planSaved'), 'ok')
    onDone()
  }
  return (
    <Modal onClose={onDone} width={380} title={t('ag.roles.savePlan')}>
      <div className="flex flex-col gap-3 px-5 pb-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">{t('ag.roles.planName')}</span>
          <input autoFocus className={FIELD} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save() }} spellCheck={false} />
        </label>
        {errors.length > 0 && <ul className="text-[12px] leading-snug text-danger">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="flex justify-end gap-2">
          <button onClick={onDone} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('ag.roles.cancel')}</button>
          <button disabled={!name.trim()} onClick={() => void save()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110 disabled:opacity-40">{t('ag.roles.save')}</button>
        </div>
      </div>
    </Modal>
  )
}
