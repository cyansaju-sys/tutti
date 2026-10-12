import { describe, expect, it } from 'vitest'
import { taskProgress } from '../../../../src/renderer/src/features/tutti/lib/spec'
import { EMPTY_SPEC_FORM, firstSpecFile, specAgentPrompt, specFiles, specFormError, specPhases } from '../../../../src/renderer/src/features/tutti/lib/specForm'

const feature = { ...EMPTY_SPEC_FORM, name: 'carrito', description: 'Que el cliente pueda pagar en un paso' }

describe('formulario de una spec (flujo de Kiro)', () => {
  it('pide un nombre, y una descripción si lo va a redactar el agente', () => {
    expect(specFormError(EMPTY_SPEC_FORM)).toBe('name')
    expect(specFormError({ ...EMPTY_SPEC_FORM, name: 'x' })).toBeNull()
    expect(specFormError({ ...EMPTY_SPEC_FORM, name: 'x', useAgent: true })).toBe('description')
    expect(specFormError({ ...feature, useAgent: true })).toBeNull()
  })

  it('una funcionalidad crea requirements, design y tasks, con la descripción en la introducción', () => {
    const files = specFiles('es', feature)
    expect(Object.keys(files)).toEqual(['requirements.md', 'design.md', 'tasks.md'])
    expect(files['requirements.md']).toContain('Que el cliente pueda pagar en un paso')
    expect(firstSpecFile(feature)).toBe('requirements.md')
  })

  it('con «diseño primero» la descripción abre el diseño y el flujo empieza por él', () => {
    const f = { ...feature, flow: 'design-first' as const }
    expect(specFiles('es', f)['design.md']).toContain('Que el cliente pueda pagar en un paso')
    expect(specFiles('es', f)['requirements.md']).not.toContain('Que el cliente pueda pagar')
    expect(firstSpecFile(f)).toBe('design.md')
    expect(specPhases(f)).toEqual(['design.md', 'requirements.md', 'tasks.md'])
  })

  it('un error crea bugfix.md (actual, esperado y sin regresiones) en lugar de requirements.md', () => {
    const bug = { ...feature, type: 'bugfix' as const, description: 'El total no suma el envío' }
    const files = specFiles('es', bug)
    expect(Object.keys(files)).toEqual(['bugfix.md', 'design.md', 'tasks.md'])
    expect(files['bugfix.md']).toContain('El total no suma el envío')
    expect(files['bugfix.md']).toContain('DEBERÁ SEGUIR')
    expect(specFiles('en', bug)['bugfix.md']).toContain('SHALL CONTINUE TO')
    expect(taskProgress(files['tasks.md'])).toEqual({ done: 0, total: 4 })
    expect(firstSpecFile(bug)).toBe('bugfix.md')
  })

  it('el mensaje al agente va por fases, con aprobación entre ellas y sin código', () => {
    const prompt = specAgentPrompt('es', feature, '.tutti/specs/carrito')
    expect(prompt).toContain('.tutti/specs/carrito')
    expect(prompt).toContain('Que el cliente pueda pagar en un paso')
    expect(prompt.indexOf('1. requirements.md')).toBeLessThan(prompt.indexOf('2. design.md'))
    expect(prompt).toContain('espera mi aprobación')
    expect(prompt).toContain('No escribas código')
    expect(specAgentPrompt('en', { ...feature, type: 'bugfix' }, 'dir')).toContain('1. bugfix.md')
  })

  it('la spec rápida se lo pide todo al agente de una vez, sin esperar aprobación entre archivos', () => {
    const quick = { ...feature, flow: 'quick' as const }
    const prompt = specAgentPrompt('es', quick, '.tutti/specs/carrito')
    expect(prompt).toContain('spec rápida')
    expect(prompt).toContain('de una sola vez')
    expect(prompt).toContain('sin esperar mi aprobación entre archivos')
    expect(prompt).not.toContain('Trabaja por fases')
    expect(firstSpecFile(quick)).toBe('requirements.md')
    expect(specAgentPrompt('es', { ...quick, type: 'bugfix' as const }, 'd')).toContain('Trabaja por fases')          // un error sigue por fases
  })
})
