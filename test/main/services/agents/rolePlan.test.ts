import { beforeEach, describe, expect, it } from 'vitest'
import type { RoleSummary } from '../../../../src/main/services/context/roles'
import { blockedByFailure, buildPlan, difficultyOf, finished, launchOrder, plans, ready, rolePrompt } from '../../../../src/main/services/agents/rolePlan'

const role = (name: string, depends_on: string[] = [], extra: Partial<RoleSummary> = {}): RoleSummary =>
  ({ name, title: name.toUpperCase(), difficulty: 'medium', depends_on, agent: '', model: '', specialty: '', deliverable: '', description: '', file: '', ...extra })
const ROLES = [role('lider'), role('arq', ['lider']), role('dev', ['lider']), role('qa', ['dev', 'arq'])]
const build = (names: string[], roles = ROLES) => buildPlan('a1', roles, names.map((n) => ({ role: n, task: `haz ${n}` })))

beforeEach(() => { plans.length = 0 })

describe('rolePlan', () => {
  it('lanza primero a quien no espera a nadie y después los que dependen de ellos', () => {
    const r = build(['qa', 'dev', 'lider', 'arq'])
    if (!('plan' in r)) throw new Error(r.error)
    expect(launchOrder(r.plan)).toEqual(['lider', 'dev', 'arq', 'qa'])
    expect(ready(r.plan).map((i) => i.role.name)).toEqual(['lider'])
  })
  it('una dependencia que no está en el plan no hace esperar', () => {
    const r = build(['dev', 'qa'])
    if (!('plan' in r)) throw new Error(r.error)
    expect(r.plan.items.find((i) => i.role.name === 'dev')?.waitsFor).toEqual([])
    expect(r.plan.items.find((i) => i.role.name === 'qa')?.waitsFor).toEqual(['dev'])
  })
  it('un rol espera a todas sus dependencias, y se salta si una falla', () => {
    const r = build(['lider', 'arq', 'dev', 'qa'])
    if (!('plan' in r)) throw new Error(r.error)
    const at = (n: string) => r.plan.items.find((i) => i.role.name === n)!
    at('lider').state = 'done'; at('arq').state = 'done'; at('dev').state = 'running'
    expect(ready(r.plan).map((i) => i.role.name)).toEqual([])
    at('dev').state = 'failed'
    expect(blockedByFailure(r.plan).map((i) => i.role.name)).toEqual(['qa'])
    at('qa').state = 'skipped'
    expect(finished(r.plan)).toBe(true)
  })
  it('rechaza roles que no existen, repetidos y ciclos', () => {
    expect(build(['nadie'])).toHaveProperty('error')
    expect(build(['dev', 'DEV'])).toHaveProperty('error')
    const cycle = build(['a', 'b'], [role('a', ['b']), role('b', ['a'])])
    expect(cycle).toHaveProperty('error', expect.stringContaining('ciclo'))
  })
  it('el mensaje a un rol lleva su perfil, su tarea y lo que entregaron antes', () => {
    const r = build(['lider', 'dev'], [role('lider'), role('dev', ['lider'], { specialty: 'Backend', deliverable: 'API' })])
    if (!('plan' in r)) throw new Error(r.error)
    r.plan.items[0].state = 'done'; r.plan.items[0].summary = 'plan hecho'
    const text = rolePrompt(r.plan, r.plan.items[1])
    expect(text).toContain('Especialidad: Backend')
    expect(text).toContain('Qué debes entregar: API')
    expect(text).toContain('Tu tarea: haz dev')
    expect(text).toContain('LIDER: plan hecho')
    expect(text).toContain('report_done')
  })
  it('la dificultad del rol pasa a la del reparto', () => {
    expect(['low', 'medium', 'high', ''].map((d) => difficultyOf({ difficulty: d }))).toEqual(['easy', 'medium', 'hard', 'medium'])
  })
})
