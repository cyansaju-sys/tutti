import { describe, expect, it } from 'vitest'
import { depthOf } from '../../../../src/renderer/src/features/agents/components/PlanView'

describe('columnas del grafo del plan', () => {
  it('cada rol va una columna detrás de su dependencia más tardía', () => {
    const d = depthOf([
      { id: 'api', dependsOn: [] }, { id: 'db', dependsOn: [] },
      { id: 'tests', dependsOn: ['api'] }, { id: 'docs', dependsOn: ['api', 'tests'] }
    ])
    expect(Object.fromEntries(d)).toEqual({ api: 0, db: 0, tests: 1, docs: 2 })
  })
  it('una dependencia que no está en el plan se ignora y un ciclo no lo cuelga', () => {
    expect(depthOf([{ id: 'a', dependsOn: ['fantasma'] }]).get('a')).toBe(0)
    const loop = depthOf([{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: ['a'] }])
    expect(loop.size).toBe(2)
  })
})
