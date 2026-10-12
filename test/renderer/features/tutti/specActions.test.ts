import { describe, expect, it } from 'vitest'
import { nextTask, specActions, specContext } from '../../../../src/renderer/src/features/tutti/lib/specActions'

describe('acciones de una spec (como las de Kiro)', () => {
  it('reconoce los archivos de .tutti/specs y solo ellos', () => {
    expect(specContext('/p/.tutti/specs/carrito/tasks.md')).toEqual({ dir: '.tutti/specs/carrito', file: 'tasks.md' })
    expect(specContext('C:\\p\\.tutti\\specs\\login\\bugfix.md')).toEqual({ dir: '.tutti/specs/login', file: 'bugfix.md' })
    expect(specContext('/p/.tutti/docs/how-to/a.md')).toBeNull()
    expect(specContext('/p/README.md')).toBeNull()
  })

  it('la siguiente tarea es la primera sin marcar, sin sus notas', () => {
    expect(nextTask('# T\n\n- [x] 1. Uno\n- [ ] 2. Dos\n  - _Requisitos: 1_\n- [ ] 3. Tres\n')).toBe('2. Dos')
    expect(nextTask('- [x] a\n- [x] b\n')).toBeNull()
  })

  it('cada archivo ofrece lo que toca: analizar y actualizar, o ejecutar tareas', () => {
    const ctx = (file: string) => ({ dir: '.tutti/specs/carrito', file })
    expect(specActions('es', ctx('requirements.md'), '').map((a) => a.id)).toEqual(['analyze', 'updateDesign'])
    expect(specActions('es', ctx('bugfix.md'), '').map((a) => a.id)).toEqual(['analyze', 'updateDesign'])
    expect(specActions('es', ctx('design.md'), '').map((a) => a.id)).toEqual(['updateTasks'])
    expect(specActions('es', ctx('otro.md'), '')).toEqual([])
    const [next, all] = specActions('es', ctx('tasks.md'), '- [x] a\n- [ ] 2. Botón\n')
    expect(next.prompt).toContain('2. Botón')
    expect(next.prompt).toContain('espera mi visto bueno')
    expect(all.prompt).toContain('todas las tareas pendientes')
    expect(next.disabled).toBe(false)
  })

  it('el análisis no cambia nada hasta que lo apruebes, y sin tareas pendientes no se ofrece ejecutar', () => {
    const analyze = specActions('es', { dir: 'd', file: 'requirements.md' }, '')[0]
    expect(analyze.prompt).toContain('NO modifiques ningún archivo')
    expect(specActions('en', { dir: 'd', file: 'requirements.md' }, '')[0].prompt).toContain('Do NOT change any file')
    expect(specActions('es', { dir: 'd', file: 'tasks.md' }, '- [x] hecho\n').every((a) => a.disabled)).toBe(true)
  })
})
