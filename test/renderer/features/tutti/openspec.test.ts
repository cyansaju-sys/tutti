import { describe, expect, it } from 'vitest'
import { applyPrompt, changeFiles, changeFormError, EMPTY_CHANGE_FORM, proposePrompt } from '../../../../src/renderer/src/features/tutti/lib/openspec'
import { taskProgress } from '../../../../src/renderer/src/features/tutti/lib/spec'

describe('cambios de OpenSpec', () => {
  it('el formulario pide un nombre y, para el agente, qué se quiere', () => {
    expect(changeFormError(EMPTY_CHANGE_FORM)).toBe('name')
    expect(changeFormError({ ...EMPTY_CHANGE_FORM, name: '!!' })).toBe('name')
    expect(changeFormError({ ...EMPTY_CHANGE_FORM, name: 'Añadir carrito' })).toBeNull()
    expect(changeFormError({ name: 'carrito', description: ' ', useAgent: true })).toBe('description')
  })

  it('las plantillas traen propuesta, delta de spec, diseño y tareas sin hacer', () => {
    const files = changeFiles('es', { name: 'Añadir carrito', description: 'Pagar en un paso', useAgent: false })
    expect(Object.keys(files)).toEqual(['proposal.md', 'specs/anadir-carrito/spec.md', 'design.md', 'tasks.md'])
    expect(files['proposal.md']).toContain('Pagar en un paso')
    expect(files['specs/anadir-carrito/spec.md']).toContain('#### Scenario:')
    expect(taskProgress(files['tasks.md'])).toEqual({ done: 0, total: 3 })
    expect(changeFiles('en', { name: 'x', description: '', useAgent: false })['proposal.md']).toContain('## Why')
  })

  it('los mensajes al agente apuntan a la carpeta del cambio', () => {
    expect(proposePrompt('es', 'add-cart', 'Un carrito')).toContain('openspec/changes/add-cart')
    expect(proposePrompt('en', 'add-cart', 'A cart')).toContain('openspec validate add-cart --strict')
    expect(applyPrompt('es', 'add-cart')).toContain('«- [x]»')
  })
})
