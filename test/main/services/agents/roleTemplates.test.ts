import { describe, expect, it } from 'vitest'
import type { RoleTemplate } from '../../../../src/shared/types'
import { expandTemplates, slugId, uniqueId } from '../../../../src/main/services/agents/roleTemplates'

const tests: RoleTemplate = { id: 'tests', name: 'Tests', responsibility: 'escribe los tests', deliverables: ['tests en verde'], done: 'npm test pasa', files: ['test/'], difficulty: 'easy', check: 'npm test' }

describe('roles reutilizables', () => {
  it('el id sale del nombre: minúsculas, sin acentos, con guiones y empezando por letra', () => {
    expect(slugId('Revisor de código')).toBe('revisor-de-codigo')
    expect(slugId('  2º Tests!! ')).toBe('tests')
    expect(slugId('###')).toBe('rol')
    expect(slugId('a'.repeat(50))).toHaveLength(31)
  })
  it('un id repetido recibe un número', () => {
    expect(uniqueId('tests', ['api'])).toBe('tests')
    expect(uniqueId('tests', ['tests', 'tests-2'])).toBe('tests-3')
  })
  it('un rol con template se rellena con la plantilla y lo explícito manda', () => {
    const [r] = expandTemplates([{ template: 'tests', id: 'tests-api', files: ['test/api'], dependsOn: ['api'], name: '' }], [tests]) as Array<Record<string, unknown>>
    expect(r).toMatchObject({ id: 'tests-api', name: 'Tests', files: ['test/api'], dependsOn: ['api'], check: 'npm test', difficulty: 'easy' })
    expect(r.template).toBeUndefined()
  })
  it('sin id, el rol toma el de la plantilla; una plantilla que no existe deja el rol igual', () => {
    const [a, b] = expandTemplates([{ template: 'tests' }, { template: 'nada', id: 'x' }], [tests]) as Array<Record<string, unknown>>
    expect(a.id).toBe('tests')
    expect(b).toEqual({ template: 'nada', id: 'x' })
  })
  it('acepta la lista como texto JSON', () => {
    expect((expandTemplates(JSON.stringify([{ template: 'tests' }]), [tests]) as Array<{ id: string }>)[0].id).toBe('tests')
  })
})
