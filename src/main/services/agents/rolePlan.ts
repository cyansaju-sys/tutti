/**
 * El plan de roles de un proyecto: lo que propone el líder, su estado de aprobación y qué roles ya terminaron.
 * Se guarda en `.tutti/roles.json` (se versiona con el proyecto); qué agente tiene cada rol solo vive en memoria.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureProjectDir, tuttiDir } from '../context/context'
import { isDifficulty } from './assign'
import { isReportStatus, type TaskReport } from './orchestra'
import { validateRoles, type Role } from './roles'

/** proposed: lo propuso el líder · reviewed: el líder lo revisó y espera al usuario · approved: se puede repartir. */
export type PlanStatus = 'proposed' | 'reviewed' | 'approved'

/** Lo que el agente de un rol dijo con report_done la última vez (sobrevive a reinicios y a limpiar el panel de tareas). */
export interface RoleResult extends TaskReport { agent: string; at: number }

/** Lo que dio el comando de comprobación de un rol. */
export interface CheckResult { command: string; ok: boolean; output: string }

/** Un rol terminado que espera a que el líder o el usuario lo acepte o lo rechace. */
export interface RoleReview {
  /** Agente que lo hizo: a él vuelve si se rechaza. */
  agentId: string; agent: string; command: string
  check?: CheckResult
  /** Archivos que dijo haber tocado y no son suyos. */
  outside: string[]
  at: number
}

export interface RolePlan {
  /** Resumen del plan o dónde está (roadmap, cambio de OpenSpec). */
  summary: string
  status: PlanStatus
  roles: Role[]
  /** Roles terminados y aceptados: los que dependen de ellos ya pueden empezar. */
  done: string[]
  /** Resultado de cada rol que avisó con report_done, por id de rol. */
  results?: Record<string, RoleResult>
  /** Roles en revisión, por id de rol. */
  review?: Record<string, RoleReview>
  /** Roles con un agente trabajando ahora, por id de rol: si la app se cierra, al volver se sabe que quedaron a medias. */
  inflight?: Record<string, { agent: string; at: number }>
  /** Cuándo empezó cada rol (su primera tarea) y cuándo quedó aceptado: la línea de tiempo del plan. */
  times?: Record<string, { start: number; end?: number }>
}

/**
 * Un plan leído del disco no tiene agentes vivos: los roles que estaban en marcha quedaron a medias. Pasan a «falló» con un resumen que
 * lo explica (lo recibe quien lo retome) y vuelven a estar listos. Devuelve si cambió algo.
 */
export function settleInflight(plan: RolePlan, now = Date.now()): boolean {
  const pending = Object.entries(plan.inflight ?? {}).filter(([id]) => !plan.done.includes(id) && !plan.review?.[id])
  delete plan.inflight
  if (!pending.length) return false
  const results = { ...plan.results }
  for (const [id, { agent }] of pending) {
    results[id] = { status: 'failed', summary: `La app se cerró mientras ${agent || 'su agente'} trabajaba en este rol: puede haber trabajo a medias en sus archivos.`, files: results[id]?.files ?? [], agent, at: now }
  }
  plan.results = results
  return true
}

export const rolesFile = (project: string): string => join(tuttiDir(project), 'roles.json')

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : [])
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Los roles tal como llegan de un agente (JSON sin fiar): lo que falta o sobra queda para que `validateRoles` lo señale. */
export function parseRoles(input: unknown): Role[] {
  if (typeof input === 'string') { try { input = JSON.parse(input) } catch { return [] } }          // algunos modelos mandan la lista como texto JSON
  if (!Array.isArray(input)) return []
  return input.map((raw): Role => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const pick = (r.assign && typeof r.assign === 'object' ? r.assign : {}) as Record<string, unknown>
    const agent = text(pick.agent)
    const assign = agent ? { agent, ...(text(pick.model) ? { model: text(pick.model) } : {}) } : undefined
    return {
      id: text(r.id), name: text(r.name), responsibility: text(r.responsibility), deliverables: strings(r.deliverables), done: text(r.done),
      files: strings(r.files), difficulty: (isDifficulty(r.difficulty) ? r.difficulty : text(r.difficulty)) as Role['difficulty'], dependsOn: strings(r.dependsOn),
      ...(assign ? { assign } : {}), ...(text(r.check) ? { check: text(r.check) } : {})
    }
  })
}

/** Los resultados guardados, sin fiar: solo los de roles que existen y con un estado válido. */
function parseResults(input: unknown, ids: Set<string>): Record<string, RoleResult> {
  const out: Record<string, RoleResult> = {}
  if (!input || typeof input !== 'object') return out
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    if (!ids.has(id) || !isReportStatus(r.status)) continue
    out[id] = { status: r.status, summary: text(r.summary), files: strings(r.files), agent: text(r.agent), at: typeof r.at === 'number' ? r.at : 0 }
  }
  return out
}

/** Las revisiones pendientes guardadas: solo de roles que existen y aún no se aceptaron. */
function parseReview(input: unknown, ids: Set<string>, done: Set<string>): Record<string, RoleReview> {
  const out: Record<string, RoleReview> = {}
  if (!input || typeof input !== 'object') return out
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    if (!ids.has(id) || done.has(id)) continue
    const c = (r.check && typeof r.check === 'object' ? r.check : null) as Record<string, unknown> | null
    out[id] = {
      agentId: text(r.agentId), agent: text(r.agent), command: text(r.command), outside: strings(r.outside), at: typeof r.at === 'number' ? r.at : 0,
      ...(c && text(c.command) ? { check: { command: text(c.command), ok: c.ok === true, output: typeof c.output === 'string' ? c.output : '' } } : {})
    }
  }
  return out
}

/** El plan guardado del proyecto; null si no hay o no es válido. */
export function loadPlan(project: string): RolePlan | null {
  const file = rolesFile(project)
  if (!existsSync(file)) return null
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    const roles = parseRoles(raw.roles)
    if (validateRoles(roles).length) return null
    const status: PlanStatus = raw.status === 'approved' || raw.status === 'reviewed' ? raw.status : 'proposed'
    const ids = new Set(roles.map((r) => r.id))
    const done = strings(raw.done).filter((d) => ids.has(d))
    const results = parseResults(raw.results, ids)
    const review = parseReview(raw.review, ids, new Set(done))
    const inflight: Record<string, { agent: string; at: number }> = {}
    for (const [id, v] of Object.entries((raw.inflight && typeof raw.inflight === 'object' ? raw.inflight : {}) as Record<string, Record<string, unknown>>)) {
      if (ids.has(id) && v && typeof v === 'object') inflight[id] = { agent: text(v.agent), at: typeof v.at === 'number' ? v.at : 0 }
    }
    const times: Record<string, { start: number; end?: number }> = {}
    for (const [id, v] of Object.entries((raw.times && typeof raw.times === 'object' ? raw.times : {}) as Record<string, Record<string, unknown>>)) {
      if (ids.has(id) && v && typeof v.start === 'number') times[id] = { start: v.start, ...(typeof v.end === 'number' ? { end: v.end } : {}) }
    }
    return { summary: text(raw.summary), status, roles, done, ...(Object.keys(results).length ? { results } : {}), ...(Object.keys(review).length ? { review } : {}), ...(Object.keys(inflight).length ? { inflight } : {}), ...(Object.keys(times).length ? { times } : {}) }
  } catch {
    return null
  }
}

export function savePlan(project: string, plan: RolePlan): boolean {
  try {
    ensureProjectDir(project)
    writeFileSync(rolesFile(project), JSON.stringify(plan, null, 2) + '\n', 'utf8')
    return true
  } catch {
    return false          // proyecto de solo lectura: el plan sigue vivo en memoria
  }
}

/** Borra el plan guardado del proyecto. */
export function removePlan(project: string): void {
  try { unlinkSync(rolesFile(project)) } catch { /* ya no estaba */ }
}

/** Archivos en los que buscar el trabajo de un rol: los suyos y los que dijo haber tocado. */
export function roleFiles(role: Role, result?: RoleResult): string[] {
  return [...new Set([...role.files, ...(result?.files ?? [])])]
}

/**
 * Qué se le escribe al agente que recibe un rol. Lleva lo que entregaron los roles de los que depende (su resumen, sus archivos y,
 * en `changes`, los cambios sin commit en ellos, por id de rol) y, si es un reintento, lo que pasó en el intento anterior.
 */
export function rolePrompt(role: Role, plan: RolePlan, changes: Record<string, string> = {}): string {
  const others = plan.roles.filter((r) => r.id !== role.id)
  const results = plan.results ?? {}
  const dep = (id: string): string => {
    const r = plan.roles.find((x) => x.id === id)
    const res = results[id]
    const files = r ? roleFiles(r, res) : []
    return [
      `- ${id}${r ? ` (${r.name})` : ''}: ${res?.summary || 'no dejó resumen; mira sus archivos.'}`,
      files.length ? `  Archivos: ${files.join(', ')}` : '',
      changes[id] ? `  Cambios sin commit:\n${changes[id].split('\n').map((l) => `    ${l}`).join('\n')}` : ''
    ].filter(Boolean).join('\n')
  }
  const previous = results[role.id]
  const lines = [
    `[Rol «${role.name}» (${role.id})] Eres una parte de un plan repartido entre varios agentes; solo haces la tuya.`,
    plan.summary ? `Plan: ${plan.summary}` : '',
    `Responsabilidad: ${role.responsibility}`,
    `Entregables:\n${role.deliverables.map((d) => `- ${d}`).join('\n')}`,
    `Criterio de terminado: ${role.done}`,
    role.files.length
      ? `Archivos que son tuyos (solo editas estos): ${role.files.join(', ')}`
      : 'No tienes archivos propios: lees lo que necesites, pero no edites nada.',
    role.dependsOn.length ? `Ya terminaron los roles de los que dependes: ${role.dependsOn.join(', ')}. Su trabajo está en el proyecto:\n${role.dependsOn.map(dep).join('\n')}` : '',
    previous && previous.status !== 'done'
      ? `Este rol ya se intentó antes y ${previous.status === 'blocked' ? 'se bloqueó' : 'falló'}${previous.agent ? ` (${previous.agent})` : ''}: ${previous.summary}${previous.files.length ? `\nTocó: ${previous.files.join(', ')}` : ''}\nParte de ese trabajo puede estar ya en el proyecto: revísalo antes de empezar.`
      : '',
    others.length ? `Otros roles del plan (no toques sus archivos):\n${others.map((r) => `- ${r.id}: ${r.name}${r.files.length ? ` (${r.files.join(', ')})` : ''}`).join('\n')}` : '',
    role.check ? `Al terminar, la app ejecutará \`${role.check}\` en la raíz del proyecto para comprobarlo: asegúrate de que pase.` : '',
    'Tu entrega se revisa antes de darla por buena: si se rechaza, recibirás aquí qué corregir.',
    'Si te falta información, pregunta con ask_leader en vez de suponer. Antes de fijar algo que afecte a otros roles (nombres, contratos, formatos), mira read_notes y deja tu decisión con post_note.',
    'Al terminar, llama a report_done (del servidor «tutti») con status "done", y en summary qué hiciste, qué entregaste y si algo del criterio de terminado no se cumple. ' +
      'Si te falta una respuesta para seguir, usa status "blocked" y explica qué necesitas; si no puedes hacerlo, "failed" y por qué. Si no tienes esa herramienta, escribe ese resumen al final.'
  ]
  return lines.filter(Boolean).join('\n\n')
}
