import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { MdCheckCircle, MdChevronRight, MdDelete } from 'react-icons/md'
import type { RoleAgentOption, RoleInfo, RolePlanInfo } from '@shared/types'
import { FIELD, Modal, Select } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'

const PLAN_TONE = { proposed: 'bg-ov/[0.06] text-muted', reviewed: 'bg-accent/15 text-accent', approved: 'bg-ok/15 text-ok' } as const
const ROLE_TONE = { waiting: 'text-muted', ready: 'text-muted', running: 'text-accent', done: 'text-ok' } as const
const lines = (text: string): string[] => text.split('\n').map((l) => l.trim()).filter(Boolean)

/** Edita un rol que aún no empezó: sus campos y, a mano, el agente y el modelo que lo harán (en automático los elige Tutti). */
function RoleEditor({ project, role, others, manual, onDone }: { project: string; role: RoleInfo; others: RoleInfo[]; manual: boolean; onDone: (plan: RolePlanInfo | null) => void }) {
  const t = useT()
  const [name, setName] = useState(role.name)
  const [resp, setResp] = useState(role.responsibility)
  const [deliv, setDeliv] = useState(role.deliverables.join('\n'))
  const [done, setDone] = useState(role.done)
  const [files, setFiles] = useState(role.files.join('\n'))
  const [difficulty, setDifficulty] = useState(role.difficulty)
  const [deps, setDeps] = useState<string[]>(role.dependsOn)
  const [agent, setAgent] = useState(role.assign?.agent ?? '')
  const [model, setModel] = useState(role.assign?.model ?? '')
  const [options, setOptions] = useState<RoleAgentOption[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  useEffect(() => { void window.api.orchestra.roleOptions(project).then(setOptions) }, [project])
  const chosen = options?.find((o) => o.value === agent)
  const save = async (): Promise<void> => {
    const res = await window.api.orchestra.updateRole(project, role.id, {
      name, responsibility: resp, deliverables: lines(deliv), done, files: lines(files), difficulty, dependsOn: deps,
      assign: agent ? { agent, ...(model && chosen?.canSetModel !== false ? { model } : {}) } : null
    })
    if (res.ok) onDone(await window.api.orchestra.roles(project))
    else setErrors(res.errors)
  }
  const field = (label: string, el: React.ReactNode): React.ReactNode => (
    <label className="flex flex-col gap-1"><span className="text-[11px] text-muted">{label}</span>{el}</label>
  )
  const area = 'min-h-[56px] resize-y'
  return (
    <Modal onClose={() => onDone(null)} width={480} title={t('ag.roles.edit')}>
      <div className="flex max-h-[calc(78vh-4.5rem)] flex-col gap-3 overflow-y-auto px-5 pb-4">
        {field(t('ag.roles.f.name'), <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} spellCheck={false} autoFocus />)}
        {field(t('ag.roles.f.resp'), <textarea className={clsx(FIELD, area)} value={resp} onChange={(e) => setResp(e.target.value)} spellCheck={false} />)}
        {field(t('ag.roles.f.deliv'), <textarea className={clsx(FIELD, area)} value={deliv} onChange={(e) => setDeliv(e.target.value)} spellCheck={false} />)}
        {field(t('ag.roles.f.done'), <textarea className={clsx(FIELD, area)} value={done} onChange={(e) => setDone(e.target.value)} spellCheck={false} />)}
        {field(t('ag.roles.f.files'), <textarea className={clsx(FIELD, area)} value={files} onChange={(e) => setFiles(e.target.value)} spellCheck={false} />)}
        {field(t('ag.roles.f.diff'), (
          <Select value={difficulty} onChange={(v) => setDifficulty(v as RoleInfo['difficulty'])} options={[{ value: 'easy', label: 'easy' }, { value: 'medium', label: 'medium' }, { value: 'hard', label: 'hard' }]} />
        ))}
        {others.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted">{t('ag.roles.f.deps')}</span>
            {others.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={deps.includes(o.id)} onChange={(e) => setDeps(e.target.checked ? [...deps, o.id] : deps.filter((d) => d !== o.id))} className="accent-accent" />
                <span className="truncate">{o.name}</span>
              </label>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {field(t('ag.roles.f.agent'), (
            <Select value={agent} onChange={(v) => { setAgent(v); setModel('') }} options={[
              { value: '', label: manual ? t('ag.roles.pickAgent') : t('ag.roles.auto') },
              ...(agent && options && !chosen ? [{ value: agent, label: t('ag.roles.gone', { agent }) }] : []),
              ...(options ?? []).map((o) => ({ value: o.value, label: o.label }))
            ]} />
          ))}
          {field(t('ag.roles.f.model'), (
            <Select value={model} onChange={setModel} disabled={!agent || !chosen?.canSetModel || !chosen.models.length} title={chosen && !chosen.canSetModel ? t('ag.roles.fixedModel') : undefined} options={[
              { value: '', label: manual ? t('ag.roles.agentDefault') : t('ag.roles.auto') },
              ...(chosen?.models ?? []).map((m) => ({ value: m.id, label: `${m.id} · ${m.tier}` }))
            ]} />
          ))}
        </div>
        {chosen && !chosen.canSetModel && <p className="-mt-1.5 text-[11px] text-muted">{t('ag.roles.fixedModel')}</p>}
        {errors.length > 0 && <ul className="text-[12px] leading-snug text-danger">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="flex justify-end gap-2">
          <button onClick={() => onDone(null)} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('ag.roles.cancel')}</button>
          <button onClick={() => void save()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110">{t('ag.roles.save')}</button>
        </div>
      </div>
    </Modal>
  )
}

/** Clave de localStorage: si la sección está plegada (como la raíz del proyecto en el explorador). */
const FOLD_KEY = 'tutti.files.rolesCollapsed'

/**
 * El plan de roles del proyecto, en el explorador: qué hace cada rol, quién lo tiene y, si el líder lo dejó revisado, el botón para aprobarlo.
 * Sección plegable como la raíz del proyecto; no sale si no hay plan.
 */
export function RolesPlan() {
  const t = useT()
  const project = useStore((s) => s.project)
  const [plan, setPlan] = useState<RolePlanInfo | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(FOLD_KEY) !== '1' } catch { return true } })
  const toggle = (): void => setOpen((o) => { try { localStorage.setItem(FOLD_KEY, o ? '1' : '0') } catch { /* sin almacenamiento */ } return !o })
  useEffect(() => {
    if (!project) { setPlan(null); return }
    const load = (): void => { void window.api.orchestra.roles(project).then(setPlan) }
    load()
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [project])
  if (!project || !plan) return null
  const running = plan.roles.some((r) => r.status === 'running')
  const missing = plan.assignment === 'manual' && plan.roles.some((r) => r.status !== 'done' && !r.assign && !r.agent)          // falta elegir el agente de algún rol
  const idle = plan.status === 'approved' && !plan.started          // aprobado pero sin repartir: p. ej. tras reiniciar la app
  const finished = plan.roles.filter((r) => r.status === 'done').length
  const nameOf = (id: string): string => plan.roles.find((x) => x.id === id)?.name ?? id
  const act = (call: Promise<boolean>): void => { void call.then(() => window.api.orchestra.roles(project)).then(setPlan) }
  return (
    <section className="shrink-0 border-t border-line pt-1">
      <div className="flex items-center justify-between pl-3 pr-2 pb-1">
        <button onClick={toggle} aria-expanded={open} className="flex min-w-0 items-center gap-0.5 rounded px-1 py-1 text-left transition-colors hover:text-accent">
          <MdChevronRight size={14} className={clsx('shrink-0 text-muted transition-transform', open && 'rotate-90')} />
          <span className="truncate text-[12px] font-semibold">{t('ag.roles')}</span>
          <span className="ml-1 rounded-full bg-accent/25 px-2 py-px text-[10px] font-semibold text-accent">{finished}/{plan.roles.length}</span>
          {plan.status === 'reviewed' && <span title={t('ag.roles.reviewed')} className="ml-1.5 size-2 shrink-0 animate-pulse rounded-full bg-accent" />}
        </button>
        {!running && <button onClick={() => act(window.api.orchestra.discardRoles(project))} title={t('ag.roles.discard')} className="grid size-[26px] place-items-center rounded-md text-muted transition-colors hover:bg-[#3a1620] hover:text-danger"><MdDelete size={16} /></button>}
      </div>
      {open && (
        <div className="sect-scroll max-h-[45vh] overflow-y-auto pb-2">
          <div className="px-3 pb-1"><span className={clsx('rounded-full px-1.5 py-0.5 text-[9px]', PLAN_TONE[plan.status])}>{idle ? t('ag.roles.paused') : t(`ag.roles.${plan.status}`)}</span></div>
          {plan.problem && <p className="px-3 pb-1 text-[11px] leading-snug text-danger">{plan.problem}</p>}
          {plan.summary && <p className="line-clamp-2 px-3 pb-1 text-[11px] leading-snug text-muted">{plan.summary}</p>}
          <ul className="flex flex-col gap-0.5 px-1">
            {plan.roles.map((r) => {
              const waiting = r.dependsOn.filter((d) => plan.roles.find((x) => x.id === d)?.status !== 'done').map(nameOf)
              const editable = r.status === 'waiting' || r.status === 'ready'
              const needsAgent = plan.assignment === 'manual' && !r.assign && !r.agent && r.status !== 'done'
              const state = r.status === 'waiting' ? t('ag.roles.waiting', { roles: waiting.join(', ') }) : r.status === 'ready' && needsAgent ? t('ag.roles.pick') : t(`ag.roles.${r.status}`)
              const who = r.agent ?? (r.assign ? t('ag.roles.manual', { agent: r.assign.agent }) : null)
              const modelShown = r.agent ? r.model : r.assign?.model
              return (
                <li key={r.id}>
                  <button disabled={!editable} onClick={() => setEditing(editing === r.id ? null : r.id)} title={editable ? t('ag.roles.edit') : t('ag.roles.locked')}
                    className={clsx('flex w-full flex-col gap-0.5 rounded-[4px] py-1 pl-3.5 pr-1.5 text-left transition-colors', editable ? 'hover:bg-accent-bg' : 'cursor-default', editing === r.id && 'bg-accent-bg')}>
                    <span className="flex items-center gap-1.5 text-[12px]">
                      {r.status === 'running' ? <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" /> : r.status === 'done' ? <MdCheckCircle size={12} className="shrink-0 text-ok" /> : <span className="size-2 shrink-0 rounded-full border border-muted" />}
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      <span className="shrink-0 text-[10px] text-muted">{r.difficulty}</span>
                    </span>
                    <span className={clsx('truncate pl-3.5 text-[10px]', needsAgent && r.status !== 'running' ? 'text-accent' : ROLE_TONE[r.status])}>{state}{who ? ` · ${who}` : ''}{modelShown ? ` · ${modelShown}` : ''}</span>
                    {r.note && !needsAgent && <span className="line-clamp-2 pl-3.5 text-[10px] leading-snug text-danger/90">{r.note}</span>}
                  </button>
                  {editing === r.id && <RoleEditor project={project} role={r} others={plan.roles.filter((x) => x.id !== r.id)} manual={plan.assignment === 'manual'} onDone={(next) => { if (next) setPlan(next); setEditing(null) }} />}
                </li>
              )
            })}
          </ul>
          {idle && (
            <button onClick={() => act(window.api.orchestra.startRoles(project))} className="mx-2 mt-1.5 w-[calc(100%-1rem)] rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-bg transition-opacity hover:opacity-90">{t('ag.roles.start')}</button>
          )}
          {plan.status === 'reviewed' && (
            <>
              {missing && <p className="px-3 pt-1.5 text-[11px] leading-snug text-muted">{t('ag.roles.needAgents')}</p>}
              <button disabled={missing} onClick={() => act(window.api.orchestra.approveRoles(project))} className="mx-2 mt-1.5 w-[calc(100%-1rem)] rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40">{t('ag.roles.approve')}</button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
