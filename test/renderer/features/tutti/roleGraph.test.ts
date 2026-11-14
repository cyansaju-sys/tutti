import { describe, expect, it } from 'vitest'
import { layoutRoles, parseRole, splitDeps } from '@/renderer/src/features/tutti/lib/roleGraph'

const role = (id: string, deps: string[] = []) => ({ id, title: id, agent: '', deps })

describe('roleGraph', () => {
  it('lee las dependencias de la cabecera', () => {
    const r = parseRole('qa', '---\nname: qa\nagent: claude\ndepends-on: dev, lider, dev\n---\n\n# QA\n')
    expect(r).toMatchObject({ id: 'qa', title: 'QA', agent: 'claude', deps: ['dev', 'lider'] })
    expect(parseRole('x', '# X\n').deps).toEqual([])
    expect(splitDeps(' a ,, b ')).toEqual(['a', 'b'])
  })
  it('un rol no depende de sí mismo', () => { expect(parseRole('a', '---\ndepends-on: a, b\n---\n').deps).toEqual(['b']) })
  it('coloca cada rol después de lo que necesita', () => {
    const { nodes, edges } = layoutRoles([role('lider'), role('dev', ['lider']), role('arq', ['lider']), role('qa', ['dev', 'arq'])])
    const lv = Object.fromEntries(nodes.map((n) => [n.id, n.level]))
    expect(lv).toEqual({ lider: 0, dev: 1, arq: 1, qa: 2 })
    expect(edges).toContainEqual(expect.objectContaining({ from: 'dev', to: 'qa' }))
    expect(nodes.find((n) => n.id === 'lider')?.dependents).toBe(2)
    expect(nodes.find((n) => n.id === 'qa')?.deps).toHaveLength(2)
  })
  it('los dependientes quedan en la fila de abajo y el padre centrado sobre ellos', () => {
    const { nodes } = layoutRoles([role('a'), role('b', ['a']), role('x', ['a'])])
    const at = (id: string) => nodes.find((n) => n.id === id)!
    expect(at('b').y).toBe(at('x').y)
    expect(at('b').y).toBeGreaterThan(at('a').y)
    expect(at('a').x).toBe((at('b').x + at('x').x) / 2)
  })
  it('una dependencia que no existe sale como faltante', () => {
    const { nodes } = layoutRoles([role('a', ['fantasma'])])
    expect(nodes.find((n) => n.id === 'fantasma')?.missing).toBe(true)
    expect(nodes.find((n) => n.id === 'a')?.missing).toBe(false)
  })
  it('un ciclo no cuelga y se avisa', () => {
    const l = layoutRoles([role('a', ['b']), role('b', ['a'])])
    expect(l.cycles).toBe(true)
    expect(l.nodes).toHaveLength(2)
  })
})
