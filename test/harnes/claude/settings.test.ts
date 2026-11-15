import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { projectSettings } from '@/harnes/claude/chat'

let project = ''
beforeEach(() => { project = mkdtempSync(join(tmpdir(), 'tutti-set-')) })
afterEach(() => rmSync(project, { recursive: true, force: true }))
const put = (rel: string, text: string): void => { const f = join(project, rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, text) }

describe('settings.json del proyecto', () => {
  it('sin archivo no hay ajustes ni error', () => {
    expect(projectSettings(project)).toEqual({ settings: null, error: '' })
    expect(projectSettings(null)).toEqual({ settings: null, error: '' })
  })
  it('lee .tutti/settings.json y, si el proyecto usa .agents, el de .agents', () => {
    put('.tutti/settings.json', '{ "permissions": { "allow": ["Bash(ls:*)"] } }')
    expect(projectSettings(project).settings).toEqual({ permissions: { allow: ['Bash(ls:*)'] } })
    const other = mkdtempSync(join(tmpdir(), 'tutti-set2-'))
    mkdirSync(join(other, '.agents'))
    writeFileSync(join(other, '.agents', 'settings.json'), '{ "model": "haiku" }')
    expect(projectSettings(other).settings).toEqual({ model: 'haiku' })
    rmSync(other, { recursive: true, force: true })
  })
  it('un JSON roto o que no es un objeto da un error y no se aplica', () => {
    put('.tutti/settings.json', '{ "a": 1, }')
    expect(projectSettings(project).settings).toBeNull()
    expect(projectSettings(project).error).toContain('settings.json')
    put('.tutti/settings.json', '[1]')
    expect(projectSettings(project).error).toContain('objeto')
  })
})
