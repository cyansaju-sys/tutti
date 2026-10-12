import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const store: Record<string, unknown> = {}
vi.mock('../../../../src/main/services/settings', () => ({ getSetting: (k: string) => store[k], setSetting: (k: string, v: unknown) => { store[k] = v } }))

import { createGuard, isTrusted, loadHooks, matches, parseHookFile, setTrusted } from '../../../../src/main/services/hooks'

const lint = { version: 'v1', hooks: [{ name: 'Lint on save', trigger: 'PostFileSave', matcher: '\\.(ts|tsx)$', action: { type: 'command', command: 'npx eslint --fix' } }] }

describe('hooks de .tutti (formato de Kiro)', () => {
  it('lee un hook válido con sus valores por defecto', () => {
    const [h] = parseHookFile('/p/.tutti/hooks/lint.json', JSON.stringify(lint))
    expect(h).toMatchObject({ name: 'Lint on save', trigger: 'PostFileSave', matcher: '\\.(ts|tsx)$', actionType: 'command', enabled: true, supported: true })
    expect(h.error).toBeUndefined()
  })

  it('un archivo con varios hooks los devuelve todos, y «enabled: false» los apaga', () => {
    const text = JSON.stringify({ version: 'v1', hooks: [lint.hooks[0], { name: 'Aviso', trigger: 'PostFileSave', action: { type: 'agent', prompt: 'Mira esto' }, enabled: false }] })
    const hooks = parseHookFile('f.json', text)
    expect(hooks.map((h) => [h.name, h.actionType, h.enabled])).toEqual([['Lint on save', 'command', true], ['Aviso', 'agent', false]])
  })

  it('los eventos internos de la sesión se leen pero Tutti no los ejecuta', () => {
    const text = JSON.stringify({ version: 'v1', hooks: ['PreToolUse', 'PostToolUse', 'Stop'].map((trigger) => ({ name: trigger, trigger, action: { type: 'command', command: 'true' } })) })
    const hooks = parseHookFile('f.json', text)
    expect(hooks.every((h) => !h.error && !h.supported)).toBe(true)
  })

  it('explica por qué un hook o un archivo no valen', () => {
    expect(parseHookFile('malo.json', '{ no es json')[0].error).toBeTruthy()
    expect(parseHookFile('f.json', JSON.stringify({ hooks: [] }))[0].error).toBeTruthy()                       // sin «version»
    const bad = (hook: object): string | undefined => parseHookFile('f.json', JSON.stringify({ version: 'v1', hooks: [hook] }))[0].error
    expect(bad({ name: 'a', trigger: 'Otro', action: { type: 'command', command: 'x' } })).toContain('Otro')
    expect(bad({ name: 'a', trigger: 'Stop', action: { type: 'raro' } })).toBeTruthy()
    expect(bad({ name: 'a', trigger: 'Stop', action: { type: 'command' } })).toBeTruthy()
    expect(bad({ name: 'a', trigger: 'Stop', action: { type: 'agent' } })).toBeTruthy()
  })

  it('el matcher es una expresión regular sobre la ruta; sin matcher valen todos y una inválida no vale ninguno', () => {
    expect(matches('\\.(ts|tsx)$', 'src/App.tsx')).toBe(true)
    expect(matches('\\.(ts|tsx)$', 'README.md')).toBe(false)
    expect(matches('', 'lo-que-sea.txt')).toBe(true)
    expect(matches('([', 'a.ts')).toBe(false)
    expect(matches('^src/', 'src\\\\a.ts'.replace('\\\\', '/'))).toBe(true)
  })

  it('un hook no se dispara a sí mismo: ni a la vez ni justo después de terminar', () => {
    const guard = createGuard(1000)
    expect(guard.enter('a', 0)).toBe(true)
    expect(guard.enter('a', 10)).toBe(false)           // sigue corriendo
    guard.leave('a', 500)
    expect(guard.enter('a', 900)).toBe(false)          // el archivo lo acaba de reescribir el propio hook
    expect(guard.enter('a', 1600)).toBe(true)
    expect(guard.enter('b', 0)).toBe(true)             // otro archivo, aparte
  })

  it('carga los .json de .tutti/hooks y solo se ejecutan en proyectos autorizados', () => {
    const project = mkdtempSync(join(tmpdir(), 'tutti-hooks-'))
    mkdirSync(join(project, '.tutti', 'hooks'), { recursive: true })
    writeFileSync(join(project, '.tutti', 'hooks', 'lint.json'), JSON.stringify(lint))
    writeFileSync(join(project, '.tutti', 'hooks', 'notas.txt'), 'no es un hook')
    expect(loadHooks(project).map((h) => h.name)).toEqual(['Lint on save'])
    expect(loadHooks(join(project, 'otro'))).toEqual([])
    expect(isTrusted(project)).toBe(false)
    setTrusted(project, true)
    expect(isTrusted(project)).toBe(true)
    setTrusted(project, false)
    expect(isTrusted(project)).toBe(false)
  })
})
