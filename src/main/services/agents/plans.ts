/**
 * El plan de roles de cada proyecto mientras la app corre: lo propone el líder (o lo arma el usuario con roles reutilizables), el usuario lo
 * aprueba y la app lanza cada rol cuando terminan sus dependencias, lo comprueba, lo deja en revisión y avisa al líder.
 * El plan se guarda en `.tutti/roles.json` (rolePlan.ts); qué agente lleva cada rol sale del registro de tareas (tasks.ts).
 */
import type { RoleAgentOption, RoleEdit, RoleInfo, RolePlanInfo } from '../../../shared/types'
import { exec, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { detectAgents } from './agents'
import { candidates, nameOf } from './candidates'
import { recordOutcome } from './history'
import { notify } from './inbox'
import { currentLeader } from './leader'
import { availableModels, MODEL_FLAG } from './models'
import type { Host, TaskReport } from './orchestra'
import * as pty from './pty'
import { loadPlan, parseRoles, removePlan, roleFiles, rolePrompt, savePlan, settleInflight, type CheckResult, type RolePlan } from './rolePlan'
import { assignRoles, outsideFiles, REVIEW_CHECKLIST, reviewWarnings, validateRoles, type Role, type RoleAssignment, type RoleCandidate } from './roles'
import { expandTemplates, listTemplates, slugId, uniqueId } from './roleTemplates'
import { planTemplate, savePlanTemplate } from './planTemplates'
import { knownProjects, label, oneLine, toast } from './runtime'
import { active, latestRoleTask, modelOf, overLimit, recordTask, statusOf, tasks, type TaskRecord } from './tasks'
import { projectRoot } from '../context/projectRoot'
import { roadmapFile } from '../roadmap'
import { getSetting } from '../settings'
import { extendedPath } from '../../utils/shellpath'
import { tm } from '../../utils/i18n'
import { isDifficulty } from './assign'

/** Cómo se le da una tarea a un agente (es `delegate` del servidor MCP): el plan lanza así cada rol. */
export type Launcher = Host['delegate']
type Result = { ok: boolean; info: string }

interface PlanState {
  project: string
  plan: RolePlan
  /** Agente que lo dirige: a él se le lanzan los roles (su carpeta, su aviso al terminar). */
  leaderId: string
  /** Aprobado y en reparto: la app lanza cada rol cuando se puede. */
  started: boolean
  /** Lo pausó el usuario: no se lanzan roles nuevos (los que están en marcha siguen). */
  paused: boolean
  advancing: boolean
  launching: Set<string>
  retryAt: Map<string, number>
  /** Por qué un rol listo aún no arrancó (para mostrarlo en el panel). */
  why: Map<string, string>
  nextAt: number
  finished: boolean
  /** Avisos para el líder que esperan a que esté libre. */
  notes: string[]
  /** Roles terminados cuya comprobación está corriendo. */
  checking: Set<string>
  /** Cuántas veces se le devolvió a cada rol la salida de su comprobación fallida. */
  fixes: Map<string, number>
}
const planStates = new Map<string, PlanState>()
const RETRY_ROLE_MS = 60_000           // un rol que no pudo lanzarse se reintenta pasado este tiempo
const IDLE_CHECK_MS = 10_000           // sin nadie libre, no se vuelve a mirar hasta pasado este tiempo
/** Con `"roles_approval": false` en los ajustes el plan se reparte en cuanto el líder lo confirma, sin esperar al usuario. */
const approvalRequired = (): boolean => getSetting('roles_approval') !== false
/** Con `"roles_review": false` un rol se acepta solo si su comprobación pasa y no tocó archivos ajenos; si no, todo rol terminado espera revisión. */
const reviewRequired = (): boolean => getSetting('roles_review') !== false
/** Quién elige el agente y el modelo de cada rol: el usuario (por defecto) o la app según capacidad, con `"roles_assignment": "auto"`. */
const assignmentMode = (): 'manual' | 'auto' => (getSetting('roles_assignment') === 'auto' ? 'auto' : 'manual')
const missingAgent = (s: PlanState): boolean => s.plan.roles.some((r) => !s.plan.done.includes(r.id) && !r.assign)

const newState = (project: string, plan: RolePlan, leaderId: string): PlanState =>
  ({ project, plan, leaderId, started: false, paused: false, advancing: false, launching: new Set(), retryAt: new Map(), why: new Map(), nextAt: 0, finished: false, notes: [], checking: new Set(), fixes: new Map() })

const rootOf = (dir: string): string => projectRoot(dir, knownProjects())

/** El plan del proyecto: el que está en memoria o, si no, el guardado en `.tutti/roles.json`. */
function planState(project: string, leaderId?: string): PlanState | null {
  let s = planStates.get(project) ?? null
  if (!s) {
    const plan = loadPlan(project)
    if (!plan) return null
    if (settleInflight(plan)) savePlan(project, plan)          // tras reiniciar: lo que estaba en marcha quedó a medias
    s = newState(project, plan, leaderId ?? currentLeader()?.id ?? '')
    planStates.set(project, s)
  }
  if (leaderId) s.leaderId = leaderId
  return s
}

/** El plan en el que trabaja un agente abierto, o por qué no hay. */
function planOfAgent(caller: string): PlanState | string {
  const me = pty.agentSessions().find((m) => m.id === caller)
  if (!me) return 'Solo los agentes abiertos en la app pueden trabajar con el plan de roles.'
  return planState(rootOf(me.cwd)) ?? 'No hay un plan de roles. Propón uno con propose_roles.'
}

const roleRunning = (roleId: string): boolean => { const t = latestRoleTask(roleId); return !!t && active(statusOf(t)) }
/** El rol ya empezó (tiene tarea, aunque haya acabado o fallado) o está en revisión: no se vuelve a repartir solo. */
const roleStarted = (s: PlanState, roleId: string): boolean => !!latestRoleTask(roleId) || !!s.plan.review?.[roleId] || s.checking.has(roleId)

/** El plan y el rol de una tarea, si salió de un plan. */
function planOf(t: TaskRecord): { s: PlanState; role: Role } | null {
  if (!t.role) return null
  const s = planStates.get(rootOf(t.cwd))
  const role = s?.plan.roles.find((r) => r.id === t.role)
  return s && role ? { s, role } : null
}
/** Al terminar, esta tarea pasa por la revisión del rol (que avisa al líder con la comprobación) en vez del aviso normal. */
export const byReview = (t: TaskRecord): boolean => { const p = planOf(t); return !!p && (reviewRequired() || !!p.role.check) }
/** El nombre que tiene en su plan el rol de una tarea. */
export const roleNameOf = (t: TaskRecord): string | undefined => planOf(t)?.role.name

// --- roles en marcha: se anotan en el plan guardado para saber, tras un reinicio, cuáles quedaron a medias ---
function markInflight(s: PlanState, roleId: string, agent: string | null): void {
  if (!s.plan.roles.some((r) => r.id === roleId)) return
  const { [roleId]: _old, ...rest } = s.plan.inflight ?? {}
  s.plan.inflight = agent ? { ...rest, [roleId]: { agent, at: Date.now() } } : rest
  savePlan(s.project, s.plan)
}
/** Una tarea nueva con rol: su rol queda en marcha en el plan guardado. */
export function noteRoleTask(t: TaskRecord): void {
  const p = planOf(t)
  if (!p) return
  const times = p.s.plan.times ?? {}
  if (!times[p.role.id] || times[p.role.id].end) p.s.plan.times = { ...times, [p.role.id]: { start: times[p.role.id]?.start ?? Date.now() } }          // el primer intento marca el inicio
  markInflight(p.s, p.role.id, label(t.agent))
}

/** Un rol queda hecho (aceptado): los que dependen de él pueden empezar. No guarda: lo hace quien llama. */
function finishRole(s: PlanState, id: string): void {
  if (!s.plan.done.includes(id)) s.plan.done.push(id)
  const start = s.plan.times?.[id]?.start
  if (start) s.plan.times = { ...s.plan.times, [id]: { start, end: Date.now() } }
  s.fixes.delete(id)
  s.nextAt = 0
}

/** Guarda en el plan lo que el agente de un rol dijo con report_done. */
export function recordRoleResult(t: TaskRecord): void {
  const p = planOf(t)
  if (!p || !t.report) return
  p.s.plan.results = { ...p.s.plan.results, [p.role.id]: { ...t.report, agent: label(t.agent), at: Date.now() } }
  markInflight(p.s, p.role.id, null)          // guarda también el resultado
}

// --- revisión de un rol terminado ---
/**
 * Los roles cuyo agente terminó pasan a revisión (con su comprobación, si tienen) o, sin revisión ni comprobación, se dan por hechos.
 * Uno que falló o cerró su panel sin terminar no cuenta. Así no se pierden si se limpia el panel de tareas.
 */
function syncRoleDone(s: PlanState): void {
  let changed = false
  for (const r of s.plan.roles) {
    const t = latestRoleTask(r.id)
    if (s.plan.done.includes(r.id) || s.plan.review?.[r.id] || s.checking.has(r.id) || !t || statusOf(t) !== 'done') continue
    if (s.plan.inflight?.[r.id]) { const { [r.id]: _done, ...rest } = s.plan.inflight; s.plan.inflight = rest; changed = true }
    if (!reviewRequired() && !r.check) { finishRole(s, r.id); changed = true; continue }
    t.notified = true          // al líder le avisa la revisión, con la comprobación ya hecha
    void startReview(s, r, t)
  }
  if (changed) savePlan(s.project, s.plan)
}

const CHECK_MS = 5 * 60_000
const CHECK_LINES = 40
const MAX_AUTO_FIX = 2          // veces que se le devuelve al agente una comprobación fallida antes de pasarla a revisión

/** Ejecuta la comprobación de un rol en la raíz del proyecto; se queda con el final de la salida. */
function runCheck(command: string, cwd: string): Promise<CheckResult> {
  return new Promise((done) => {
    exec(command, { cwd, timeout: CHECK_MS, maxBuffer: 8_000_000, env: { ...process.env, PATH: extendedPath() } }, (err, stdout, stderr) => {
      const lines = `${stdout}${stderr}`.trim().split('\n')
      const output = lines.slice(-CHECK_LINES).join('\n') + (err?.killed ? `\n(se cortó tras ${CHECK_MS / 60_000} min)` : '')
      done({ command, ok: !err, output })
    })
  })
}

/** Le escribe al agente de un rol y lo anota como una tarea más del rol (vuelve a estar en marcha). */
function resendRole(s: PlanState, roleId: string, target: { agentId: string; agent: string; command: string }, text: string): void {
  const leader = pty.agentSessions().find((m) => m.id === s.leaderId)
  const caller: pty.Meta = leader ?? { id: s.leaderId, kind: 'agent', name: 'Tutti', command: '', cwd: s.project }
  pty.sendPrompt(target.agentId, text)
  noteRoleTask(recordTask(caller, target.agentId, target.agent, target.command, text, { difficulty: s.plan.roles.find((r) => r.id === roleId)?.difficulty, role: roleId }))
}

/** Comprueba un rol terminado: si la comprobación falla se lo devuelve a su agente (unas veces); si no, lo deja en revisión y avisa al líder. */
async function startReview(s: PlanState, role: Role, t: TaskRecord): Promise<void> {
  s.checking.add(role.id)
  try {
    const outside = outsideFiles(role.files, t.report?.files ?? [], s.project)
    const check = role.check ? await runCheck(role.check, s.project) : undefined
    if (check && !check.ok) {
      const tries = s.fixes.get(role.id) ?? 0
      if (tries < MAX_AUTO_FIX && pty.hasSession(t.agentId)) {
        s.fixes.set(role.id, tries + 1)
        resendRole(s, role.id, t, `[Tutti] La comprobación del rol «${role.name}» (\`${check.command}\`) falló:\n${check.output}\n\nArréglalo sin salirte de tus archivos y, al terminar, vuelve a llamar a report_done.`)
        return
      }
    }
    if (!reviewRequired() && (!check || check.ok) && !outside.length) {
      finishRole(s, role.id)
      savePlan(s.project, s.plan)
      if (t.report) s.notes.push(`[Tutti] Rol «${role.id}» terminado${check ? ` y su comprobación pasó` : ''}. Resumen: ${oneLine(t.report.summary, 400)}`)
      return
    }
    s.plan.review = { ...s.plan.review, [role.id]: { agentId: t.agentId, agent: label(t.agent), command: t.command, ...(check ? { check } : {}), outside, at: Date.now() } }
    savePlan(s.project, s.plan)
    s.notes.push(reviewNote(role, t.report, check, outside))
  } finally { s.checking.delete(role.id) }
}

/** El aviso al líder de que un rol espera su revisión. */
function reviewNote(role: Role, report: TaskReport | undefined, check: CheckResult | undefined, outside: string[]): string {
  return [
    `[Tutti] El rol «${role.id}» (${role.name}) terminó y espera tu revisión. Criterio de terminado: ${oneLine(role.done, 300)}`,
    report ? `Resumen: ${oneLine(report.summary, 500)}` : 'Su agente no dejó resumen con report_done.',
    check ? (check.ok ? `Comprobación \`${check.command}\`: pasó.` : `Comprobación \`${check.command}\`: FALLÓ tras ${MAX_AUTO_FIX} intentos de arreglo. Últimas líneas:\n${check.output.split('\n').slice(-12).join('\n')}`) : '',
    outside.length ? `Ojo: dice haber tocado archivos que no son suyos: ${outside.join(', ')}.` : '',
    `Revisa con get_role_result(role_id: "${role.id}") y llama a accept_role o a reject_role(role_id, feedback). Los roles que dependen de él esperan.`
  ].filter(Boolean).join('\n')
}

/** Acepta un rol en revisión: cuenta como hecho y los que dependen de él pueden empezar. */
function acceptRoleIn(s: PlanState, id: string): Result {
  if (s.checking.has(id)) return { ok: false, info: `El rol «${id}» aún se está comprobando: espera al aviso de la app.` }
  if (!s.plan.review?.[id]) return { ok: false, info: s.plan.done.includes(id) ? `El rol «${id}» ya estaba aceptado.` : `El rol «${id}» no está en revisión.` }
  const { [id]: _accepted, ...rest } = s.plan.review
  s.plan.review = rest
  finishRole(s, id)
  savePlan(s.project, s.plan)
  const left = s.plan.roles.filter((r) => !s.plan.done.includes(r.id)).map((r) => r.id)
  return { ok: true, info: left.length ? `Rol «${id}» aceptado. Quedan: ${left.join(', ')}; la app lanza los que ya pueden empezar.` : `Rol «${id}» aceptado: era el último del plan.` }
}

/** Rechaza un rol en revisión: el feedback vuelve a su agente o, si ya no está, el rol se relanza con otro que lo recibe en su prompt. */
function rejectRoleIn(s: PlanState, id: string, feedback: string): Result {
  const rv = s.plan.review?.[id]
  const role = s.plan.roles.find((r) => r.id === id)
  if (!rv || !role) return { ok: false, info: s.checking.has(id) ? `El rol «${id}» aún se está comprobando: espera al aviso de la app.` : `El rol «${id}» no está en revisión.` }
  const { [id]: _rejected, ...rest } = s.plan.review!
  s.plan.review = rest
  s.fixes.delete(id)
  const last = latestRoleTask(id)
  if (last && isDifficulty(last.difficulty)) recordOutcome(last.command, modelOf(last), last.difficulty, false)          // un rechazo cuenta como fallo en su historial
  if (pty.hasSession(rv.agentId)) {
    resendRole(s, id, rv, `[Tutti] Revisión del rol «${role.name}»: aún no se acepta.\n${feedback}\n\nCorrígelo sin salirte de tus archivos y, al terminar, vuelve a llamar a report_done.`)
    savePlan(s.project, s.plan)
    return { ok: true, info: `Devuelto a ${rv.agent} (${rv.agentId}) con tu feedback; te aviso cuando vuelva a terminar.` }
  }
  const prev = s.plan.results?.[id]
  s.plan.results = { ...s.plan.results, [id]: { status: 'failed', summary: `Rechazado en revisión: ${feedback}`, files: prev?.files ?? [], agent: rv.agent, at: Date.now() } }
  for (const x of tasks) if (x.role === id) x.role = null
  s.nextAt = 0
  savePlan(s.project, s.plan)
  return { ok: true, info: `Su agente ya no está: el rol «${id}» se relanza con otro, que recibe tu feedback.` }
}

/** Para las decisiones del líder: el plan del agente que llama, si es su líder. */
function leaderPlan(caller: string): PlanState | string {
  const s = planOfAgent(caller)
  if (typeof s === 'string') return s
  if (s.leaderId && s.leaderId !== caller) return `Solo el líder del plan (${s.leaderId}) acepta o rechaza roles.`
  return s
}

export function acceptRoleBy(caller: string, roleId: string): Result {
  const s = leaderPlan(caller)
  return typeof s === 'string' ? { ok: false, info: s } : acceptRoleIn(s, roleId)
}
export function rejectRoleBy(caller: string, roleId: string, feedback: string): Result {
  const s = leaderPlan(caller)
  return typeof s === 'string' ? { ok: false, info: s } : rejectRoleIn(s, roleId, feedback)
}

/** El usuario acepta desde el panel un rol en revisión. */
export function acceptRole(project: string, id: string): boolean {
  const s = planState(rootOf(project))
  const res = s ? acceptRoleIn(s, id) : null
  if (s && res?.ok) s.notes.push(`[Tutti] El usuario aceptó el rol «${id}».`)
  return !!res?.ok
}

/** El usuario rechaza desde el panel un rol en revisión, con qué corregir. */
export function rejectRole(project: string, id: string, feedback: string): boolean {
  const s = planState(rootOf(project))
  const text = feedback.trim()
  const res = s && text ? rejectRoleIn(s, id, text) : null
  if (s && res?.ok) s.notes.push(`[Tutti] El usuario rechazó el rol «${id}»: ${oneLine(text, 300)}`)
  return !!res?.ok
}

// --- lo que entregó cada rol ---
const MAX_DIFF_LINES = 40
/** Cambios sin commit en esos archivos (git diff --stat contra HEAD, más los nuevos sin seguir); vacío si no hay o no es un repositorio. */
function changesIn(project: string, paths: string[]): string {
  if (!paths.length) return ''
  const git = (args: string[]): string => { try { return execFileSync('git', args, { cwd: project, encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' } }
  const stat = git(['diff', '--stat=100', 'HEAD', '--', ...paths])
  const added = git(['ls-files', '--others', '--exclude-standard', '--', ...paths]).split('\n').filter(Boolean).map((f) => ` ${f} (nuevo)`)
  const lines = [...stat.split('\n').filter(Boolean), ...added]
  return lines.length > MAX_DIFF_LINES ? [...lines.slice(0, MAX_DIFF_LINES), ` … y ${lines.length - MAX_DIFF_LINES} líneas más`].join('\n') : lines.join('\n')
}

/** Los cambios de cada rol del que depende `roleId`, para pasárselos en su prompt. */
function dependencyChanges(s: PlanState, roleId: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of s.plan.roles.find((r) => r.id === roleId)?.dependsOn ?? []) {
    const dep = s.plan.roles.find((r) => r.id === id)
    const diff = dep ? changesIn(s.project, roleFiles(dep, s.plan.results?.[id])) : ''
    if (diff) out[id] = diff
  }
  return out
}

/** get_role_result: estado, resumen, archivos y cambios sin commit de un rol. */
export function roleResultFor(caller: string, roleId: string): { ok: boolean; info: unknown } {
  const me = pty.agentSessions().find((m) => m.id === caller)
  if (!me) return { ok: false, info: 'Solo los agentes abiertos en la app pueden leer los roles.' }
  const root = rootOf(me.cwd)
  const plan = planStates.get(root)?.plan ?? loadPlan(root)
  const shown = rolesState(root)?.roles.find((r) => r.id === roleId)
  const role = plan?.roles.find((r) => r.id === roleId)
  if (!plan || !role || !shown) return { ok: false, info: plan ? `No hay ningún rol «${roleId}». Roles: ${plan.roles.map((r) => r.id).join(', ')}.` : 'No hay un plan de roles.' }
  const result = plan.results?.[roleId]
  return {
    ok: true,
    info: {
      role: role.id, name: role.name, status: shown.status, agent: shown.agent ?? result?.agent ?? null, done_criteria: role.done,
      summary: shown.summary ?? null, files_changed: shown.changed ?? [],
      uncommitted_changes: changesIn(root, roleFiles(role, result)) || 'ninguno en sus archivos',
      ...(shown.review?.check ? { check: shown.review.check } : {}),
      ...(shown.status === 'done' && !shown.summary ? { note: `No dejó resumen con report_done: lee su pantalla con read_agent_output${shown.agentId ? `(agent_id: "${shown.agentId}")` : ''} si sigue abierto.` } : {})
    }
  }
}

// --- reparto ---
/** Los agentes que tienen un rol en marcha (o en revisión: si se rechaza, vuelve a ellos) cuentan como ocupados: uno, un rol. */
function markHeld(list: RoleCandidate[]): RoleCandidate[] {
  const held = new Set(tasks.filter((t) => t.role && ['working', 'needs_input', 'blocked'].includes(statusOf(t))).map((t) => t.agentId))
  for (const s of planStates.values()) for (const rv of Object.values(s.plan.review ?? {})) held.add(rv.agentId)
  return list.map((c) => (c.id && held.has(c.id) ? { ...c, busy: true } : c))
}

async function assignmentsOf(s: PlanState, me: pty.Meta): Promise<RoleAssignment[]> {
  const taken = new Set(s.plan.roles.filter((r) => roleStarted(s, r.id) || s.launching.has(r.id)).map((r) => r.id))
  const roles = s.plan.roles.filter((r) => (s.retryAt.get(r.id) ?? 0) <= Date.now())          // el que falló hace poco no se guarda agente
  return assignRoles(roles, markHeld(await candidates(me.id, me.cwd, true)), { done: new Set(s.plan.done), active: taken, manual: assignmentMode() === 'manual' })
}

const assignmentRows = (list: RoleAssignment[]): unknown[] => list.map((a) => ({
  role: a.role.id, status: a.status, agent: a.agent ? nameOf(a.agent) : null, model: a.model, below_requested_level: a.downgraded || undefined,
  why: a.reason, waiting_for: a.waitingOn.length ? a.waitingOn : undefined
}))

/** Lanza los roles que ya se pueden (con sus dependencias terminadas y un agente libre). Devuelve qué se hizo, para avisar al líder. */
async function advanceRoles(s: PlanState, launch: Launcher): Promise<string[]> {
  if (s.plan.status !== 'approved' || s.advancing) return []
  syncRoleDone(s)          // lo que termina pasa a revisión aunque el plan esté en pausa
  if (!s.started) return []
  const me = pty.agentSessions().find((m) => m.id === s.leaderId)
  if (!me) return []
  const done = new Set(s.plan.done)
  if (done.size >= s.plan.roles.length) {
    if (!s.finished) { s.finished = true; s.notes.push(reviewRequired() ? '[Tutti] Todos los roles del plan terminaron y están aceptados.' : '[Tutti] Todos los roles del plan terminaron. Revisa cada entregable contra el criterio de terminado de su rol.') }
    return []
  }
  const now = Date.now()
  if (now < s.nextAt) return []
  const ready = s.plan.roles.filter((r) => !done.has(r.id) && !roleStarted(s, r.id) && !s.launching.has(r.id) && (s.retryAt.get(r.id) ?? 0) <= now && r.dependsOn.every((d) => done.has(d)))
  if (!ready.length) return []
  s.advancing = true
  try {
    const launched: string[] = []
    for (const a of await assignmentsOf(s, me)) {
      if (a.status === 'queued' || a.status === 'unassigned') s.why.set(a.role.id, a.reason)
      if (a.status !== 'assigned' || !a.agent) continue
      const full = overLimit(a.agent.id ?? null)
      if (full) { s.why.set(a.role.id, tm('m.roles.limit', { why: full })); continue }
      s.launching.add(a.role.id)
      try {
        const res = await launch(me.id, a.agent.id ?? a.agent.command, rolePrompt(a.role, s.plan, dependencyChanges(s, a.role.id)), !a.agent.id, { difficulty: a.role.difficulty, force: true, model: a.model ?? undefined, role: a.role.id })
        if (res.ok) {
          s.retryAt.delete(a.role.id)
          s.why.delete(a.role.id)
          launched.push(`${a.role.id} → ${nameOf(a.agent)}${a.model ? ` con ${a.model}` : ''}${a.downgraded ? ` (${a.reason})` : ''}`)
        } else {
          s.why.set(a.role.id, String(res.info))
          if (!s.retryAt.has(a.role.id)) launched.push(`${a.role.id}: no se pudo lanzar (${String(res.info)}); se reintenta en un minuto`)
          s.retryAt.set(a.role.id, Date.now() + RETRY_ROLE_MS)
        }
      } finally { s.launching.delete(a.role.id) }
    }
    s.nextAt = launched.length ? 0 : Date.now() + IDLE_CHECK_MS
    return launched
  } finally { s.advancing = false }
}

/** Avanza cada plan en marcha y le pasa al líder lo que haya pasado. */
export async function tickRoles(launch: Launcher): Promise<void> {
  for (const s of planStates.values()) {
    if (s.started && !pty.hasSession(s.leaderId)) { const next = currentLeader(); if (next) handOver(s, next.id) }          // su líder se cerró
    const launched = await advanceRoles(s, launch)
    if (launched.length) s.notes.push(`[Tutti] Roles lanzados: ${launched.join('; ')}.`)
    if (s.notes.length && pty.hasSession(s.leaderId)) { for (const n of s.notes) notify(s.leaderId, n); s.notes = [] }
  }
}

// --- líder del plan ---
/** Pasa un plan a otro líder y le cuenta cómo va, para que pueda seguirlo sin haberlo propuesto. */
function handOver(s: PlanState, to: string): void {
  s.leaderId = to
  const info = rolesState(s.project)
  if (!info || s.finished) return
  const rows = info.roles.map((r) => `- ${r.id} (${r.name}): ${r.status}${r.agent ? ` · ${r.agent}` : ''}${r.note ? ` · ${oneLine(r.note, 120)}` : ''}`)
  notify(to, [
    `[Tutti] Ahora diriges el plan de roles${info.summary ? ` «${oneLine(info.summary, 160)}»` : ''} (su líder anterior ya no está o el usuario te eligió).`,
    ...rows,
    'Recibirás sus avisos. get_role_result te da el detalle de cada rol; los que están en review esperan accept_role o reject_role.'
  ].join('\n'))
}
/** El usuario eligió otro líder: pasa a dirigir todos los planes. */
export function leadPlans(id: string): void {
  for (const s of planStates.values()) if (s.leaderId !== id) handOver(s, id)
}

// --- propuesta y confirmación (del líder) ---
export async function proposePlan(caller: string, summary: string, input: unknown): Promise<{ ok: boolean; info: unknown }> {
  const me = pty.agentSessions().find((m) => m.id === caller)
  if (!me) return { ok: false, info: 'Solo los agentes abiertos en la app pueden proponer roles.' }
  const roles = parseRoles(expandTemplates(input, listTemplates()))
  const errors = validateRoles(roles)
  if (errors.length) return { ok: false, info: { message: 'El plan de roles no es válido: corrígelo y vuelve a llamar a propose_roles.', errors } }
  const project = rootOf(me.cwd)
  const prev = planState(project, caller)
  if (prev?.plan.roles.some((r) => roleRunning(r.id))) return { ok: false, info: 'Hay roles en marcha: espera a que terminen antes de proponer otro plan.' }
  for (const t of tasks) t.role = null          // las tareas de un plan anterior no cuentan para este
  const plan: RolePlan = { summary, status: 'proposed', roles, done: [] }
  const s = newState(project, plan, caller)
  planStates.set(project, s)
  const saved = savePlan(project, plan)
  const assigned = await assignmentsOf(s, me)
  return {
    ok: true,
    info: {
      message: `Plan de roles recibido; aún no se lanzó nada. Pasa la lista de review_checklist y atiende los warnings. Si algo no cuadra, corrige y vuelve a llamar a propose_roles; si está bien, llama a confirm_roles.${assignmentMode() === 'manual' ? ' El agente y el modelo de cada rol los elige el usuario en el panel «Plan de roles»: no los asignes tú ni esperes una asignación automática.' : ''}`,
      saved_in: saved ? '.tutti/roles.json' : 'no se pudo guardar; el plan solo está en memoria',
      review_checklist: REVIEW_CHECKLIST,
      warnings: reviewWarnings(roles, assigned, { summary, hasRoadmap: existsSync(roadmapFile(project)) }),
      roles: assignmentRows(assigned)
    }
  }
}

export async function confirmPlan(caller: string, launch: Launcher): Promise<{ ok: boolean; info: unknown }> {
  const me = pty.agentSessions().find((m) => m.id === caller)
  if (!me) return { ok: false, info: 'Solo los agentes abiertos en la app pueden confirmar roles.' }
  const s = planState(rootOf(me.cwd), caller)
  if (!s) return { ok: false, info: 'No hay un plan de roles. Propón uno con propose_roles.' }
  if (s.plan.status === 'approved') {
    s.started = true
    s.nextAt = 0
    return { ok: true, info: { status: 'approved', message: 'El plan ya estaba aprobado: la app sigue repartiendo los roles y te avisa con «[Tutti]».', launched: await advanceRoles(s, launch) } }
  }
  if (approvalRequired()) {
    s.plan.status = 'reviewed'
    savePlan(s.project, s.plan)
    toast(tm('m.roles.review'))
    return { ok: true, info: { status: 'reviewed', message: `Plan revisado. Espera al usuario${assignmentMode() === 'manual' ? ': elegirá el agente y el modelo de cada rol y lo aprobará' : ': lo aprobará'}. Entonces la app lanzará los roles y te avisará con «[Tutti]». No repartas nada mientras tanto.` } }
  }
  s.plan.status = 'approved'
  s.started = true
  s.nextAt = 0
  savePlan(s.project, s.plan)
  return { ok: true, info: { status: 'approved', message: 'Plan aprobado. La app lanza cada rol cuando terminan sus dependencias y te avisa con «[Tutti]» al terminar.', launched: await advanceRoles(s, launch) } }
}

/** Un plan que espera al usuario: hasta que lo apruebe, nadie reparte por su cuenta. */
export const waitingApproval = (dir: string): boolean => planStates.get(rootOf(dir))?.plan.status === 'reviewed'

// --- lo que hace el usuario desde el panel ---
/** El usuario aprueba el plan revisado: desde ahora la app reparte los roles. */
export function approveRoles(project: string): boolean {
  const s = planState(rootOf(project))
  if (!s || s.plan.status !== 'reviewed') return false
  if (assignmentMode() === 'manual' && missingAgent(s)) { toast(tm('m.roles.needAgents'), 'error'); return false }          // el usuario elige primero el agente de cada rol
  if (!pty.hasSession(s.leaderId)) s.leaderId = currentLeader()?.id ?? ''
  s.plan.status = 'approved'
  s.started = true
  s.nextAt = 0
  savePlan(s.project, s.plan)
  return true
}

/** Pone en marcha el reparto de un plan ya aprobado: tras reiniciar la app el plan sigue aprobado en disco, pero nada lo reparte hasta que se inicia. */
export function startRoles(project: string): boolean {
  const s = planState(rootOf(project))
  if (!s || s.plan.status !== 'approved') return false
  if (!pty.hasSession(s.leaderId)) {
    const leader = currentLeader()
    if (!leader) { toast(tm('m.roles.noLeader'), 'error'); return false }
    s.leaderId = leader.id
  }
  s.started = true
  s.finished = false
  if (s.paused) s.notes.push('[Tutti] El usuario reanudó el plan: la app vuelve a lanzar los roles que pueden empezar.')
  s.paused = false
  s.nextAt = 0
  s.retryAt.clear()
  return true
}

/** El usuario pausa el plan: no se lanzan roles nuevos; los que están en marcha siguen y su revisión también. */
export function pauseRoles(project: string): boolean {
  const s = planState(rootOf(project))
  if (!s || s.plan.status !== 'approved' || !s.started) return false
  s.started = false
  s.paused = true
  s.notes.push('[Tutti] El usuario pausó el plan: no se lanzan roles nuevos hasta que lo reanude; los que están en marcha siguen.')
  return true
}

/**
 * El usuario cancela un rol en marcha: se interrumpe a su agente (su panel sigue abierto) y el rol queda como fallido, listo para relanzar.
 * No cuenta como fallo en el historial del agente.
 */
export function cancelRole(project: string, id: string): boolean {
  const s = planState(rootOf(project))
  const t = latestRoleTask(id)
  if (!s || !t || !(active(statusOf(t)) || statusOf(t) === 'blocked')) return false
  pty.interrupt(t.agentId)
  t.asking = undefined
  t.scored = true
  t.report = { status: 'failed', summary: 'Cancelado por el usuario.', files: t.report?.files ?? [] }
  t.endedAt = Date.now()
  t.notified = false
  recordRoleResult(t)
  return true
}

/** Crea el plan del proyecto desde una plantilla: el resumen dice qué hay que hacer. Queda listo para aprobar. */
export function planFromTemplate(project: string, templateId: string, summary: string): { ok: boolean; errors: string[] } {
  const tpl = planTemplate(templateId)
  if (!tpl) return { ok: false, errors: [tm('m.roles.noTemplate')] }
  if (!summary.trim()) return { ok: false, errors: [tm('m.roles.needSummary')] }
  const root = rootOf(project)
  const s = planState(root)
  if (s && s.plan.roles.some((r) => roleStarted(s, r.id) || s.plan.done.includes(r.id))) return { ok: false, errors: [tm('m.roles.planBusy')] }
  for (const t of tasks) t.role = null
  const plan: RolePlan = { summary: summary.trim(), status: 'reviewed', roles: tpl.roles.map((r) => ({ ...r })), done: [] }
  planStates.set(root, newState(root, plan, currentLeader()?.id ?? ''))
  savePlan(root, plan)
  return { ok: true, errors: [] }
}

/** Guarda los roles del plan del proyecto como plantilla de plan. */
export function saveAsPlanTemplate(project: string, name: string): { ok: boolean; errors: string[] } {
  const plan = planStates.get(rootOf(project))?.plan ?? loadPlan(rootOf(project))
  if (!plan) return { ok: false, errors: [tm('m.roles.noPlan')] }
  const { ok, errors } = savePlanTemplate(name, plan.roles)
  return { ok, errors }
}

/** El plan de roles del proyecto para el panel; lee sin registrarlo, así un plan viejo del disco no bloquea el reparto. */
export function rolesState(project: string): RolePlanInfo | null {
  const root = rootOf(project)
  const s = planStates.get(root)
  const disk = s ? null : loadPlan(root)
  if (disk) settleInflight(disk)          // solo para mostrarlo: se guarda al cargarlo de verdad
  const plan = s?.plan ?? disk
  if (!plan) return null
  const last = new Map(plan.roles.map((r) => [r.id, s ? latestRoleTask(r.id) : undefined]))
  const task = new Map(plan.roles.map((r) => { const t = last.get(r.id); return [r.id, t ? statusOf(t) : null] }))
  const finished = (id: string): boolean => plan.done.includes(id)
  const roles = plan.roles.map((r): RoleInfo => {
    const t = last.get(r.id)
    const ts = task.get(r.id)
    const rv = plan.review?.[r.id]
    const checking = !!s?.checking.has(r.id)
    const status = finished(r.id) ? 'done' : rv || checking || ts === 'done' ? 'review' : ts === 'blocked' ? 'blocked' : ts === 'failed' || ts === 'closed' ? 'failed' : t ? 'running' : r.dependsOn.every(finished) ? 'ready' : 'waiting'
    const result = t ? t.report : plan.results?.[r.id]          // el de su última tarea; sin ella (tras reiniciar), el guardado
    const note = status === 'ready' ? s?.why.get(r.id) ?? (!t && plan.results?.[r.id]?.status === 'failed' ? plan.results[r.id].summary : undefined)
      : ts === 'needs_input' ? tm('m.roles.needsInput')
      : status === 'blocked' && t?.asking ? tm('m.roles.asking', { question: t.asking.question })
      : status === 'blocked' || status === 'failed' ? result?.summary ?? (ts === 'closed' ? tm('m.roles.closed') : undefined)
      : status === 'review' ? (checking || !rv ? (r.check ? tm('m.roles.checking', { command: r.check }) : tm('m.roles.toReview'))
        : rv.check && !rv.check.ok ? tm('m.roles.checkFailed', { command: rv.check.command })
        : rv.outside.length ? tm('m.roles.outside', { files: rv.outside.join(', ') })
        : tm('m.roles.toReview'))
      : undefined
    return { id: r.id, name: r.name, responsibility: r.responsibility, deliverables: r.deliverables, done: r.done, files: r.files, difficulty: r.difficulty, dependsOn: r.dependsOn, assign: r.assign, status, agentId: t?.agentId ?? null, agent: t ? label(t.agent) : null, model: t ? modelOf(t) : null, note,
      summary: result?.summary ?? null, changed: result?.files ?? [], ...(r.check ? { check: r.check } : {}),
      startedAt: plan.times?.[r.id]?.start ?? null, endedAt: plan.times?.[r.id]?.end ?? null,
      ...(status === 'review' ? { review: { checking: checking || !rv, ...(rv?.check ? { check: rv.check } : {}), outside: rv?.outside ?? [] } } : {}) }
  })
  const problem = s?.started && plan.status === 'approved' && !pty.hasSession(s.leaderId) ? tm('m.roles.noLeader') : undefined
  return { status: plan.status, summary: plan.summary, roles, started: !!s?.started, paused: !!s?.paused, problem, assignment: assignmentMode() }
}

/** Cambia un rol que aún no empezó. Se valida el plan entero con el cambio puesto: si no vale, no se toca nada. */
export function updateRole(project: string, id: string, edit: RoleEdit): { ok: boolean; errors: string[] } {
  const s = planState(rootOf(project))
  const role = s?.plan.roles.find((r) => r.id === id)
  if (!s || !role) return { ok: false, errors: [tm('m.roles.noPlan')] }
  if (s.plan.done.includes(id) || s.plan.review?.[id] || latestRoleTask(id)) return { ok: false, errors: [tm('m.roles.locked')] }
  const next = parseRoles([{ ...role, ...edit, id }])[0]
  const roles = s.plan.roles.map((r) => (r.id === id ? next : r))
  const errors = validateRoles(roles)
  if (errors.length) return { ok: false, errors }
  s.plan.roles = roles
  s.nextAt = 0
  savePlan(s.project, s.plan)
  return { ok: true, errors: [] }
}

/**
 * El usuario añade un rol al plan (en blanco o desde un rol reutilizable con `template`); si no hay plan, lo crea listo para aprobar.
 * Vale también con el plan en marcha: el rol nuevo se lanza cuando sus dependencias terminen.
 */
export function addRole(project: string, input: RoleEdit & { id?: string; template?: string }): { ok: boolean; errors: string[]; id?: string } {
  const root = rootOf(project)
  const existing = planState(root)
  const [raw] = expandTemplates([{ ...input, assign: input.assign ?? undefined }], listTemplates()) as unknown[]
  const base = parseRoles([raw])[0]
  const roles = existing?.plan.roles ?? []
  const id = uniqueId(base.id || slugId(base.name), roles.map((r) => r.id))
  const next = [...roles, { ...base, id }]
  const errors = validateRoles(next)
  if (errors.length) return { ok: false, errors }
  const s = existing ?? newState(root, { summary: '', status: 'reviewed', roles: [], done: [] }, currentLeader()?.id ?? '')          // armado por el usuario: ya está revisado
  planStates.set(root, s)
  s.plan.roles = next
  s.finished = false
  s.nextAt = 0
  savePlan(root, s.plan)
  return { ok: true, errors: [], id }
}

/** El usuario quita un rol que aún no empezó; deja de ser dependencia de los demás. Sin roles, el plan desaparece. */
export function removeRole(project: string, id: string): { ok: boolean; errors: string[] } {
  const root = rootOf(project)
  const s = planState(root)
  if (!s?.plan.roles.some((r) => r.id === id)) return { ok: false, errors: [tm('m.roles.noPlan')] }
  if (s.plan.done.includes(id) || s.plan.review?.[id] || latestRoleTask(id)) return { ok: false, errors: [tm('m.roles.locked')] }
  const roles = s.plan.roles.filter((r) => r.id !== id).map((r) => ({ ...r, dependsOn: r.dependsOn.filter((d) => d !== id) }))
  if (!roles.length) { discardRoles(project); return { ok: true, errors: [] } }
  const { [id]: _r, ...results } = s.plan.results ?? {}
  s.plan = { ...s.plan, roles, results }
  s.nextAt = 0
  savePlan(root, s.plan)
  return { ok: true, errors: [] }
}

/** Los agentes a los que se puede asignar un rol a mano (menos el líder, que reparte) y los modelos que ofrece cada uno. */
export async function roleOptions(project: string): Promise<RoleAgentOption[]> {
  const root = rootOf(project)
  const open = pty.agentSessions()
  const leader = currentLeader()
  const installed = detectAgents()
  const dir = leader?.cwd ?? root
  const out: RoleAgentOption[] = []
  for (const m of open) {
    if (m.id === leader?.id) continue
    out.push({ value: m.id, label: `${label(m.name)} (${m.id})`, open: true, canSetModel: !!MODEL_FLAG[m.command], models: await availableModels(m.command, installed.find((a) => a.command === m.command)?.path, m.cwd) })
  }
  for (const a of installed) out.push({ value: a.command, label: a.name, open: false, canSetModel: !!MODEL_FLAG[a.command], models: await availableModels(a.command, a.path, dir) })
  return out
}

/** Suelta un rol que falló, se bloqueó o cuyo agente se cerró: vuelve a estar listo y la app lo reparte de nuevo. */
function releaseRole(s: PlanState, id: string): Result {
  if (!s.plan.roles.some((r) => r.id === id)) return { ok: false, info: `No hay ningún rol «${id}» en el plan.` }
  if (s.plan.done.includes(id)) return { ok: false, info: `El rol «${id}» ya terminó.` }
  if (s.plan.review?.[id] || s.checking.has(id)) return { ok: false, info: `El rol «${id}» está en revisión: acéptalo o recházalo con reject_role.` }
  const t = latestRoleTask(id)
  if (!t) return { ok: false, info: `El rol «${id}» aún no empezó: la app lo lanzará cuando pueda.` }
  if (active(statusOf(t))) return { ok: false, info: `El rol «${id}» sigue en marcha.` }
  for (const x of tasks) if (x.role === id) x.role = null
  markInflight(s, id, null)
  s.fixes.delete(id)
  s.retryAt.delete(id)
  s.why.delete(id)
  s.nextAt = 0
  return { ok: true, info: `El rol «${id}» vuelve a estar listo: la app lo lanzará en cuanto haya un agente libre y te avisará con «[Tutti]».` }
}

/** retry_role: el líder relanza un rol que falló o se bloqueó. */
export function retryRoleBy(caller: string, roleId: string): Result {
  const s = planOfAgent(caller)
  return typeof s === 'string' ? { ok: false, info: s } : releaseRole(s, roleId)
}

/** El usuario relanza desde el panel un rol que falló o se bloqueó. */
export function retryRole(project: string, id: string): boolean {
  const s = planState(rootOf(project))
  return !!s && releaseRole(s, id).ok
}

/** Descarta el plan de roles del proyecto; no se puede con roles en marcha. */
export function discardRoles(project: string): boolean {
  const root = rootOf(project)
  const s = planStates.get(root)
  if (s?.plan.roles.some((r) => roleRunning(r.id))) return false
  planStates.delete(root)
  for (const t of tasks) t.role = null
  removePlan(root)
  return true
}

/** Antes de olvidar las tareas terminadas, lo que acabó queda anotado en su plan. */
export function syncAllPlans(): void {
  for (const s of planStates.values()) syncRoleDone(s)
}
