/**
 * Roles de una tarea: qué parte del plan hace cada agente y a quién se le asigna. Funciones puras, sin tocar la app.
 * Un agente tiene un solo rol a la vez; si el ideal no está disponible, el rol pasa a otro y, si no queda nadie, espera en cola.
 */
import { capable, exhausted, isDifficulty, pickAgent, REQUIRED, type Candidate, type Difficulty } from './assign'
import type { Tier } from './models'
import { tm } from '../../utils/i18n'

export interface Role {
  id: string
  name: string
  responsibility: string
  deliverables: string[]
  /** Criterio de terminado: lo que el líder comprueba al revisar el resultado. */
  done: string
  /** Archivos o carpetas que le pertenecen; ningún otro rol los toca. Vacío = solo lee. */
  files: string[]
  difficulty: Difficulty
  dependsOn: string[]
  /** Agente y modelo elegidos a mano: se respetan por encima del reparto automático. `agent` es el id de un panel abierto o el comando de uno instalado. */
  assign?: { agent: string; model?: string }
  /** Comando que la app ejecuta en la raíz del proyecto cuando el rol termina (p. ej. «npm test -- api»); si falla, el rol no se da por bueno. */
  check?: string
}

const ID = /^[a-z][a-z0-9-]{0,30}$/

/** Rutas comparables: sin «./», sin barra final y sin «/**» o «/*» al final. */
const norm = (p: string): string => p.trim().replace(/^\.\//, '').replace(/\/\*{1,2}$/, '').replace(/\/+$/, '')
const overlaps = (a: string, b: string): boolean => a === b || a.startsWith(b + '/') || b.startsWith(a + '/')

/**
 * Archivos de `changed` que no son del rol (ninguno de `owned` los contiene). Las rutas absolutas dentro de `project` se pasan a relativas.
 * Un rol sin archivos propios solo lee: cualquier cambio suyo queda fuera.
 */
export function outsideFiles(owned: string[], changed: string[], project: string): string[] {
  const root = norm(project.split('\\').join('/'))
  const rel = (p: string): string => {
    const f = norm(p.split('\\').join('/'))
    return f.startsWith(root + '/') ? f.slice(root.length + 1) : f
  }
  const mine = owned.map((o) => rel(o)).filter(Boolean)
  return [...new Set(changed.map(rel).filter(Boolean))].filter((f) => !mine.some((o) => f === o || f.startsWith(o + '/')))
}

/** Qué está mal en los roles propuestos (vacío si valen). Los mensajes los lee el agente líder. */
export function validateRoles(roles: Role[]): string[] {
  const errors: string[] = []
  if (!roles.length) return ['No hay ningún rol.']
  const ids = new Set<string>()
  for (const r of roles) {
    const who = `Rol «${r.id || r.name || '?'}»`
    if (!ID.test(r.id ?? '')) errors.push(`${who}: el id debe ser minúsculas, números y guiones (empieza por letra).`)
    else if (ids.has(r.id)) errors.push(`${who}: id repetido.`)
    ids.add(r.id)
    if (!r.name?.trim()) errors.push(`${who}: falta el nombre.`)
    if (!r.responsibility?.trim()) errors.push(`${who}: falta la responsabilidad.`)
    if (!r.done?.trim()) errors.push(`${who}: falta el criterio de terminado.`)
    if (!r.deliverables?.length) errors.push(`${who}: falta algún entregable.`)
    if (!isDifficulty(r.difficulty)) errors.push(`${who}: la dificultad debe ser easy, medium o hard.`)
  }
  for (const r of roles) {
    for (const dep of r.dependsOn ?? []) {
      if (dep === r.id) errors.push(`Rol «${r.id}»: depende de sí mismo.`)
      else if (!ids.has(dep)) errors.push(`Rol «${r.id}»: depende de «${dep}», que no existe.`)
    }
  }
  if (!errors.length && hasCycle(roles)) errors.push('Las dependencias entre roles forman un ciclo.')
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      for (const a of roles[i].files ?? []) for (const b of roles[j].files ?? []) {
        if (a.trim() && b.trim() && overlaps(norm(a), norm(b))) errors.push(`Los roles «${roles[i].id}» y «${roles[j].id}» editan los mismos archivos (${a} y ${b}).`)
      }
    }
  }
  return errors
}

function hasCycle(roles: Role[]): boolean {
  const deps = new Map(roles.map((r) => [r.id, r.dependsOn ?? []]))
  const state = new Map<string, 1 | 2>()          // 1: en el camino actual, 2: ya comprobado
  const visit = (id: string): boolean => {
    if (state.get(id) === 2) return false
    if (state.get(id) === 1) return true
    state.set(id, 1)
    for (const d of deps.get(id) ?? []) if (visit(d)) return true
    state.set(id, 2)
    return false
  }
  return roles.some((r) => visit(r.id))
}

const LEVEL: Record<Tier, number> = { basic: 0, standard: 1, advanced: 2 }

/** El modelo que ofrece el agente con el nivel justo para la dificultad (el más capaz si ninguno llega); null si no ofrece ninguno. */
export function modelFor<M extends { id: string; tier: Tier }>(models: M[], d: Difficulty): M | null {
  const enough = models.filter((m) => capable(m, d)).sort((a, b) => LEVEL[a.tier] - LEVEL[b.tier])
  return enough[0] ?? [...models].sort((a, b) => LEVEL[b.tier] - LEVEL[a.tier])[0] ?? null
}

export interface RoleCandidate extends Candidate {
  /** Modelos que ofrece el agente (de available_models). */
  models?: Array<{ id: string; tier: Tier }>
  /** Si el modelo se puede fijar al abrir una instancia nueva. */
  canSetModel?: boolean
}

export interface RoleAssignment {
  role: Role
  /** assigned: ya tiene agente · waiting: espera a otros roles · queued: no hay agente libre, espera uno · unassigned: el usuario aún no le eligió agente. */
  status: 'assigned' | 'waiting' | 'queued' | 'unassigned'
  agent: RoleCandidate | null
  /** Modelo a fijar al abrir una instancia nueva; null si se usa el que ya tiene el agente. */
  model: string | null
  /** El agente no llega al nivel que pide el rol. */
  downgraded: boolean
  reason: string
  /** Roles de los que aún depende (solo si espera). */
  waitingOn: string[]
}

export interface AssignOptions {
  /** Roles ya terminados. */
  done?: ReadonlySet<string>
  /** Roles que ya tienen agente: no se reasignan (su agente ya viene como ocupado). */
  active?: ReadonlySet<string>
  /** El agente y el modelo los elige el usuario: un rol sin `assign` no se reparte solo, espera a que se lo den. */
  manual?: boolean
}

const RANK: Record<Difficulty, number> = { hard: 0, medium: 1, easy: 2 }

/**
 * Reparte los roles listos entre los agentes, de más a menos difícil para que los difíciles se queden con los capaces.
 * Un agente abierto sirve a un solo rol; uno por abrir puede dar varias instancias nuevas. Los ocupados no cuentan.
 */
export function assignRoles(roles: Role[], candidates: RoleCandidate[], opts: AssignOptions = {}): RoleAssignment[] {
  const done = opts.done ?? new Set<string>()
  const active = opts.active ?? new Set<string>()
  const taken = new Set<string>()
  const results = new Map<string, RoleAssignment>()
  const pending = roles.filter((r) => !done.has(r.id) && !active.has(r.id))
  const ready: Role[] = []
  for (const role of pending) {
    const waitingOn = (role.dependsOn ?? []).filter((d) => !done.has(d))
    if (waitingOn.length) results.set(role.id, { role, status: 'waiting', agent: null, model: null, downgraded: false, reason: tm('m.roles.waiting', { roles: waitingOn.join(', ') }), waitingOn })
    else ready.push(role)
  }
  // lo elegido a mano reserva su agente antes que el reparto automático
  for (const role of [...ready].sort((a, b) => Number(!!b.assign) - Number(!!a.assign) || RANK[a.difficulty] - RANK[b.difficulty])) {
    if (role.assign) {
      const wanted = role.assign.agent.toLowerCase()
      const c = candidates.find((x) => x.id === role.assign!.agent) ?? candidates.find((x) => !x.id && (x.command.toLowerCase() === wanted || x.name.toLowerCase() === wanted))
      const why = !c ? tm('m.roles.manualMissing', { agent: role.assign.agent }) : exhausted(c) ? tm('m.roles.manualExhausted') : c.busy || (c.id && taken.has(c.id)) ? tm('m.roles.manualBusy') : null
      if (!c || why) {
        results.set(role.id, { role, status: 'queued', agent: null, model: null, downgraded: false, reason: tm('m.roles.queued', { reason: why ?? '' }), waitingOn: [] })
        continue
      }
      if (c.id) taken.add(c.id)
      results.set(role.id, { role, status: 'assigned', agent: c, model: role.assign.model ?? null, downgraded: false, reason: tm('m.roles.manual'), waitingOn: [] })
      continue
    }
    // el nivel real de un agente por abrir es el del mejor modelo que se le pueda fijar para esta dificultad
    if (opts.manual) {
      results.set(role.id, { role, status: 'unassigned', agent: null, model: null, downgraded: false, reason: tm('m.roles.unassigned'), waitingOn: [] })
      continue
    }
    const views = candidates
      .filter((c) => !c.busy && !(c.id && taken.has(c.id)))
      .map((c) => {
        const pick = !c.id && c.canSetModel && c.models?.length ? modelFor(c.models, role.difficulty) : null
        return { ...c, tier: pick?.tier ?? c.tier, source: c, pick: pick?.id ?? null }
      })
    const { chosen, reason } = pickAgent(views, role.difficulty)
    if (!chosen) {
      results.set(role.id, { role, status: 'queued', agent: null, model: null, downgraded: false, reason: tm('m.roles.queued', { reason }), waitingOn: [] })
      continue
    }
    if (chosen.id) taken.add(chosen.id)
    results.set(role.id, {
      role, status: 'assigned', agent: chosen.source, model: chosen.pick, downgraded: !capable(chosen, role.difficulty),
      reason: capable(chosen, role.difficulty) ? reason : tm('m.roles.downgraded', { required: REQUIRED[role.difficulty], tier: chosen.tier }), waitingOn: []
    })
  }
  return pending.map((r) => results.get(r.id)!)
}

/** Lo que el líder comprueba del plan antes de confirmarlo (se le devuelve con cada propuesta). */
export const REVIEW_CHECKLIST = [
  '¿El plan está completo: cubre todo lo que pidió la tarea y nada más?',
  '¿Cada rol tiene un criterio de terminado que puedas comprobar leyendo su resultado?',
  '¿Ningún archivo lo edita más de un rol y las dependencias reflejan el orden real?',
  '¿El reparto de agentes y modelos es razonable: lo difícil con modelos capaces y nadie sin agente?'
]

/** Longitud de la cadena de dependencias más larga que termina en cada rol (1 = no depende de nadie). */
function depths(roles: Role[]): Map<string, number> {
  const byId = new Map(roles.map((r) => [r.id, r]))
  const memo = new Map<string, number>()
  const depth = (id: string): number => {
    const known = memo.get(id)
    if (known !== undefined) return known
    memo.set(id, 1)          // corta ciclos: los roles ya están validados, esto solo evita un bucle si no lo estuvieran
    const d = 1 + Math.max(0, ...(byId.get(id)?.dependsOn ?? []).map(depth))
    memo.set(id, d)
    return d
  }
  roles.forEach((r) => depth(r.id))
  return memo
}

/** Avisos sobre un plan válido: cosas que quizá el líder quiera corregir antes de confirmar. No impiden nada. */
export function reviewWarnings(roles: Role[], assignments: RoleAssignment[], plan: { summary: string; hasRoadmap: boolean }): string[] {
  const out: string[] = []
  if (!plan.summary.trim()) {
    out.push(plan.hasRoadmap
      ? 'Falta `summary`: indica qué parte del roadmap o qué cambio de OpenSpec desarrolla este plan.'
      : 'Falta `summary` y el proyecto no tiene roadmap: escribe el plan (.tutti/roadmap.md o un cambio de OpenSpec) antes de repartirlo.')
  }
  if (roles.length === 1) out.push('Solo hay un rol: repartir no aporta nada; hazlo tú o con delegate_task.')
  if (roles.length > 1) {
    const level = [...depths(roles).values()]
    if (new Set(level).size === level.length) out.push('Los roles dependen unos de otros en cadena: ninguno puede trabajar en paralelo con otro.')
  }
  for (const a of assignments) {
    if (a.status === 'queued') out.push(`Rol «${a.role.id}»: ahora no hay ningún agente libre; esperaría en cola (${a.reason}).`)
    else if (a.status === 'assigned' && a.downgraded) out.push(`Rol «${a.role.id}» (${a.role.difficulty}): ${a.reason}. Considera dividirlo o bajar su dificultad.`)
  }
  return out
}
