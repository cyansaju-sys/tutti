/**
 * Registro de tareas delegadas (lo que muestra el panel «Tareas»): a quién se le pasó cada una, cómo va y cómo acabó.
 * Lo que decide si una tarea terminó vive aquí; el plan de roles lo lee para saber cuándo un rol acabó.
 */
import type { TaskInfo } from '../../../shared/types'
import { isDifficulty } from './assign'
import { recordOutcome } from './history'
import { notify } from './inbox'
import { awaitingInput } from './launch'
import { currentModel } from './models'
import type { TaskReport } from './orchestra'
import * as pty from './pty'
import { BUSY_SECONDS, label, oneLine, toast } from './runtime'
import { tm } from '../../utils/i18n'
import { getSetting } from '../settings'

export interface TaskRecord extends Omit<TaskInfo, 'status' | 'model' | 'summary' | 'files'> {
  model: string | null; command: string; cwd: string; notified?: boolean
  /** Lo que el agente avisó con report_done. */
  report?: TaskReport
  /** Ya se le recordó que avise con report_done. */
  nudged?: boolean
  /** Ya se avisó al usuario de que espera un permiso (si vuelve a trabajar y lo pide otra vez, se avisa de nuevo). */
  askedInput?: boolean
  /** Ya se le dijo al líder que la tarea va para largo. */
  slowNoted?: boolean
  /** Preguntó algo con ask_leader y espera la respuesta. */
  asking?: { question: string; at: number }
  /** Ya se anotó en el historial cómo acabó. */
  scored?: boolean
}

export const tasks: TaskRecord[] = []
const STARTING_SECONDS = 8       // un agente recién abierto aún no ha dado salida: se considera trabajando
/** Agentes que hablan con el servidor MCP: tienen report_done, así que su silencio no basta para dar la tarea por terminada. */
export const connected = new Set<string>()
const NUDGE_SECONDS = 15         // en silencio tanto tiempo sin avisar: se le recuerda report_done
const REPORT_GRACE_SECONDS = 45  // tras el recordatorio, este silencio sin aviso cuenta como terminado
const SLOW_MS = 30 * 60_000      // una tarea que dura más se le señala al líder, por si el agente se atascó
export const INPUT_ROWS = 40
const NUDGE = '[Tutti] Si ya terminaste la tarea que te pasaron, llama a report_done (status done, blocked o failed, y un summary). Si sigues con ella, ignora este mensaje.'

/** Anota una tarea nueva para un agente. Si el agente estaba a medias o bloqueado con un rol, la nueva sigue con ese rol. */
export function recordTask(caller: pty.Meta, agentId: string, agent: string, command: string, task: string, opts: { difficulty?: string; model?: string; role?: string }): TaskRecord {
  const now = Date.now()
  const prev = latestTaskOf(agentId)
  const inherited = prev?.role && ['working', 'needs_input', 'blocked', 'failed'].includes(statusOf(prev)) ? prev.role : null
  for (const t of tasks) if (t.agentId === agentId && t.endedAt === null) t.endedAt = now      // si se reutiliza el agente, la anterior ya acabó
  const record: TaskRecord = { id: tasks.length ? tasks[tasks.length - 1].id + 1 : 1, agentId, agent, callerId: caller.id, caller: label(caller.name), task, model: opts.model ?? null, difficulty: opts.difficulty ?? null, role: opts.role ?? inherited,
    startedAt: now, endedAt: null, command, cwd: caller.cwd }
  tasks.push(record)
  if (tasks.length > 100) tasks.splice(0, tasks.length - 100)
  return record
}

export function statusOf(t: TaskRecord): TaskInfo['status'] {
  if (t.report) return t.report.status
  if (!pty.hasSession(t.agentId)) { t.endedAt ??= Date.now(); return 'closed' }
  if (t.asking) return 'blocked'                  // espera la respuesta a su pregunta
  if (t.endedAt !== null) return 'done'           // el agente recibió otra tarea después: esta ya acabó
  const idle = pty.idleFor(t.agentId)
  if (Date.now() - t.startedAt < STARTING_SECONDS * 1000 || idle < BUSY_SECONDS) return 'working'
  if (awaitingInput(pty.screenText(t.agentId, INPUT_ROWS))) return 'needs_input'
  if (connected.has(t.agentId) && !(t.nudged && idle >= REPORT_GRACE_SECONDS)) return 'working'          // avisará con report_done
  t.endedAt = Date.now() - idle * 1000            // terminó cuando dejó de dar salida
  return 'done'
}
export const active = (status: TaskInfo['status']): boolean => status === 'working' || status === 'needs_input'
export const latestTaskOf = (agentId: string): TaskRecord | undefined => [...tasks].reverse().find((t) => t.agentId === agentId)
export const latestRoleTask = (roleId: string): TaskRecord | undefined => [...tasks].reverse().find((t) => t.role === roleId)
/** El modelo con el que trabajó: el que se pidió o, si no, el que tiene el agente. */
export const modelOf = (t: TaskRecord): string | null => t.model ?? currentModel(t.command, t.cwd)

/** Tareas delegadas, de la más reciente a la más antigua. */
export function taskList(): TaskInfo[] {
  return [...tasks].reverse().map((t) => {
    const { command: _c, cwd: _w, report, nudged: _n, askedInput: _a, slowNoted: _s, asking, scored: _k, ...info } = t
    return { ...info, model: modelOf(t), status: statusOf(t), summary: report?.summary ?? null, files: report?.files ?? [], question: asking?.question ?? null }
  })
}

/** Quita las tareas terminadas o cuyo agente se cerró; las de un rol que no acabó bien se quedan hasta que se relance o se descarte el plan. */
export function forgetFinished(): void {
  for (let i = tasks.length - 1; i >= 0; i--) {
    const status = statusOf(tasks[i])
    if (!active(status) && (status === 'done' || !tasks[i].role)) tasks.splice(i, 1)
  }
}

const OUTCOME = { done: 'terminó', blocked: 'se bloqueó en', failed: 'no pudo hacer', closed: 'se cerró sin terminar' } as const

/** Lo que se le escribe al líder cuando una tarea suya acaba, según cómo acabó. */
function outcomeNote(t: TaskRecord, status: keyof typeof OUTCOME): string {
  const parts = [`[Tutti] ${t.agent} (${t.agentId}) ${OUTCOME[status]} la tarea «${oneLine(t.task, 80)}»${t.role ? ` (rol ${t.role})` : ''}.`]
  if (t.report) parts.push(`Resumen: ${oneLine(t.report.summary, 600)}`)
  if (t.report?.files.length) parts.push(`Archivos: ${t.report.files.slice(0, 20).join(', ')}.`)
  if (status === 'done') {
    const how = t.report ? 'Revisa el resultado antes de darlo por bueno' : `No avisó con report_done: lee el resultado con read_agent_output(agent_id: "${t.agentId}")`
    parts.push(`${how}${t.role ? ` (get_role_result(role_id: "${t.role}") te da sus archivos y cambios)` : ''}.`)
  }
  else if (status === 'blocked') parts.push(`Contéstale con answer_agent(agent_id: "${t.agentId}", answer: ...)${t.role ? '; el rol sigue siendo suyo' : ''}.`)
  else if (t.role) parts.push(`El rol «${t.role}» no cuenta como terminado: resuelve lo que haga falta y relánzalo con retry_role(role_id: "${t.role}").`)
  else parts.push(status === 'closed' ? 'Si aún hace falta, vuelve a repartirla con delegate_task.' : 'Decide si repartirla de otra forma o hacerla tú.')
  return parts.join(' ')
}

/** Anota en el historial cómo acabó una tarea (una vez): terminada cuenta como acierto; fallida o cerrada sin terminar, como fallo. */
function score(t: TaskRecord, status: TaskInfo['status']): void {
  if (t.scored || !isDifficulty(t.difficulty) || !['done', 'failed', 'closed'].includes(status)) return
  t.scored = true
  recordOutcome(t.command, modelOf(t), t.difficulty, status === 'done')
}

/**
 * Sigue las tareas delegadas: avisa al usuario si un agente espera un permiso, recuerda report_done a quien calla sin avisar,
 * señala al líder las que van para largo, anota en el historial cómo acabó cada una y se lo avisa a quien la pasó.
 * `byReview`: las tareas cuyo aviso da la revisión de su rol (con la comprobación ya hecha).
 */
export function checkTasks(byReview: (t: TaskRecord) => boolean): void {
  for (const t of tasks) {
    const status = statusOf(t)
    score(t, status)
    if (t.notified) continue
    if (status === 'needs_input') {
      if (!t.askedInput) { t.askedInput = true; toast(tm('m.hub.needsInput', { agent: label(t.agent) })) }
      continue
    }
    if (status === 'working') {
      t.askedInput = false
      if (connected.has(t.agentId) && !t.nudged && pty.idleFor(t.agentId) >= NUDGE_SECONDS) { t.nudged = true; pty.sendPrompt(t.agentId, NUDGE) }
      if (!t.slowNoted && Date.now() - t.startedAt > SLOW_MS) {
        t.slowNoted = true
        notify(t.callerId, `[Tutti] ${t.agent} (${t.agentId}) lleva más de ${SLOW_MS / 60_000} min con la tarea «${oneLine(t.task, 80)}». Mira su pantalla con read_agent_output por si se atascó.`)
      }
      continue
    }
    if (status === 'blocked' && t.asking) {
      // el usuario le contestó en su propio panel (escribió y pulsó Enter después de la pregunta): ya no espera
      if (pty.lastSubmit(t.agentId) > t.asking.at) { t.asking = undefined; t.nudged = false }
      continue
    }
    if (status === 'done' && byReview(t)) continue
    t.notified = true
    notify(t.callerId, outcomeNote(t, status))
  }
}

// --- cuántos agentes trabajan a la vez ---
const DEFAULT_PARALLEL = 4
/** Cuántos agentes pueden trabajar a la vez en tareas repartidas (`"max_parallel_agents"`; 0 = sin límite). */
function maxParallel(): number {
  const v = getSetting('max_parallel_agents')
  return typeof v === 'number' && v >= 0 ? Math.floor(v) : DEFAULT_PARALLEL
}
/** Agentes con una tarea repartida en marcha (trabajando, esperando permiso o una respuesta). */
function workingAgents(): Set<string> {
  return new Set(tasks.filter((t) => ['working', 'needs_input', 'blocked'].includes(statusOf(t))).map((t) => t.agentId))
}
/** Si dar trabajo a `agentId` (null: uno que aún no trabaja) supera el límite, el motivo; null si cabe. */
export function overLimit(agentId: string | null): string | null {
  const max = maxParallel()
  const working = workingAgents()
  if (!max || (agentId && working.has(agentId)) || working.size < max) return null
  return `ya hay ${working.size} agentes trabajando a la vez (límite ${max}, ajuste max_parallel_agents)`
}
