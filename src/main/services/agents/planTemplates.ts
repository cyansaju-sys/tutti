/**
 * Plantillas de plan: planes enteros (roles con sus dependencias) para empezar uno nuevo sin escribirlo desde cero.
 * Hay una incluida («Implementar → tests → revisión») y el usuario guarda las suyas desde un plan (`plan_templates` en los ajustes).
 * El resumen del plan nuevo dice qué hay que hacer: los roles de la plantilla son genéricos y lo leen de ahí.
 */
import type { PlanTemplateInfo } from '../../../shared/types'
import { parseRoles } from './rolePlan'
import { validateRoles, type Role } from './roles'
import { slugId, uniqueId } from './roleTemplates'
import { getSetting, setSetting } from '../settings'

export interface PlanTemplate { id: string; name: string; roles: Role[]; builtin?: boolean }

const KEY = 'plan_templates'

/** La incluida: implementar, probar y revisar, en cadena. El revisor solo lee: no edita nada, solo informa. */
export const BUILTIN: PlanTemplate[] = [{
  id: 'implementar-tests-revision', name: 'Implementar → tests → revisión', builtin: true,
  roles: [
    { id: 'implementar', name: 'Implementación', responsibility: 'Implementa el cambio que describe el resumen del plan.', deliverables: ['El cambio implementado y compilando'], done: 'El cambio hace lo que pide el resumen y el proyecto compila.', files: ['src/'], difficulty: 'medium', dependsOn: [] },
    { id: 'tests', name: 'Tests', responsibility: 'Escribe o actualiza los tests que cubren el cambio implementado.', deliverables: ['Tests del cambio', 'La batería de tests en verde'], done: 'Hay tests que fallarían sin el cambio y todos pasan.', files: ['test/'], difficulty: 'easy', dependsOn: ['implementar'] },
    { id: 'revision', name: 'Revisión', responsibility: 'Revisa el cambio y sus tests buscando fallos, casos sin cubrir y código confuso. No edita nada: informa.', deliverables: ['Lista de problemas encontrados, por gravedad, con archivo y línea'], done: 'Cada problema dice dónde está y por qué importa; si no hay ninguno, lo dice.', files: [], difficulty: 'hard', dependsOn: ['tests'] }
  ]
}]

const userTemplates = (): PlanTemplate[] => {
  const raw = getSetting(KEY)
  return (Array.isArray(raw) ? raw : []).flatMap((t): PlanTemplate[] => {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || typeof t.name !== 'string') return []
    const roles = parseRoles(t.roles)
    return validateRoles(roles).length ? [] : [{ id: t.id, name: t.name, roles }]
  })
}

export const listPlanTemplates = (): PlanTemplate[] => [...BUILTIN, ...userTemplates()]
export const planTemplate = (id: string): PlanTemplate | undefined => listPlanTemplates().find((t) => t.id === id)

/** Lo que la interfaz muestra de cada plantilla. */
export const planTemplateInfo = (t: PlanTemplate): PlanTemplateInfo => ({ id: t.id, name: t.name, builtin: !!t.builtin, roles: t.roles.map((r) => ({ id: r.id, name: r.name, dependsOn: r.dependsOn })) })

/** Guarda los roles de un plan como plantilla (sin el agente elegido a mano: depende de lo que haya abierto cada vez). */
export function savePlanTemplate(name: string, roles: Role[]): { ok: boolean; errors: string[]; id?: string } {
  const title = name.trim()
  if (!title) return { ok: false, errors: ['Ponle un nombre a la plantilla.'] }
  const clean = roles.map(({ assign: _a, ...r }) => r)
  const errors = validateRoles(clean)
  if (errors.length) return { ok: false, errors }
  const id = uniqueId(slugId(title), listPlanTemplates().map((t) => t.id))
  setSetting(KEY, [...userTemplates(), { id, name: title, roles: clean }])
  return { ok: true, errors: [], id }
}

export function deletePlanTemplate(id: string): void {
  setSetting(KEY, userTemplates().filter((t) => t.id !== id))
}
