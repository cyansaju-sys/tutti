/**
 * Plan de roles: reparte tareas entre los roles del proyecto y las lanza en el orden de sus dependencias (`depends-on`).
 * Un rol empieza cuando todos los roles de los que depende (dentro del plan) terminaron; si alguno falla, los que dependen de él se saltan.
 * Aquí solo vive el estado y la lógica pura; lanzar y vigilar a los agentes lo hace hub.ts.
 */
import type { RoleSummary } from '@/main/services/context/roles'
import type { Difficulty } from './assign'

export type ItemState = 'waiting' | 'running' | 'done' | 'failed' | 'skipped'

export interface PlanItem {
  role: RoleSummary; task: string
  /** Roles del plan de los que depende. */
  waitsFor: string[]
  state: ItemState
  agentId?: string; taskId?: number
  summary?: string; files?: string[]; note?: string
  /** Se está abriendo su agente (no lanzarlo dos veces). */
  launching?: boolean
}
export interface Plan { id: number; callerId: string; items: PlanItem[]; announced: boolean }

export const plans: Plan[] = []
const MAX_PLANS = 10

/** La dificultad que se le pide a un agente según la del rol (low, medium, high); sin ella, media. */
export const difficultyOf = (role: Pick<RoleSummary, 'difficulty'>): Difficulty => (role.difficulty === 'low' ? 'easy' : role.difficulty === 'high' ? 'hard' : 'medium')

/** Un plan con las tareas por rol; `error` si falta un rol, hay un rol repetido o las dependencias forman un ciclo. */
export function buildPlan(callerId: string, roles: RoleSummary[], assignments: Array<{ role: string; task: string }>): { plan: Plan } | { error: string } {
  const byName = new Map(roles.map((r) => [r.name.toLowerCase(), r]))
  const items: PlanItem[] = []
  for (const a of assignments) {
    const role = byName.get(a.role.trim().toLowerCase())
    if (!role) return { error: `No existe el rol «${a.role}». Roles disponibles: ${roles.map((r) => r.name).join(', ') || 'ninguno'}.` }
    if (items.some((i) => i.role.name === role.name)) return { error: `El rol «${role.name}» aparece dos veces: cada rol recibe una sola tarea por plan.` }
    items.push({ role, task: a.task.trim(), waitsFor: [], state: 'waiting' })
  }
  const inPlan = new Set(items.map((i) => i.role.name))
  for (const i of items) i.waitsFor = i.role.depends_on.filter((d) => inPlan.has(d))
  // un ciclo: ningún orden posible
  const done = new Set<string>()
  for (let progress = true; progress && done.size < items.length;) {
    progress = false
    for (const i of items) if (!done.has(i.role.name) && i.waitsFor.every((d) => done.has(d))) { done.add(i.role.name); progress = true }
  }
  if (done.size < items.length) return { error: `Las dependencias forman un ciclo entre: ${items.filter((i) => !done.has(i.role.name)).map((i) => i.role.name).join(', ')}.` }
  const plan: Plan = { id: plans.length ? plans[plans.length - 1].id + 1 : 1, callerId, items, announced: false }
  plans.push(plan)
  if (plans.length > MAX_PLANS) plans.splice(0, plans.length - MAX_PLANS)
  return { plan }
}

/** El orden en el que se lanzan: de a quienes nadie espera, hacia los que dependen de ellos. */
export function launchOrder(plan: Plan): string[] {
  const order: string[] = []
  const left = [...plan.items]
  while (left.length) {
    const next = left.filter((i) => i.waitsFor.every((d) => order.includes(d)))
    if (!next.length) break
    for (const i of next) { order.push(i.role.name); left.splice(left.indexOf(i), 1) }
  }
  return order
}

const itemOf = (plan: Plan, role: string): PlanItem | undefined => plan.items.find((i) => i.role.name === role)
/** Los que esperan y ya pueden empezar: todo lo que necesitan terminó. */
export const ready = (plan: Plan): PlanItem[] => plan.items.filter((i) => i.state === 'waiting' && !i.launching && i.waitsFor.every((d) => itemOf(plan, d)?.state === 'done'))
/** Los que esperan algo que falló o se saltó: no van a poder empezar. */
export const blockedByFailure = (plan: Plan): PlanItem[] => plan.items.filter((i) => i.state === 'waiting' && i.waitsFor.some((d) => ['failed', 'skipped'].includes(itemOf(plan, d)?.state ?? '')))
export const finished = (plan: Plan): boolean => plan.items.every((i) => ['done', 'failed', 'skipped'].includes(i.state))

/** Lo que se le manda al agente de un rol: quién es, su tarea y lo que entregaron los roles de los que depende. */
export function rolePrompt(plan: Plan, item: PlanItem): string {
  const r = item.role
  const lines = [`[Tutti] Tienes el rol «${r.title}».`]
  if (r.specialty) lines.push(`Especialidad: ${r.specialty}`)
  if (r.deliverable) lines.push(`Qué debes entregar: ${r.deliverable}`)
  if (r.description) lines.push(`Cómo trabajas: ${r.description}`)
  lines.push('', `Tu tarea: ${item.task}`)
  const before = item.waitsFor.map((d) => itemOf(plan, d)).filter((d): d is PlanItem => !!d)
  if (before.length) {
    lines.push('', 'Antes que tú terminaron estos roles; parte de lo que hicieron:')
    for (const d of before) lines.push(`- ${d.role.title}: ${d.summary || '(sin resumen)'}${d.files?.length ? ` — archivos: ${d.files.join(', ')}` : ''}`)
  }
  lines.push('', 'Al terminar, llama a report_done con un resumen de lo que hiciste y los archivos que tocaste: otros roles esperan tu resultado.')
  return lines.join('\n')
}

const ICON: Record<ItemState, string> = { waiting: 'espera', running: 'en curso', done: 'hecho', failed: 'falló', skipped: 'saltado' }
/** El estado del plan para el líder: cada rol con su estado, de qué espera y quién lo lleva. */
export function planStatus(plan: Plan): object {
  return {
    plan_id: plan.id, finished: finished(plan),
    roles: plan.items.map((i) => ({
      role: i.role.name, state: ICON[i.state], waits_for: i.waitsFor.filter((d) => itemOf(plan, d)?.state !== 'done'),
      ...(i.agentId ? { agent_id: i.agentId } : {}), ...(i.summary ? { summary: i.summary } : {}), ...(i.note ? { note: i.note } : {})
    }))
  }
}
