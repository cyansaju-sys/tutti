/**
 * El plan de roles de un proyecto: lo que propone el líder, su estado de aprobación y qué roles ya terminaron.
 * Se guarda en `.tutti/roles.json` (se versiona con el proyecto); qué agente tiene cada rol solo vive en memoria.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureProjectDir, tuttiDir } from '../context/context'
import { isDifficulty } from './assign'
import { validateRoles, type Role } from './roles'

/** proposed: lo propuso el líder · reviewed: el líder lo revisó y espera al usuario · approved: se puede repartir. */
export type PlanStatus = 'proposed' | 'reviewed' | 'approved'

export interface RolePlan {
  /** Resumen del plan o dónde está (roadmap, cambio de OpenSpec). */
  summary: string
  status: PlanStatus
  roles: Role[]
  /** Roles cuyo agente ya terminó. */
  done: string[]
}

export const rolesFile = (project: string): string => join(tuttiDir(project), 'roles.json')

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : [])
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Los roles tal como llegan de un agente (JSON sin fiar): lo que falta o sobra queda para que `validateRoles` lo señale. */
export function parseRoles(input: unknown): Role[] {
  if (!Array.isArray(input)) return []
  return input.map((raw): Role => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const pick = (r.assign && typeof r.assign === 'object' ? r.assign : {}) as Record<string, unknown>
    const agent = text(pick.agent)
    const assign = agent ? { agent, ...(text(pick.model) ? { model: text(pick.model) } : {}) } : undefined
    return {
      id: text(r.id), name: text(r.name), responsibility: text(r.responsibility), deliverables: strings(r.deliverables), done: text(r.done),
      files: strings(r.files), difficulty: (isDifficulty(r.difficulty) ? r.difficulty : text(r.difficulty)) as Role['difficulty'], dependsOn: strings(r.dependsOn),
      ...(assign ? { assign } : {})
    }
  })
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
    return { summary: text(raw.summary), status, roles, done: strings(raw.done).filter((d) => ids.has(d)) }
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

/** Qué se le escribe al agente que recibe un rol. */
export function rolePrompt(role: Role, plan: RolePlan): string {
  const others = plan.roles.filter((r) => r.id !== role.id)
  const lines = [
    `[Rol «${role.name}» (${role.id})] Eres una parte de un plan repartido entre varios agentes; solo haces la tuya.`,
    plan.summary ? `Plan: ${plan.summary}` : '',
    `Responsabilidad: ${role.responsibility}`,
    `Entregables:\n${role.deliverables.map((d) => `- ${d}`).join('\n')}`,
    `Criterio de terminado: ${role.done}`,
    role.files.length
      ? `Archivos que son tuyos (solo editas estos): ${role.files.join(', ')}`
      : 'No tienes archivos propios: lees lo que necesites, pero no edites nada.',
    role.dependsOn.length ? `Ya terminaron los roles de los que dependes: ${role.dependsOn.join(', ')}. Su trabajo está en el proyecto.` : '',
    others.length ? `Otros roles del plan (no toques sus archivos):\n${others.map((r) => `- ${r.id}: ${r.name}${r.files.length ? ` (${r.files.join(', ')})` : ''}`).join('\n')}` : '',
    'Al terminar, resume qué hiciste y qué entregaste, y di si algo del criterio de terminado no se cumple.'
  ]
  return lines.filter(Boolean).join('\n\n')
}
