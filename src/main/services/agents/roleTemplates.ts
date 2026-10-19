/**
 * Roles reutilizables: plantillas de rol que crea el usuario (p. ej. «tests», «revisor», «docs») para usarlas en cualquier plan y proyecto.
 * Se guardan en los ajustes (`role_templates`). El líder las ve con list_role_templates y las usa en propose_roles con `template`.
 */
import type { RoleTemplate } from '../../../shared/types'
import { parseRoles } from './rolePlan'
import { validateRoles } from './roles'
import { getSetting, setSetting } from '../settings'

const KEY = 'role_templates'

/** «Revisor de código» → «revisor-de-codigo»: un id válido de rol (minúsculas, números y guiones, empieza por letra). */
export function slugId(name: string): string {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+/, '').replace(/-+$/, '')
  return slug.slice(0, 31).replace(/-+$/, '') || 'rol'
}

/** `base` si no está en `taken`; si no, `base-2`, `base-3`… */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base.slice(0, 28)}-${n}`)) n++
  return `${base.slice(0, 28)}-${n}`
}

/** Una plantilla desde lo que llega (JSON sin fiar): mismos campos que un rol, sin dependencias (esas son de cada plan). */
function toTemplate(raw: unknown): RoleTemplate | null {
  const [r] = parseRoles([raw])
  if (!r) return null
  const { dependsOn: _deps, ...rest } = r
  return rest
}

export function listTemplates(): RoleTemplate[] {
  const raw = getSetting(KEY)
  return (Array.isArray(raw) ? raw : []).map(toTemplate).filter((t): t is RoleTemplate => !!t && !validateRoles([{ ...t, dependsOn: [] }]).length)
}

/** Crea o cambia una plantilla. Con `previousId`, sustituye a esa (puede cambiar de id). El id sale del nombre si no se da. */
export function saveTemplate(input: Partial<RoleTemplate>, previousId?: string): { ok: boolean; errors: string[]; template?: RoleTemplate } {
  const id = (input.id?.trim() || slugId(input.name ?? '')).toLowerCase()
  const template = toTemplate({ ...input, id })
  if (!template) return { ok: false, errors: ['La plantilla no es válida.'] }
  const errors = validateRoles([{ ...template, dependsOn: [] }]).map((e) => e.replace(/^Rol /, 'Plantilla '))
  const others = listTemplates().filter((t) => t.id !== (previousId ?? id))
  if (others.some((t) => t.id === template.id)) errors.push(`Ya hay una plantilla con el id «${template.id}».`)
  if (errors.length) return { ok: false, errors }
  setSetting(KEY, [...others, template].sort((a, b) => a.name.localeCompare(b.name)))
  return { ok: true, errors: [], template }
}

export function deleteTemplate(id: string): void {
  setSetting(KEY, listTemplates().filter((t) => t.id !== id))
}

/**
 * Rellena los roles que piden una plantilla (`template: "id"`) con sus campos; lo que el rol trae explícito manda sobre la plantilla.
 * El id del rol es el suyo o, si no trae, el de la plantilla. Los roles sin plantilla (o con una que no existe) quedan igual.
 */
export function expandTemplates(input: unknown, templates: RoleTemplate[]): unknown {
  if (typeof input === 'string') { try { input = JSON.parse(input) } catch { return input } }
  if (!Array.isArray(input)) return input
  return input.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const r = raw as Record<string, unknown>
    const wanted = typeof r.template === 'string' ? r.template.trim() : ''
    const tpl = wanted ? templates.find((t) => t.id === wanted) : undefined
    if (!tpl) return raw
    const given = Object.fromEntries(Object.entries(r).filter(([k, v]) => k !== 'template' && v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)))
    return { ...tpl, dependsOn: [], ...given, id: typeof r.id === 'string' && r.id.trim() ? r.id : tpl.id }
  })
}
