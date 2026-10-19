import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../src/main/services/settings', () => {
  let store: Record<string, unknown> = {}
  return { getSetting: (k: string) => store[k], setSetting: (k: string, v: unknown) => { store = { ...store, [k]: v } } }
})

import { BUILTIN, deletePlanTemplate, listPlanTemplates, planTemplateInfo, savePlanTemplate } from '../../../../src/main/services/agents/planTemplates'
import { validateRoles } from '../../../../src/main/services/agents/roles'

describe('plantillas de plan', () => {
  it('la incluida es un plan válido en cadena y su revisor solo lee', () => {
    const tpl = BUILTIN[0]
    expect(validateRoles(tpl.roles)).toEqual([])
    expect(tpl.roles.map((r) => r.dependsOn)).toEqual([[], ['implementar'], ['tests']])
    expect(tpl.roles.find((r) => r.id === 'revision')?.files).toEqual([])
  })
  it('se guarda un plan como plantilla sin el agente elegido a mano, con id único, y se borra', () => {
    const roles = BUILTIN[0].roles.map((r) => ({ ...r, assign: { agent: 'a2' } }))
    const res = savePlanTemplate('Implementar → tests → revisión', roles)
    expect(res.ok).toBe(true)
    expect(res.id).toBe('implementar-tests-revision-2')          // el de la incluida ya existe
    const mine = listPlanTemplates().find((t) => t.id === res.id)!
    expect(mine.roles.every((r) => !r.assign)).toBe(true)
    expect(planTemplateInfo(mine)).toMatchObject({ builtin: false, roles: [{ id: 'implementar', dependsOn: [] }, { id: 'tests' }, { id: 'revision' }] })
    deletePlanTemplate(res.id!)
    expect(listPlanTemplates()).toHaveLength(1)
  })
  it('sin nombre o con roles inválidos no se guarda', () => {
    expect(savePlanTemplate('  ', BUILTIN[0].roles).ok).toBe(false)
    expect(savePlanTemplate('x', [{ ...BUILTIN[0].roles[0], dependsOn: ['nada'] }]).ok).toBe(false)
  })
})
