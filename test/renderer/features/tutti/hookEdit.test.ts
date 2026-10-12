import { describe, expect, it } from 'vitest'
import { hookAgentPrompt, hookEditPath, parseHookEditPath, readHookForm, replaceHook } from '../../../../src/renderer/src/features/tutti/lib/hookEdit'

const file = JSON.stringify({ version: 'v1', hooks: [
  { name: 'Lint', trigger: 'PostFileSave', matcher: '\\.ts$', action: { type: 'command', command: 'npx eslint --fix', }, timeout: 120, enabled: false, confirm: { question: '¿?' } },
  { name: 'Aviso', trigger: 'Stop', action: { type: 'agent', prompt: 'Resume' }, enabled: true }
] })

describe('editar un hook con el formulario', () => {
  it('la ruta del formulario identifica el archivo y el hook', () => {
    const path = hookEditPath('/p/.tutti/hooks/a.json', 1)
    expect(parseHookEditPath(path)).toEqual({ file: '/p/.tutti/hooks/a.json', index: 1 })
    expect(parseHookEditPath('hook:new')).toBeNull()
  })

  it('el formulario parte de lo que dice el hook elegido', () => {
    expect(readHookForm(file, 0)).toMatchObject({ name: 'Lint', trigger: 'PostFileSave', matcher: '\\.ts$', action: 'command', command: 'npx eslint --fix', timeout: '120' })
    expect(readHookForm(file, 1)).toMatchObject({ name: 'Aviso', trigger: 'Stop', action: 'agent', prompt: 'Resume' })
    expect(readHookForm(file, 7)).toBeNull()
    expect(readHookForm('no es json', 0)).toBeNull()
  })

  it('guardar cambia solo ese hook y respeta enabled, confirm y los demás', () => {
    const form = { ...readHookForm(file, 0)!, name: 'Lint rápido', matcher: '', timeout: '60', command: 'npx eslint' }
    const next = JSON.parse(replaceHook(file, 0, form)!)
    expect(next.hooks[0]).toEqual({ name: 'Lint rápido', trigger: 'PostFileSave', action: { type: 'command', command: 'npx eslint' }, enabled: false, confirm: { question: '¿?' } })
    expect(next.hooks[1]).toEqual(JSON.parse(file).hooks[1])
    expect(replaceHook(file, 5, form)).toBeNull()
  })

  it('cambiar de comando a agente deja la acción nueva', () => {
    const form = { ...readHookForm(file, 0)!, action: 'agent' as const, prompt: 'Revisa esto' }
    expect(JSON.parse(replaceHook(file, 0, form)!).hooks[0].action).toEqual({ type: 'agent', prompt: 'Revisa esto' })
  })

  it('el mensaje al agente explica el formato y pide guardarlo apagado', () => {
    const prompt = hookAgentPrompt('es', 'Al guardar un .ts, ejecuta las pruebas')
    expect(prompt).toContain('.tutti/hooks/')
    expect(prompt).toContain('PostFileSave')
    expect(prompt).toContain('Al guardar un .ts, ejecuta las pruebas')
    expect(prompt).toContain('"enabled": false')
    expect(hookAgentPrompt('en', 'x')).toContain('until I approve it')
  })
})
