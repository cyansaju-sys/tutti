import { describe, expect, it } from 'vitest'
import { parseRole } from '@/main/services/context/roles'

describe('parseRole', () => {
  it('lee la cabecera y las secciones', () => {
    const r = parseRole('qa', '---\nname: qa\ndifficulty: high\ndepends-on: dev, lider, dev, qa\nagent: claude\nmodel: claude-opus-5-5\n---\n\n# QA\n\n## Especialidad\n\nPruebas\n\n## Entregable\n\nUn plan\n\n## Descripción\n\nRevisa todo\n', '/p/qa.md')
    expect(r).toEqual({ name: 'qa', title: 'QA', difficulty: 'high', depends_on: ['dev', 'lider'], agent: 'claude', model: 'claude-opus-5-5', specialty: 'Pruebas', deliverable: 'Un plan', description: 'Revisa todo', file: '/p/qa.md' })
  })
  it('un rol con campos vacíos o sin cabecera sale con lo que haya', () => {
    expect(parseRole('x', '---\nname: x\ndifficulty:\ndepends-on:\nagent:\nmodel:\n---\n\n# X\n\n## Especialidad\n\n## Entregable\n\n## Descripción\n')).toMatchObject({ title: 'X', depends_on: [], agent: '', specialty: '', description: '' })
    expect(parseRole('y', 'hola')).toMatchObject({ title: 'y', depends_on: [] })
  })
})
