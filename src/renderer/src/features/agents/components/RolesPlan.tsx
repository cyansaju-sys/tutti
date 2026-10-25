import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { MdAccountTree, MdAdd, MdBookmarkBorder, MdCheck, MdPause, MdPlayArrow, MdStop, MdLibraryAdd, MdSaveAlt, MdCheckCircle, MdChevronRight, MdDelete, MdErrorOutline, MdPauseCircle, MdPlaylistAdd, MdRateReview, MdReplay, MdUndo } from 'react-icons/md'
import type { RoleAgentOption, RoleInfo, RolePlanInfo, RoleTemplate } from '@shared/types'
import { Menu, type MenuItem } from '@/shared/components/Menu'
import { FIELD, Modal, Select } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { PlanFromTemplate, PlanView, SavePlanTemplate } from './PlanView'

const PLAN_TONE = { proposed: 'bg-ov/[0.06] text-muted', reviewed: 'bg-accent/15 text-accent', approved: 'bg-ok/15 text-ok' } as const
const ROLE_TONE = { waiting: 'text-muted', ready: 'text-muted', running: 'text-accent', blocked: 'text-accent', failed: 'text-danger', review: 'text-accent', done: 'text-ok' } as const

/** Un rol en revisión: qué dio su comprobación y los botones para aceptarlo o devolverlo a su agente con qué corregir. */
function RoleReview({ project, role, onDone }: { project: string; role: RoleInfo; onDone: () => void }) {
  const t = useT()
  const [rejecting, setRejecting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const rv = role.review
  if (!rv || rv.checking) return null
  const send = async (): Promise<void> => {
    if (!feedback.trim()) return
    if (await window.api.orchestra.rejectRole(project, role.id, feedback)) { setRejecting(false); setFeedback('') }
    onDone()
  }
  const btn = 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors'
  return (
    <div className="ml-7 mt-0.5 flex flex-col gap-1 pr-1.5">
      {rv.check && (
        <span title={rv.check.output} className={clsx('truncate text-[10px]', rv.check.ok ? 'text-ok' : 'text-danger')}>
          {t(rv.check.ok ? 'ag.roles.checkOk' : 'ag.roles.checkFail')} · <code>{rv.check.command}</code>
        </span>
      )}
      {rejecting ? (
        <div className="flex flex-col gap-1">
          <textarea autoFocus value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={t('ag.roles.feedback')} spellCheck={false}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(); if (e.key === 'Escape') setRejecting(false) }}
            className={clsx(FIELD, 'min-h-[52px] resize-y text-[11px]')} />
          <div className="flex justify-end gap-1">
            <button onClick={() => setRejecting(false)} className={clsx(btn, 'text-muted hover:text-text')}>{t('ag.roles.cancel')}</button>
            <button disabled={!feedback.trim()} onClick={() => void send()} className={clsx(btn, 'text-danger hover:bg-danger/10 disabled:opacity-40')}><MdUndo size={12} />{t('ag.roles.sendBack')}</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1">
          <button onClick={() => void window.api.orchestra.acceptRole(project, role.id).then(onDone)} className={clsx(btn, 'text-ok hover:bg-ok/10')}><MdCheck size={12} />{t('ag.roles.accept')}</button>
          <button onClick={() => setRejecting(true)} className={clsx(btn, 'text-danger hover:bg-danger/10')}><MdUndo size={12} />{t('ag.roles.reject')}</button>
        </div>
      )}
    </div>
  )
}
/** La nota del rol avisa de un problema: no se pudo lanzar, falló, o en revisión su comprobación falló o tocó archivos ajenos. */
const warned = (r: RoleInfo): boolean =>
  r.status === 'ready' || r.status === 'failed' || (r.status === 'review' && (r.review?.check?.ok === false || !!r.review?.outside.length))
const lines = (text: string): string[] => text.split('\n').map((l) => l.trim()).filter(Boolean)

/** Qué edita el editor: un rol del plan que aún no empezó, uno nuevo para el plan (en blanco o desde un reutilizable) o un rol reutilizable. */
type EditorMode = { kind: 'role'; role: RoleInfo } | { kind: 'new'; from?: RoleTemplate } | { kind: 'template'; template?: RoleTemplate }

/** Editor de un rol: sus campos y, a mano, el agente y el modelo que lo harán (en automático los elige Tutti). */
function RoleEditor({ project, mode, others, manual, onDone }: { project: string; mode: EditorMode; others: RoleInfo[]; manual: boolean; onDone: (changed: boolean) => void }) {
  const t = useT()
  const base: Partial<RoleTemplate> & { dependsOn?: string[] } = mode.kind === 'role' ? mode.role : mode.kind === 'new' ? mode.from ?? {} : mode.template ?? {}
  const inPlan = mode.kind !== 'template'
  const [name, setName] = useState(base.name ?? '')
  const [resp, setResp] = useState(base.responsibility ?? '')
  const [deliv, setDeliv] = useState((base.deliverables ?? []).join('\n'))
  const [done, setDone] = useState(base.done ?? '')
  const [files, setFiles] = useState((base.files ?? []).join('\n'))
  const [check, setCheck] = useState(base.check ?? '')
  const [difficulty, setDifficulty] = useState<RoleInfo['difficulty']>(base.difficulty ?? 'medium')
  const [deps, setDeps] = useState<string[]>(base.dependsOn ?? [])
  const [agent, setAgent] = useState(base.assign?.agent ?? '')
  const [model, setModel] = useState(base.assign?.model ?? '')
  const [options, setOptions] = useState<RoleAgentOption[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  useEffect(() => { void window.api.orchestra.roleOptions(project).then(setOptions) }, [project])
  const chosen = options?.find((o) => o.value === agent)
  const fields = (): Omit<RoleTemplate, 'id'> => ({
    name, responsibility: resp, deliverables: lines(deliv), done, files: lines(files), check: check.trim(), difficulty,
    ...(agent ? { assign: { agent, ...(model && chosen?.canSetModel !== false ? { model } : {}) } } : {})
  })
  const save = async (): Promise<void> => {
    const res = mode.kind === 'role' ? await window.api.orchestra.updateRole(project, mode.role.id, { ...fields(), dependsOn: deps, assign: fields().assign ?? null })
      : mode.kind === 'new' ? await window.api.orchestra.addRole(project, { ...fields(), dependsOn: deps, ...(mode.from ? { id: mode.from.id } : {}) })
      : await window.api.orchestra.saveRoleTemplate({ ...fields(), ...(mode.template ? { id: mode.template.id } : {}) }, mode.template?.id)
    if (res.ok) onDone(true)
    else setErrors(res.errors)
  }
  const saveAsTemplate = async (): Promise<void> => {
    const res = await window.api.orchestra.saveRoleTemplate(fields())
    if (res.ok) useStore.getState().toast(t('ag.roles.savedTemplate', { name }), 'ok')
    else setErrors(res.errors)
  }
  const remove = async (): Promise<void> => {
    if (mode.kind !== 'role') return
    const res = await window.api.orchestra.removeRole(project, mode.role.id)
    if (res.ok) onDone(true)
    else setErrors(res.errors)
  }
  const field = (label: string, el: React.ReactNode): React.ReactNode => (
    <label className="flex flex-col gap-1"><span className="text-[11px] text-muted">{label}</span>{el}</label>
  )
  const area = 'min-h-[56px] resize-y'
  const title = mode.kind === 'role' ? t('ag.roles.edit') : mode.kind === 'new' ? t('ag.roles.newRole') : mode.template ? t('ag.roles.editTemplate') : t('ag.roles.newTemplate')
  const link = 'rounded-lg px-2 py-1.5 text-[12px] transition-colors'
  return (
    <Modal onClose={() => onDone(false)} width={480} title={title}>
      <div className="flex max-h-[calc(78vh-4.5rem)] flex-col gap-3 overflow-y-auto px-5 pb-4">
        {mode.kind === 'template' && <p className="text-[11px] leading-snug text-muted">{t('ag.roles.templateHint')}</p>}
        {field(t('ag.roles.f.name'), <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} spellCheck={false} autoFocus />)}
        {field(t('ag.roles.f.resp'), <textarea className={clsx(FIELD, area)} value={resp} onChange={(e) => setResp(e.target.value)} spellCheck={false} />)}
        {field(t('ag.roles.f.deliv'), <textarea className={clsx(FIELD, area)} value={deliv} onChange={(e) => setDeliv(e.target.value)} spellCheck={false} />)}
        {field(t('ag.roles.f.done'), <textarea className={clsx(FIELD, area)} value={done} onChange={(e) => setDone(e.target.value)} spellCheck={false} />)}
        {field(t('ag.roles.f.files'), <textarea className={clsx(FIELD, area)} value={files} onChange={(e) => setFiles(e.target.value)} spellCheck={false} />)}
        {field(t('ag.roles.f.check'), <input className={clsx(FIELD, 'font-mono text-[12px]')} value={check} onChange={(e) => setCheck(e.target.value)} placeholder="npm test -- api" spellCheck={false} />)}
        {field(t('ag.roles.f.diff'), (
          <Select value={difficulty} onChange={(v) => setDifficulty(v as RoleInfo['difficulty'])} options={[{ value: 'easy', label: 'easy' }, { value: 'medium', label: 'medium' }, { value: 'hard', label: 'hard' }]} />
        ))}
        {inPlan && others.length > 0 && (
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
              { value: '', label: manual && inPlan ? t('ag.roles.pickAgent') : t('ag.roles.auto') },
              ...(agent && options && !chosen ? [{ value: agent, label: t('ag.roles.gone', { agent }) }] : []),
              ...(options ?? []).map((o) => ({ value: o.value, label: o.label }))
            ]} />
          ))}
          {field(t('ag.roles.f.model'), (
            <Select value={model} onChange={setModel} disabled={!agent || !chosen?.canSetModel || !chosen.models.length} title={chosen && !chosen.canSetModel ? t('ag.roles.fixedModel') : undefined} options={[
              { value: '', label: manual && inPlan ? t('ag.roles.agentDefault') : t('ag.roles.auto') },
              ...(chosen?.models ?? []).map((m) => ({ value: m.id, label: `${m.id} · ${m.tier}` }))
            ]} />
          ))}
        </div>
        {chosen && !chosen.canSetModel && <p className="-mt-1.5 text-[11px] text-muted">{t('ag.roles.fixedModel')}</p>}
        {errors.length > 0 && <ul className="text-[12px] leading-snug text-danger">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="flex items-center gap-1">
          {mode.kind === 'role' && (
            <>
              <button onClick={() => void remove()} className={clsx(link, 'text-muted hover:text-danger')}>{t('ag.roles.remove')}</button>
              <button onClick={() => void saveAsTemplate()} className={clsx(link, 'text-muted hover:text-accent')}>{t('ag.roles.saveAsTemplate')}</button>
            </>
          )}
          <span className="flex-1" />
          <button onClick={() => onDone(false)} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('ag.roles.cancel')}</button>
          <button onClick={() => void save()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110">{t('ag.roles.save')}</button>
        </div>
      </div>
    </Modal>
  )
}

/** Clave de localStorage: si la sección está plegada (como la raíz del proyecto en el explorador). */
const FOLD_KEY = 'tutti.files.rolesCollapsed'

const TEMPLATES_FOLD_KEY = 'tutti.files.templatesCollapsed'

/** Los roles reutilizables del usuario, plegables como una carpeta: cada uno se edita al pulsarlo y, al pasar el ratón, se añade al plan o se borra. */
function Templates({ templates, onEdit, onUse, onDelete }: { templates: RoleTemplate[]; onEdit: (t: RoleTemplate) => void; onUse: (t: RoleTemplate) => void; onDelete: (t: RoleTemplate) => void }) {
  const t = useT()
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(TEMPLATES_FOLD_KEY) !== '1' } catch { return true } })
  const toggle = (): void => setOpen((o) => { try { localStorage.setItem(TEMPLATES_FOLD_KEY, o ? '1' : '0') } catch { /* sin almacenamiento */ } return !o })
  if (!templates.length) return null
  return (
    <div className="mt-1 px-1">
      <button onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-1.5 rounded-[4px] py-[3px] pl-3.5 pr-1.5 text-left text-[12px] transition-colors hover:bg-accent-bg">
        <MdChevronRight size={14} className={clsx('-mr-0.5 shrink-0 text-muted transition-transform', open && 'rotate-90')} />
        <span className="min-w-0 flex-1 truncate">{t('ag.roles.templates')}</span>
        <span className="shrink-0 text-[10px] text-muted">{templates.length}</span>
      </button>
      {open && <ul className="flex flex-col gap-0.5">
        {templates.map((tp) => (
          <li key={tp.id} className="group flex items-center rounded-[4px] transition-colors hover:bg-accent-bg">
            <button onClick={() => onEdit(tp)} title={tp.responsibility} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pl-8 text-left text-[12px]">
              <MdBookmarkBorder size={12} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{tp.name}</span>
              <span className="shrink-0 text-[10px] text-muted">{tp.difficulty}</span>
            </button>
            <button onClick={() => onUse(tp)} title={t('ag.roles.useTemplate')} className="grid size-6 shrink-0 place-items-center rounded text-muted opacity-0 transition-colors hover:text-accent group-hover:opacity-100"><MdPlaylistAdd size={15} /></button>
            <button onClick={() => onDelete(tp)} title={t('ag.roles.deleteTemplate')} className="mr-1 grid size-6 shrink-0 place-items-center rounded text-muted opacity-0 transition-colors hover:text-danger group-hover:opacity-100"><MdDelete size={14} /></button>
          </li>
        ))}
      </ul>}
    </div>
  )
}

/**
 * Roles, en el explorador (siempre visible con un proyecto abierto): el plan del proyecto —qué hace cada rol, quién lo tiene, revisión y
 * aprobación— y los roles reutilizables del usuario. El botón + añade un rol al plan (en blanco o desde un reutilizable) o crea uno reutilizable.
 */
export function RolesPlan() {
  const t = useT()
  const project = useStore((s) => s.project)
  const [plan, setPlan] = useState<RolePlanInfo | null>(null)
  const [templates, setTemplates] = useState<RoleTemplate[]>([])
  const [editor, setEditor] = useState<EditorMode | null>(null)
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [dialog, setDialog] = useState<'view' | 'fromTemplate' | 'savePlan' | null>(null)
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(FOLD_KEY) !== '1' } catch { return true } })
  const toggle = (): void => setOpen((o) => { try { localStorage.setItem(FOLD_KEY, o ? '1' : '0') } catch { /* sin almacenamiento */ } return !o })
  const loadTemplates = (): void => { void window.api.orchestra.roleTemplates().then(setTemplates) }
  useEffect(loadTemplates, [])
  useEffect(() => {
    if (!project) { setPlan(null); return }
    const load = (): void => { void window.api.orchestra.roles(project).then(setPlan) }
    load()
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [project])
  if (!project) return null
  const reload = (): void => { void window.api.orchestra.roles(project).then(setPlan); loadTemplates() }
  const act = (call: Promise<unknown>): void => { void call.then(reload) }
  const roles = plan?.roles ?? []
  const running = roles.some((r) => r.status === 'running')
  const missing = plan?.assignment === 'manual' && roles.some((r) => r.status !== 'done' && !r.assign && !r.agent)          // falta elegir el agente de algún rol
  const idle = plan?.status === 'approved' && !plan.started          // aprobado pero sin repartir: tras reiniciar la app o en pausa
  const paused = !!plan?.paused
  const finished = roles.filter((r) => r.status === 'done').length
  const nameOf = (id: string): string => roles.find((x) => x.id === id)?.name ?? id
  const menuItems: MenuItem[] = [
    { label: t('ag.roles.addToPlan'), icon: <MdPlaylistAdd size={15} />, submenu: [
      ...templates.map((tp): MenuItem => ({ label: tp.name, detail: tp.difficulty, icon: <MdBookmarkBorder size={14} />, onClick: () => setEditor({ kind: 'new', from: tp }) })),
      { label: t('ag.roles.blank'), icon: <MdAdd size={14} />, separator: templates.length > 0, onClick: () => setEditor({ kind: 'new' }) }
    ] },
    { label: t('ag.roles.newTemplate'), icon: <MdBookmarkBorder size={15} />, onClick: () => setEditor({ kind: 'template' }) },
    { label: t('ag.roles.fromTemplate'), icon: <MdLibraryAdd size={15} />, separator: true, onClick: () => setDialog('fromTemplate') },
    { label: t('ag.roles.savePlan'), icon: <MdSaveAlt size={15} />, hidden: !roles.length, onClick: () => setDialog('savePlan') }
  ]
  const deleteTemplate = (tp: RoleTemplate): void => act(window.api.orchestra.deleteRoleTemplate(tp.id))
  return (
    <section className={clsx('shrink-0 overflow-y-auto border-t border-ov/[0.08] pt-1', open && 'h-4/12')}>      {/* desplegado ocupa 4 de 12 del panel; el árbol de archivos, el resto */}
      <div className="flex items-center justify-between pl-3 pr-2 pb-1">
        <button onClick={toggle} aria-expanded={open} className="flex min-w-0 items-center gap-0.5 rounded px-1 py-1 text-left transition-colors hover:text-accent">
          <MdChevronRight size={14} className={clsx('shrink-0 text-muted transition-transform', open && 'rotate-90')} />
          <span className="truncate text-[12px] font-semibold">{t('ag.roles')}</span>
          {plan && <span className="ml-1 rounded-full bg-accent/25 px-2 py-px text-[10px] font-semibold text-accent">{finished}/{roles.length}</span>}
          {plan?.status === 'reviewed' && <span title={t('ag.roles.reviewed')} className="ml-1.5 size-2 shrink-0 animate-pulse rounded-full bg-accent" />}
        </button>
        <div className="flex items-center">
          {plan && <button onClick={() => setDialog('view')} title={t('ag.roles.view')} className="grid size-[26px] place-items-center rounded-md text-muted transition-colors hover:bg-accent-bg hover:text-accent"><MdAccountTree size={15} /></button>}
          {plan?.status === 'approved' && (plan.started
            ? <button onClick={() => act(window.api.orchestra.pauseRoles(project))} title={t('ag.roles.pause')} className="grid size-[26px] place-items-center rounded-md text-muted transition-colors hover:bg-accent-bg hover:text-accent"><MdPause size={16} /></button>
            : <button onClick={() => act(window.api.orchestra.startRoles(project))} title={t('ag.roles.resume')} className="grid size-[26px] place-items-center rounded-md text-accent transition-colors hover:bg-accent-bg"><MdPlayArrow size={17} /></button>)}
          <button onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())} title={t('ag.roles.add')} className="grid size-[26px] place-items-center rounded-md text-muted transition-colors hover:bg-accent-bg hover:text-accent"><MdAdd size={17} /></button>
          {plan && !running && <button onClick={() => act(window.api.orchestra.discardRoles(project))} title={t('ag.roles.discard')} className="grid size-[26px] place-items-center rounded-md text-muted transition-colors hover:bg-[#3a1620] hover:text-danger"><MdDelete size={16} /></button>}
        </div>
      </div>
      {menu && <Menu anchor={menu} items={menuItems} onClose={() => setMenu(null)} width={210} />}
      {open && (
        <div className="pb-2">
          {!plan && <p className="px-3 pb-1 text-[11px] leading-snug text-muted">{t('ag.roles.empty')}</p>}
          {plan && (
            <>
              <div className="px-3 pb-1"><span className={clsx('rounded-full px-1.5 py-0.5 text-[9px]', PLAN_TONE[plan.status])}>{paused ? t('ag.roles.pausedNow') : idle ? t('ag.roles.paused') : t(`ag.roles.${plan.status}`)}</span></div>
              {plan.problem && <p className="px-3 pb-1 text-[11px] leading-snug text-danger">{plan.problem}</p>}
              {plan.summary && <p className="line-clamp-2 px-3 pb-1 text-[11px] leading-snug text-muted">{plan.summary}</p>}
              <ul className="flex flex-col gap-0.5 px-1">
                {roles.map((r) => {
                  const waiting = r.dependsOn.filter((d) => roles.find((x) => x.id === d)?.status !== 'done').map(nameOf)
                  const editable = r.status === 'waiting' || r.status === 'ready'
                  const needsAgent = plan.assignment === 'manual' && !r.assign && !r.agent && r.status !== 'done'
                  const state = r.status === 'waiting' ? t('ag.roles.waiting', { roles: waiting.join(', ') }) : r.status === 'ready' && needsAgent ? t('ag.roles.pick') : t(`ag.roles.${r.status}`)
                  const who = r.agent ?? (r.assign ? t('ag.roles.manual', { agent: r.assign.agent }) : null)
                  const modelShown = r.agent ? r.model : r.assign?.model
                  return (
                    <li key={r.id}>
                      <button disabled={!editable} onClick={() => setEditor({ kind: 'role', role: r })} title={editable ? t('ag.roles.edit') : t('ag.roles.locked')}
                        className={clsx('flex w-full flex-col gap-0.5 rounded-[4px] py-1 pl-3.5 pr-1.5 text-left transition-colors', editable ? 'hover:bg-accent-bg' : 'cursor-default', editor?.kind === 'role' && editor.role.id === r.id && 'bg-accent-bg')}>
                        <span className="flex items-center gap-1.5 text-[12px]">
                          {r.status === 'running' ? <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />
                            : r.status === 'done' ? <MdCheckCircle size={12} className="shrink-0 text-ok" />
                            : r.status === 'blocked' ? <MdPauseCircle size={12} className="shrink-0 text-accent" />
                            : r.status === 'failed' ? <MdErrorOutline size={12} className="shrink-0 text-danger" />
                            : r.status === 'review' ? <MdRateReview size={12} className={clsx('shrink-0 text-accent', r.review?.checking && 'animate-pulse')} />
                            : <span className="size-2 shrink-0 rounded-full border border-muted" />}
                          <span className="min-w-0 flex-1 truncate">{r.name}</span>
                          <span className="shrink-0 text-[10px] text-muted">{r.difficulty}</span>
                        </span>
                        <span className={clsx('truncate pl-3.5 text-[10px]', needsAgent && r.status !== 'running' ? 'text-accent' : ROLE_TONE[r.status])}>{state}{who ? ` · ${who}` : ''}{modelShown ? ` · ${modelShown}` : ''}</span>
                        {(r.status === 'done' || r.status === 'review') && r.summary && <span title={[r.summary, ...(r.changed ?? [])].join('\n')} className="line-clamp-2 pl-3.5 text-[10px] leading-snug text-muted">{r.summary}</span>}
                        {r.note && !needsAgent && <span className={clsx('line-clamp-2 pl-3.5 text-[10px] leading-snug', warned(r) ? 'text-danger/90' : 'text-accent')}>{r.note}</span>}
                      </button>
                      {r.status === 'review' && <RoleReview project={project} role={r} onDone={reload} />}
                      {(r.status === 'running' || r.status === 'blocked') && (
                        <button onClick={() => act(window.api.orchestra.cancelRole(project, r.id))} className="ml-7 mt-0.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:bg-danger/10 hover:text-danger">
                          <MdStop size={12} />{t('ag.roles.cancelRole')}
                        </button>
                      )}
                      {(r.status === 'failed' || r.status === 'blocked') && (
                        <button onClick={() => act(window.api.orchestra.retryRole(project, r.id))} className="ml-7 mt-0.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-accent transition-colors hover:bg-accent-bg">
                          <MdReplay size={12} />{t('ag.roles.retry')}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              {idle && (
                <button onClick={() => act(window.api.orchestra.startRoles(project))} className="mx-2 mt-1.5 w-[calc(100%-1rem)] rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-bg transition-opacity hover:opacity-90">{paused ? t('ag.roles.resume') : t('ag.roles.start')}</button>
              )}
              {plan.status === 'reviewed' && (
                <>
                  {missing && <p className="px-3 pt-1.5 text-[11px] leading-snug text-muted">{t('ag.roles.needAgents')}</p>}
                  <button disabled={missing} onClick={() => act(window.api.orchestra.approveRoles(project))} className="mx-2 mt-1.5 w-[calc(100%-1rem)] rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40">{t('ag.roles.approve')}</button>
                </>
              )}
            </>
          )}
          <Templates templates={templates} onEdit={(tp) => setEditor({ kind: 'template', template: tp })} onUse={(tp) => setEditor({ kind: 'new', from: tp })} onDelete={deleteTemplate} />
        </div>
      )}
      {dialog === 'view' && plan && <PlanView plan={plan} onClose={() => setDialog(null)} />}
      {dialog === 'fromTemplate' && <PlanFromTemplate project={project} onDone={(created) => { setDialog(null); if (created) reload() }} />}
      {dialog === 'savePlan' && <SavePlanTemplate project={project} onDone={() => setDialog(null)} />}
      {editor && (
        <RoleEditor project={project} mode={editor} manual={plan?.assignment !== 'auto'}
          others={roles.filter((x) => editor.kind !== 'role' || x.id !== editor.role.id)}
          onDone={(changed) => { setEditor(null); if (changed) reload() }} />
      )}
    </section>
  )
}
