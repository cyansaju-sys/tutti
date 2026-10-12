import { describe, expect, it } from 'vitest'
import { buildHookFile, EMPTY_HOOK_FORM, hookFormError, slug, specTemplates, taskProgress, withEnabled } from '../../../../src/renderer/src/features/tutti/lib/spec'

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

  it('el formulario de un hook pide lo imprescindible y avisa de una regex inválida', () => {
    expect(hookFormError(EMPTY_HOOK_FORM)).toBe('name')
    const base = { ...EMPTY_HOOK_FORM, name: 'Revisar' }
    expect(hookFormError(base)).toBe('prompt')                                                  // por defecto le pide algo al agente
    expect(hookFormError({ ...base, prompt: 'Mira esto' })).toBeNull()
    expect(hookFormError({ ...base, action: 'command' })).toBe('command')
    expect(hookFormError({ ...base, action: 'command', command: 'npm test' })).toBeNull()
    expect(hookFormError({ ...base, prompt: 'x', matcher: '([' })).toBe('matcher')
    expect(hookFormError({ ...base, action: 'command', command: 'x', timeout: 'abc' })).toBe('timeout')
  })

  it('el hook se escribe en el formato de Kiro, solo con los campos rellenados', () => {
    const agent = JSON.parse(buildHookFile({ ...EMPTY_HOOK_FORM, name: ' Revisar ', prompt: ' Mira esto ' }))
    expect(agent).toEqual({ version: 'v1', hooks: [{ name: 'Revisar', trigger: 'PostFileSave', action: { type: 'agent', prompt: 'Mira esto' }, enabled: true }] })
    const cmd = JSON.parse(buildHookFile({ ...EMPTY_HOOK_FORM, name: 'Lint', description: 'Arregla el estilo', matcher: '\\.ts$', action: 'command', command: 'npx eslint --fix $TUTTI_HOOK_FILE', timeout: '120' }))
    expect(cmd.hooks[0]).toEqual({ name: 'Lint', description: 'Arregla el estilo', trigger: 'PostFileSave', matcher: '\\.ts$', action: { type: 'command', command: 'npx eslint --fix $TUTTI_HOOK_FILE' }, timeout: 120, enabled: true })
  })

  it('el interruptor cambia solo «enabled» del hook indicado', () => {
    const text = JSON.stringify({ version: 'v1', hooks: [{ name: 'a', enabled: false }, { name: 'b', enabled: true }] })
    expect(JSON.parse(withEnabled(text, 0, true)!).hooks.map((h: { enabled: boolean }) => h.enabled)).toEqual([true, true])
    expect(withEnabled(text, 5, true)).toBeNull()
    expect(withEnabled('no es json', 0, true)).toBeNull()
  })
})
