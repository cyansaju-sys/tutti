import { describe, expect, it } from 'vitest'
import { slug, specTemplates, taskProgress } from '../../../../src/renderer/src/features/tutti/lib/spec'

describe('specs de .tutti', () => {
  it('el nombre se vuelve una carpeta segura', () => {
    expect(slug('Nueva función de Login!')).toBe('nueva-funcion-de-login')
    expect(slug('  --  ')).toBe('')
  })

  it('cuenta las tareas hechas y totales, también las anidadas', () => {
    const text = '# Tareas\n\n- [x] 1. Uno\n  - [x] 1.1 a\n  - [ ] 1.2 b\n- [ ] 2. Dos\n  - _Requisitos: 1_\n'
    expect(taskProgress(text)).toEqual({ done: 2, total: 4 })
    expect(taskProgress('sin casillas')).toEqual({ done: 0, total: 0 })
  })

  it('las plantillas traen los tres archivos y las tareas empiezan sin hacer', () => {
    const es = specTemplates('es', 'Login')
    expect(Object.keys(es)).toEqual(['requirements.md', 'design.md', 'tasks.md'])
    expect(es['requirements.md']).toContain('EL SISTEMA DEBERÁ')
    expect(specTemplates('en', 'Login')['requirements.md']).toContain('THE SYSTEM SHALL')
    expect(taskProgress(es['tasks.md'])).toEqual({ done: 0, total: 3 })
  })
})
