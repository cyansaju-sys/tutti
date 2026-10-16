/** Une el servidor MCP con los agentes abiertos: lista, reparte tareas, abre paneles y lee pantallas. */
import type { BrowserWindow } from 'electron'
import type { AppMcpInfo, OpenPane, RoleAgentOption, RoleEdit, RoleInfo, RolePlanInfo, TaskInfo } from '../../../shared/types'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { detectAgents } from './agents'
import { capableFor, exhausted, isDifficulty, capable, pickAgent, type Candidate, type Difficulty } from './assign'
import { readContext } from '../context/context'
import { projectRoot } from '../context/projectRoot'
import { codexConfig } from '../mcp/mcp'
import { dropCodexBridgeCopy } from '../mcp/mirror'
import { launchServers } from '../mcp/sync'
import { agyBridgeStatus, ensureAgyBridge } from './agyBridge'
import { buildLaunch, parseMajor, PROMPT_ARGS, taskShown } from './launch'
import { availableModels, currentModel, MODEL_FLAG, tier } from './models'
import { Orchestra, TOOLS, type AgentOutput, type Host } from './orchestra'
import * as pty from './pty'
import { loadPlan, parseRoles, removePlan, rolePrompt, savePlan, type RolePlan } from './rolePlan'
import { assignRoles, REVIEW_CHECKLIST, reviewWarnings, validateRoles, type RoleAssignment, type RoleCandidate } from './roles'
import { tm } from '../../utils/i18n'
import { roadmapFile } from '../roadmap'
import { getSetting } from '../settings'
import { claudeLimits } from '../usage/usage'

const BUSY_SECONDS = 4       // sin salida durante este tiempo = el agente ya no está trabajando
let orchestra: Orchestra | null = null
let counter = 1
let getWindow: () => BrowserWindow | null = () => null

export const newId = (): string => `a${counter++}`
const toast = (message: string, kind: 'ok' | 'error' | 'info' = 'info'): void => { getWindow()?.webContents.send('orchestra:toast', message, kind) }

// --- registro de tareas delegadas (lo que muestra el panel «Tareas») ---
interface TaskRecord extends Omit<TaskInfo, 'status' | 'model'> { model: string | null; command: string; cwd: string; notified?: boolean }
const tasks: TaskRecord[] = []
const STARTING_SECONDS = 8       // un agente recién abierto aún no ha dado salida: se considera trabajando

function recordTask(caller: pty.Meta, agentId: string, agent: string, command: string, task: string, opts: { difficulty?: string; model?: string; role?: string }): void {
  const now = Date.now()
  for (const t of tasks) if (t.agentId === agentId && t.endedAt === null) t.endedAt = now      // si se reutiliza el agente, la anterior ya acabó
  tasks.push({ id: tasks.length ? tasks[tasks.length - 1].id + 1 : 1, agentId, agent, callerId: caller.id, caller: label(caller.name), task, model: opts.model ?? null, difficulty: opts.difficulty ?? null, role: opts.role ?? null,
    startedAt: now, endedAt: null, command, cwd: caller.cwd })
  if (tasks.length > 100) tasks.splice(0, tasks.length - 100)
}

function statusOf(t: TaskRecord): TaskInfo['status'] {
  if (!pty.hasSession(t.agentId)) { t.endedAt ??= Date.now(); return 'closed' }
  if (t.endedAt !== null) return 'done'
  const idle = pty.idleFor(t.agentId)
  if (Date.now() - t.startedAt < STARTING_SECONDS * 1000 || idle < BUSY_SECONDS) return 'working'
  t.endedAt = Date.now() - idle * 1000            // terminó cuando dejó de dar salida
  return 'done'
}

/** Tareas delegadas, de la más reciente a la más antigua. */
export function taskList(): TaskInfo[] {
  return [...tasks].reverse().map((t) => {
    const { command, cwd, ...info } = t
    return { ...info, model: t.model ?? currentModel(command, cwd), status: statusOf(t) }
  })
}
/** Quita del panel las tareas ya terminadas o cuyo agente se cerró. */
export function clearTasks(): void {
  for (const s of planStates.values()) syncRoleDone(s)          // lo que terminó queda anotado en el plan antes de olvidar la tarea
  for (let i = tasks.length - 1; i >= 0; i--) if (statusOf(tasks[i]) !== 'working') tasks.splice(i, 1)
}

const NOTIFY_PATIENCE_MS = 60_000        // si el líder sigue ocupado tanto tiempo, el aviso se entrega igualmente

/** Avisa al líder (escribiéndole en su terminal) de que un agente terminó su tarea; espera a que el líder esté libre. */
function notifyLeaders(): void {
  for (const t of tasks) {
    if (t.notified) continue
    const status = statusOf(t)
    if (status === 'working') continue
    if (!pty.hasSession(t.callerId)) { t.notified = true; continue }          // el líder ya no está
    if (pty.idleFor(t.callerId) < 3 && Date.now() - (t.endedAt ?? Date.now()) < NOTIFY_PATIENCE_MS) continue
    t.notified = true
    const what = t.task.replace(/\s+/g, ' ').slice(0, 80)
    const result = status === 'closed' ? 'se cerró' : 'terminó'
    pty.sendPrompt(t.callerId, `[Tutti] ${t.agent} (${t.agentId}) ${result} la tarea «${what}». Lee el resultado con read_agent_output(agent_id: "${t.agentId}") y sigue con tu plan.`)
  }
}
let notifier: ReturnType<typeof setInterval> | null = null

const busy = (id: string): boolean => pty.idleFor(id) < BUSY_SECONDS
const label = (name: string): string => name.split(' · ')[0]

function describe(meta: pty.Meta, leaderId: string | undefined): Record<string, unknown> {
  const model = currentModel(meta.command, meta.cwd)
  const level = tier(model)
  return {
    id: meta.id, agent: meta.name, command: meta.command, model: model ?? 'desconocido', tier: level.tier, model_recognized: level.known,
    role: meta.id === leaderId ? 'líder' : meta.parentId ? `sub-agente de ${meta.parentId}` : 'trabajador',
    status: busy(meta.id) ? 'ocupado' : 'libre', project: meta.cwd
  }
}

/**
 * Entrega la tarea a los agentes que no la aceptan como argumento: se les escribe cuando su interfaz está lista y, si no aparece en su
 * pantalla una vez en reposo, se vuelve a enviar (como mucho dos veces). Los que la reciben como argumento no necesitan nada más.
 */
function deliverTask(id: string, task: string, viaArgs: boolean): void {
  if (viaArgs) return                    // ya la recibió como argumento al arrancar: reenviarla la duplicaba (el agente la contestaba varias veces)
  const deadline = Date.now() + 90_000
  let sent = -1                          // -1: aún no se ha escrito nada
  let rowsAtSend = 0                     // líneas que había al escribirla: si luego crecen mucho, el agente ya la atendió
  const timer = setInterval(() => {
    if (!pty.hasSession(id) || Date.now() > deadline) return clearInterval(timer)
    const screen = pty.screenText(id, 100_000)          // todo el historial: tras responder, el comienzo de la tarea sale de las últimas líneas
    if (!screen || pty.idleFor(id) < (sent <= 0 ? 2 : 4)) return          // interfaz sin lista o todavía trabajando
    if (sent >= 0 && taskShown(screen, task)) return clearInterval(timer)  // llegó
    if (sent > 0 && screen.split('\n').length - rowsAtSend > MIN_ANSWER_ROWS) return clearInterval(timer)          // la atendió aunque la pantalla no la muestre (p. ej. «[Pasted text]»)
    if (sent >= 2) return clearInterval(timer)                              // reintentos agotados
    pty.sendPrompt(id, task)
    rowsAtSend = screen.split('\n').length
    sent = Math.max(sent, 0) + 1
  }, 1000)
}
const MIN_ANSWER_ROWS = 4

/** Porcentaje usado del límite más ajustado de un agente (solo se conoce el de Claude; usa lo último consultado, sin pedir nada). */
async function quotaOf(command: string): Promise<number | undefined> {
  if (command !== 'claude') return undefined
  try {
    const { limits } = await claudeLimits(false)
    return limits.length ? Math.max(...limits.map((l) => l.percent)) : undefined
  } catch { return undefined }
}

/** Todo lo que se podría usar para una tarea: los paneles abiertos (menos quien pide y el líder) y los instalados por abrir. */
async function candidates(caller: string, cwd: string | undefined, withModels = false): Promise<RoleCandidate[]> {
  const open = pty.agentSessions()
  const leader = open[0]
  const quotas = new Map<string, number | undefined>()
  const quota = async (command: string): Promise<number | undefined> => {
    if (!quotas.has(command)) quotas.set(command, await quotaOf(command))
    return quotas.get(command)
  }
  const out: RoleCandidate[] = []
  for (const m of open) {
    if (m.id === caller || m.id === leader?.id) continue
    out.push({ id: m.id, name: m.name, command: m.command, tier: tier(currentModel(m.command, m.cwd)).tier, busy: busy(m.id), quota: await quota(m.command) })
  }
  for (const a of detectAgents()) {
    // los modelos solo se piden al repartir roles: leerlos puede abrir el agente un momento
    const models = withModels ? { models: await availableModels(a.command, a.path, cwd), canSetModel: !!MODEL_FLAG[a.command] } : {}
    out.push({ name: a.name, command: a.command, tier: tier(cwd ? currentModel(a.command, cwd) : null).tier, busy: false, quota: await quota(a.command), ...models })
  }
  return out
}

const nameOf = (c: Candidate): string => (c.id ? `${c.name} (${c.id})` : `${c.name} (por abrir)`)

// --- plan de roles (propose_roles / confirm_roles) ---
interface PlanState {
  project: string
  plan: RolePlan
  /** Agente que lo propuso: a él se le lanzan los roles (su carpeta, su aviso al terminar). */
  leaderId: string
  /** Aprobado y en reparto: la app lanza cada rol cuando se puede. */
  started: boolean
  advancing: boolean
  launching: Set<string>
  retryAt: Map<string, number>
  /** Por qué un rol listo aún no arrancó (para mostrarlo en el panel). */
  why: Map<string, string>
  nextAt: number
  finished: boolean
  /** Avisos para el líder que esperan a que esté libre. */
  notes: string[]
}
const planStates = new Map<string, PlanState>()
const RETRY_ROLE_MS = 60_000           // un rol que no pudo lanzarse se reintenta pasado este tiempo
const IDLE_CHECK_MS = 10_000           // sin nadie libre, no se vuelve a mirar hasta pasado este tiempo
/** Con `"roles_approval": false` en los ajustes el plan se reparte en cuanto el líder lo confirma, sin esperar al usuario. */
const approvalRequired = (): boolean => getSetting('roles_approval') !== false
/** Quién elige el agente y el modelo de cada rol: el usuario (por defecto) o la app según capacidad, con `"roles_assignment": "auto"`. */
const assignmentMode = (): 'manual' | 'auto' => (getSetting('roles_assignment') === 'auto' ? 'auto' : 'manual')
const missingAgent = (s: PlanState): boolean => s.plan.roles.some((r) => !s.plan.done.includes(r.id) && !r.assign)

const newState = (project: string, plan: RolePlan, leaderId: string): PlanState =>
  ({ project, plan, leaderId, started: false, advancing: false, launching: new Set(), retryAt: new Map(), why: new Map(), nextAt: 0, finished: false, notes: [] })

/** El plan del proyecto: el que está en memoria o, si no, el guardado en `.tutti/roles.json`. */
function planState(project: string, leaderId?: string): PlanState | null {
  let s = planStates.get(project) ?? null
  if (!s) {
    const plan = loadPlan(project)
    if (!plan) return null
    s = newState(project, plan, leaderId ?? pty.agentSessions()[0]?.id ?? '')
    planStates.set(project, s)
  }
  if (leaderId) s.leaderId = leaderId
  return s
}

const latestRoleTask = (roleId: string): TaskRecord | undefined => [...tasks].reverse().find((t) => t.role === roleId)
const roleRunning = (roleId: string): boolean => { const t = latestRoleTask(roleId); return !!t && statusOf(t) === 'working' }

/** Anota como hechos los roles cuyo agente terminó (o cerró su panel); así no se pierden si se limpia el panel de tareas. */
function syncRoleDone(s: PlanState): void {
  let changed = false
  for (const r of s.plan.roles) {
    const t = latestRoleTask(r.id)
    if (s.plan.done.includes(r.id) || !t || statusOf(t) === 'working') continue
    s.plan.done.push(r.id)
    changed = true
  }
  if (changed) savePlan(s.project, s.plan)
}

/** Los agentes que tienen un rol en marcha cuentan como ocupados: uno, un rol. */
function markHeld(list: RoleCandidate[]): RoleCandidate[] {
  const held = new Set(tasks.filter((t) => t.role && statusOf(t) === 'working').map((t) => t.agentId))
  return list.map((c) => (c.id && held.has(c.id) ? { ...c, busy: true } : c))
}

async function assignmentsOf(s: PlanState, me: pty.Meta): Promise<RoleAssignment[]> {
  const active = new Set(s.plan.roles.filter((r) => roleRunning(r.id) || s.launching.has(r.id)).map((r) => r.id))
  const roles = s.plan.roles.filter((r) => (s.retryAt.get(r.id) ?? 0) <= Date.now())          // el que falló hace poco no se guarda agente
  return assignRoles(roles, markHeld(await candidates(me.id, me.cwd, true)), { done: new Set(s.plan.done), active, manual: assignmentMode() === 'manual' })
}

const assignmentRows = (list: RoleAssignment[]): unknown[] => list.map((a) => ({
  role: a.role.id, status: a.status, agent: a.agent ? nameOf(a.agent) : null, model: a.model, below_requested_level: a.downgraded || undefined,
  why: a.reason, waiting_for: a.waitingOn.length ? a.waitingOn : undefined
}))

/** Lanza los roles que ya se pueden (con sus dependencias terminadas y un agente libre). Devuelve qué se hizo, para avisar al líder. */
async function advanceRoles(s: PlanState): Promise<string[]> {
  if (!s.started || s.plan.status !== 'approved' || s.advancing) return []
  const me = pty.agentSessions().find((m) => m.id === s.leaderId)
  if (!me) return []
  syncRoleDone(s)
  const done = new Set(s.plan.done)
  if (done.size >= s.plan.roles.length) {
    if (!s.finished) { s.finished = true; s.notes.push('[Tutti] Todos los roles del plan terminaron. Revisa cada entregable contra el criterio de terminado de su rol.') }
    return []
  }
  const now = Date.now()
  if (now < s.nextAt) return []
  const ready = s.plan.roles.filter((r) => !done.has(r.id) && !roleRunning(r.id) && !s.launching.has(r.id) && (s.retryAt.get(r.id) ?? 0) <= now && r.dependsOn.every((d) => done.has(d)))
  if (!ready.length) return []
  s.advancing = true
  try {
    const launched: string[] = []
    for (const a of await assignmentsOf(s, me)) {
      if (a.status === 'queued' || a.status === 'unassigned') s.why.set(a.role.id, a.reason)
      if (a.status !== 'assigned' || !a.agent) continue
      s.launching.add(a.role.id)
      try {
        const res = await host.delegate(me.id, a.agent.id ?? a.agent.command, rolePrompt(a.role, s.plan), !a.agent.id, { difficulty: a.role.difficulty, force: true, model: a.model ?? undefined, role: a.role.id })
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

/** Avanza cada plan en marcha y le entrega al líder, cuando está libre, lo que haya pasado. */
async function tickRoles(): Promise<void> {
  for (const s of planStates.values()) {
    const launched = await advanceRoles(s)
    if (launched.length) s.notes.push(`[Tutti] Roles lanzados: ${launched.join('; ')}.`)
    if (s.notes.length && pty.hasSession(s.leaderId) && pty.idleFor(s.leaderId) >= 3) { pty.sendPrompt(s.leaderId, s.notes.join('\n')); s.notes = [] }
  }
}

/** El usuario aprueba el plan que el líder dejó revisado: desde ahora la app reparte los roles. */
export function approveRoles(project: string): boolean {
  const s = planState(projectRoot(project, knownProjects()))
  if (!s || s.plan.status !== 'reviewed') return false
  if (assignmentMode() === 'manual' && missingAgent(s)) { toast(tm('m.roles.needAgents'), 'error'); return false }          // el usuario elige primero el agente de cada rol
  if (!pty.hasSession(s.leaderId)) s.leaderId = pty.agentSessions()[0]?.id ?? ''
  s.plan.status = 'approved'
  s.started = true
  s.nextAt = 0
  savePlan(s.project, s.plan)
  return true
}

/** El plan de roles del proyecto para el panel; lee sin registrarlo, así un plan viejo del disco no bloquea el reparto. */
export function rolesState(project: string): RolePlanInfo | null {
  const root = projectRoot(project, knownProjects())
  const s = planStates.get(root)
  const plan = s?.plan ?? loadPlan(root)
  if (!plan) return null
  const last = new Map(plan.roles.map((r) => [r.id, s ? latestRoleTask(r.id) : undefined]))
  const finished = (id: string): boolean => plan.done.includes(id) || (!!last.get(id) && statusOf(last.get(id)!) !== 'working')
  const roles = plan.roles.map((r): RoleInfo => {
    const t = last.get(r.id)
    const status = finished(r.id) ? 'done' : t ? 'running' : r.dependsOn.every(finished) ? 'ready' : 'waiting'
    return { id: r.id, name: r.name, responsibility: r.responsibility, deliverables: r.deliverables, done: r.done, files: r.files, difficulty: r.difficulty, dependsOn: r.dependsOn, assign: r.assign, status, agentId: t?.agentId ?? null, agent: t ? label(t.agent) : null, model: t ? t.model ?? currentModel(t.command, t.cwd) : null, note: status === 'ready' ? s?.why.get(r.id) : undefined }
  })
  const problem = s?.started && plan.status === 'approved' && !pty.hasSession(s.leaderId) ? tm('m.roles.noLeader') : undefined
  return { status: plan.status, summary: plan.summary, roles, started: !!s?.started, problem, assignment: assignmentMode() }
}

/** Pone en marcha el reparto de un plan ya aprobado: tras reiniciar la app el plan sigue aprobado en disco, pero nada lo reparte hasta que se inicia. */
export function startRoles(project: string): boolean {
  const s = planState(projectRoot(project, knownProjects()))
  if (!s || s.plan.status !== 'approved') return false
  if (!pty.hasSession(s.leaderId)) {
    const leader = pty.agentSessions()[0]
    if (!leader) { toast(tm('m.roles.noLeader'), 'error'); return false }
    s.leaderId = leader.id
  }
  s.started = true
  s.finished = false
  s.nextAt = 0
  s.retryAt.clear()
  return true
}

/** Cambia un rol que aún no empezó. Se valida el plan entero con el cambio puesto: si no vale, no se toca nada. */
export function updateRole(project: string, id: string, edit: RoleEdit): { ok: boolean; errors: string[] } {
  const s = planState(projectRoot(project, knownProjects()))
  const role = s?.plan.roles.find((r) => r.id === id)
  if (!s || !role) return { ok: false, errors: [tm('m.roles.noPlan')] }
  if (s.plan.done.includes(id) || latestRoleTask(id)) return { ok: false, errors: [tm('m.roles.locked')] }
  const next = parseRoles([{ ...role, ...edit, id }])[0]
  const roles = s.plan.roles.map((r) => (r.id === id ? next : r))
  const errors = validateRoles(roles)
  if (errors.length) return { ok: false, errors }
  s.plan.roles = roles
  s.nextAt = 0
  savePlan(s.project, s.plan)
  return { ok: true, errors: [] }
}

/** Los agentes a los que se puede asignar un rol a mano (menos el líder, que reparte) y los modelos que ofrece cada uno. */
export async function roleOptions(project: string): Promise<RoleAgentOption[]> {
  const root = projectRoot(project, knownProjects())
  const open = pty.agentSessions()
  const leader = open[0]
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

/** Descarta el plan de roles del proyecto; no se puede con roles en marcha. */
export function discardRoles(project: string): boolean {
  const root = projectRoot(project, knownProjects())
  const s = planStates.get(root)
  if (s?.plan.roles.some((r) => roleRunning(r.id))) return false
  planStates.delete(root)
  for (const t of tasks) t.role = null
  removePlan(root)
  return true
}

const host: Host = {
  async listAgents(caller) {
    const open = pty.agentSessions()
    const leader = open[0]
    const project = leader?.cwd
    return {
      open_agents: await Promise.all(open.map(async (m) => ({ ...describe(m, leader?.id), quota_used_percent: (await quotaOf(m.command)) ?? 'desconocido', available_models: await availableModels(m.command, detectAgents().find((a) => a.command === m.command)?.path, m.cwd) }))),
      installed_agents: await Promise.all(detectAgents().map(async (a) => {
        const model = project ? currentModel(a.command, project) : null
        const level = tier(model).tier
        return { agent: a.name, command: a.command, last_model: model ?? 'desconocido', tier: level, can_handle: capableFor({ tier: level }), available_models: await availableModels(a.command, a.path, project), quota_used_percent: (await quotaOf(a.command)) ?? 'desconocido' }
      })),
      you_are: caller, lead: leader?.id ?? null
    }
  },

  reported(agentId) {
    for (const t of tasks) if (t.agentId === agentId) t.notified = true
  },

  async delegate(caller, requested, task, newInstance, opts = {}) {
    const open = pty.agentSessions()
    const me = open.find((m) => m.id === caller)
    if (!me) return { ok: false, info: 'Solo los agentes abiertos en la app pueden repartir tareas.' }
    // un plan revisado espera al usuario: hasta que lo apruebe, nadie reparte por su cuenta (los roles del propio plan sí pasan)
    if (!opts.role && planStates.get(projectRoot(me.cwd, knownProjects()))?.plan.status === 'reviewed') {
      return { ok: false, info: 'Hay un plan de roles esperando la aprobación del usuario. No repartas tareas hasta que la dé: la app lanzará los roles y te avisará con «[Tutti]».' }
    }
    let target = requested
    const difficulty: Difficulty | undefined = isDifficulty(opts.difficulty) ? opts.difficulty : undefined
    let assigned = ''
    if (difficulty) {
      // revisa el listado de agentes y comprueba que el elegido tenga capacidad para la tarea
      const list = await candidates(caller, me.cwd)
      const best = pickAgent(list, difficulty)
      if (!target || target.toLowerCase() === 'auto') {
        if (!best.chosen) return { ok: false, info: `No se pudo asignar: ${best.reason}.` }
        target = best.chosen.id ?? best.chosen.command
        assigned = `Asignado a ${nameOf(best.chosen)}: ${best.reason}.`
      } else if (!opts.force) {
        const wanted = target.toLowerCase()
        const match = list.find((c) => c.id === target) ?? list.find((c) => !c.id && (c.command.toLowerCase() === wanted || c.name.toLowerCase() === wanted))
        if (match && (!capable(match, difficulty) || exhausted(match))) {
          const why = exhausted(match) ? `agotó su límite de uso (${match.quota}%)` : `es de nivel ${match.tier} y la tarea es ${difficulty}`
          const alt = best.chosen && best.chosen !== match ? ` Mejor opción: ${nameOf(best.chosen)} (${best.reason}). Vuelve a llamar con ese agente, con agent "auto", o con force=true para mantener ${nameOf(match)}.` : ' Usa force=true para mantenerlo igualmente.'
          return { ok: false, info: `${nameOf(match)} ${why}.${alt}` }
        }
      }
    }
    if (target === caller) return { ok: false, info: 'No puedes delegarte una tarea a ti mismo.' }
    // modelo pedido: se comprueba que el agente lo ofrezca y que se pueda fijar al arrancar; uno abierto con otro modelo no sirve
    const model = opts.model
    let modelArgs: string[] = []
    if (model) {
      const openTarget = open.find((m) => m.id === target)
      const command = openTarget?.command ?? detectAgents().find((a) => a.command.toLowerCase() === target.toLowerCase() || a.name.toLowerCase() === target.toLowerCase())?.command
      if (!command) return { ok: false, info: `No conozco el agente '${target}'. Usa list_agents para ver los disponibles.` }
      const flag = MODEL_FLAG[command]
      if (!flag) return { ok: false, info: `${command} no permite elegir el modelo al abrirlo desde aquí. Cámbialo a mano en su panel o pide otro agente (con model: ${Object.keys(MODEL_FLAG).join(', ')}).` }
      const offered = await availableModels(command, detectAgents().find((a) => a.command === command)?.path, openTarget?.cwd ?? open[0]?.cwd)
      if (offered.length && !offered.some((m) => m.id === model)) return { ok: false, info: `${command} no ofrece el modelo '${model}'. Disponibles: ${offered.map((m) => m.id).join(', ')}.` }
      modelArgs = [flag, model]
      if (openTarget) {
        if ((currentModel(command, openTarget.cwd) ?? '').includes(model)) modelArgs = []      // ya usa ese modelo
        else { target = command; newInstance = true }
      } else newInstance = true
    }
    const leader = open[0]
    let pane = open.find((m) => m.id === target)
    if (!pane) {
      const wanted = target.toLowerCase()
      const match = detectAgents().find((a) => a.command.toLowerCase() === wanted || a.name.toLowerCase() === wanted)
      if (!match) return { ok: false, info: `No conozco el agente '${target}'. Usa list_agents para ver los disponibles.` }
      // uno libre del mismo tipo, que no sea quien pide ni el líder (no se le quita el trabajo al líder)
      if (!newInstance) pane = open.find((m) => m.id !== caller && m.id !== leader?.id && m.command === match.command && !busy(m.id))
      if (!pane) {
        const win = getWindow()
        if (!win) return { ok: false, info: 'No se pudo abrir el agente: la ventana no está disponible.' }
        const id = newId()
        const request: OpenPane = { id, name: match.name, command: match.command, args: [...(match.args ?? []), ...modelArgs], cwd: me.cwd, prompt: task, parentId: caller }
        win.webContents.send('orchestra:open-pane', request)         // la interfaz crea su panel; la terminal inicia el proceso
        if (!(await pty.waitForSpawn(id, 20_000))) return { ok: false, info: `No se pudo abrir ${match.name}: no arrancó a tiempo.` }
        recordTask(me, id, match.name, match.command, task, { difficulty, model, role: opts.role })
        toast(tm('m.hub.opened', { leader: label(me.name), agent: match.name }))
        return { ok: true, info: { agent_id: id, message: `${assigned} Abrí ${match.name}${model ? ` con el modelo ${model}` : ''} en su propio panel con la tarea. Usa wait_agent para esperar su resultado.`.trim() } }
      }
    }
    pty.sendPrompt(pane.id, task)
    recordTask(me, pane.id, pane.name, pane.command, task, { difficulty, model, role: opts.role })
    toast(tm('m.hub.delegated', { leader: label(me.name), agent: label(pane.name) }))
    return { ok: true, info: { agent_id: pane.id, message: `${assigned} Tarea enviada. Usa wait_agent para esperar su resultado.`.trim() } }
  },

  async proposeRoles(caller, summary, input) {
    const me = pty.agentSessions().find((m) => m.id === caller)
    if (!me) return { ok: false, info: 'Solo los agentes abiertos en la app pueden proponer roles.' }
    const roles = parseRoles(input)
    const errors = validateRoles(roles)
    if (errors.length) return { ok: false, info: { message: 'El plan de roles no es válido: corrígelo y vuelve a llamar a propose_roles.', errors } }
    const project = projectRoot(me.cwd, knownProjects())
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
  },

  async confirmRoles(caller) {
    const me = pty.agentSessions().find((m) => m.id === caller)
    if (!me) return { ok: false, info: 'Solo los agentes abiertos en la app pueden confirmar roles.' }
    const s = planState(projectRoot(me.cwd, knownProjects()), caller)
    if (!s) return { ok: false, info: 'No hay un plan de roles. Propón uno con propose_roles.' }
    if (s.plan.status === 'approved') {
      s.started = true
      s.nextAt = 0
      return { ok: true, info: { status: 'approved', message: 'El plan ya estaba aprobado: la app sigue repartiendo los roles y te avisa con «[Tutti]».', launched: await advanceRoles(s) } }
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
    return { ok: true, info: { status: 'approved', message: 'Plan aprobado. La app lanza cada rol cuando terminan sus dependencias y te avisa con «[Tutti]» al terminar.', launched: await advanceRoles(s) } }
  },

  output(agentId, lines): AgentOutput | null {
    if (!pty.hasSession(agentId)) return null
    const idle = pty.idleFor(agentId)
    return { agent_id: agentId, busy: idle < BUSY_SECONDS, idle_seconds: Math.round(idle * 10) / 10, text: pty.screenText(agentId, Math.max(5, Math.min(lines, 400))) }
  }
}

/** Arranca el servidor de reparto de tareas (se desactiva con `"orchestration": false` en los ajustes). */
export async function startHub(window: () => BrowserWindow | null): Promise<void> {
  getWindow = window
  // el gancho va siempre: sin servidor de reparto de tareas los agentes siguen recibiendo el contexto del proyecto
  pty.setLaunchHook((opts): pty.Launch => {
    const entry = orchestra?.configFor(opts.id) ?? null
    if (entry && opts.command === 'agy') ensureAgyBridge()
    if (entry && opts.command === 'codex') dropCodexBridgeCopy(codexConfig())      // una copia stdio de «tutti» impide pasarle el suyo por -c
    const prompt = opts.prompt?.trim()
    const context = opts.cwd ? readContext(projectRoot(opts.cwd, knownProjects())) ?? undefined : undefined
    const root = opts.cwd ? projectRoot(opts.cwd, knownProjects()) : null
    const project = opts.command === 'opencode' && root ? launchServers(root) : []          // los MCP del .mcp.json, en lugar de un opencode.json
    const launch = buildLaunch(opts.command, entry, prompt, opts.args ?? [], opts.command === 'opencode' ? opencodeMajor() : 2, context, project)
    // los agentes que no aceptan la tarea como argumento la reciben escrita cuando su interfaz está lista
    const after = prompt ? () => deliverTask(opts.id, prompt, !!PROMPT_ARGS[opts.command]) : undefined
    return { ...launch, after }
  })
  if (getSetting('orchestration') === false) return
  if (detectAgents().some((a) => a.command === 'agy')) ensureAgyBridge()      // renueva la ruta del puente si la app cambió de sitio
  notifier ??= setInterval(() => { notifyLeaders(); void tickRoles().catch(() => undefined) }, 2000)
  try { orchestra = await new Orchestra(host).start() } catch { /* sin servidor local la app funciona igual */ }
}

/** Proyecto abierto y los del historial: sirven para saber a cuál pertenece la carpeta de un agente. */
function knownProjects(): string[] {
  const recent = getSetting('recent_projects')
  return [getSetting('project'), ...(Array.isArray(recent) ? recent : [])].filter((p): p is string => typeof p === 'string' && !!p)
}

let majorCache: number | null = null
/** Versión principal de OpenCode instalada (cambia cómo se le conecta el MCP). */
function opencodeMajor(): number {
  if (majorCache === null) {
    const exe = detectAgents().find((a) => a.command === 'opencode')?.path
    try { majorCache = exe ? parseMajor(execFileSync(exe, ['--version'], { encoding: 'utf8', timeout: 4000 })) : 2 } catch { majorCache = 2 }
  }
  return majorCache
}

export const stopHub = (): void => { orchestra?.stop(); if (notifier) clearInterval(notifier); notifier = null }

/** Configuración MCP de un agente (para las pruebas); null si el servidor no arrancó. */
export const orchestraConfig = (id: string): ReturnType<Orchestra['configFor']> | null => orchestra?.configFor(id) ?? null

/** El servidor MCP de la app y a qué agentes se aplica (lo que muestra la sección global de MCP). */
export function appMcpInfo(): AppMcpInfo {
  const installed = new Set(detectAgents().map((a) => a.command))
  const on = orchestra !== null
  const per = (command: string, name: string, how = tm('m.hub.appOnOpen')): AppMcpInfo['agents'][number] => ({ command, name, installed: installed.has(command), applied: on && installed.has(command), how })
  const agy = agyBridgeStatus()
  return {
    running: on, tools: TOOLS.map((t) => t.name),
    agents: [
      per('claude', 'Claude Code'),
      per('opencode', 'OpenCode'),
      { ...per('agy', 'Antigravity', tm('m.hub.agyHow')), applied: on && installed.has('agy') && agy.ok, problem: agy.ok ? undefined : agy.problem },
      per('codex', 'Codex'),
      { command: 'gemini', name: 'Gemini CLI', installed: installed.has('gemini'), applied: false, how: tm('m.hub.notSupported') }
    ]
  }
}
