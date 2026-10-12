import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importSkill } from '../../../../src/main/services/skills'

const dir = (): string => mkdtempSync(join(tmpdir(), 'tutti-skill-'))

describe('importar una skill', () => {
  it('copia la carpeta entera a .tutti/skills y devuelve su SKILL.md', () => {
    const base = dir(), project = join(base, 'proyecto'), src = join(base, 'revisar-pr')
    mkdirSync(project); mkdirSync(join(src, 'scripts'), { recursive: true }); mkdirSync(join(src, 'node_modules', 'x'), { recursive: true })
    writeFileSync(join(src, 'SKILL.md'), '---\\nname: revisar-pr\\n---\\n# Revisar')
    writeFileSync(join(src, 'scripts', 'a.sh'), 'echo hola')
    writeFileSync(join(src, 'node_modules', 'x', 'big.js'), 'no se copia')
    const res = importSkill(project, src)
    expect(res).toEqual({ ok: true, message: join(project, '.tutti', 'skills', 'revisar-pr', 'SKILL.md') })
    expect(readFileSync(res.message, 'utf8')).toContain('# Revisar')
    expect(existsSync(join(project, '.tutti', 'skills', 'revisar-pr', 'scripts', 'a.sh'))).toBe(true)
    expect(existsSync(join(project, '.tutti', 'skills', 'revisar-pr', 'node_modules'))).toBe(false)
  })

  it('no pisa una skill existente ni acepta una carpeta sin SKILL.md', () => {
    const base = dir(), project = join(base, 'proyecto'), src = join(base, 'una'), vacia = join(base, 'vacia')
    mkdirSync(project); mkdirSync(src); mkdirSync(vacia); writeFileSync(join(src, 'skill.md'), '# x')          // el nombre del archivo no distingue mayúsculas
    expect(importSkill(project, src).ok).toBe(true)
    expect(importSkill(project, src).ok).toBe(false)
    expect(importSkill(project, vacia).ok).toBe(false)
    expect(importSkill(project, join(base, 'no-existe')).ok).toBe(false)
  })

  it('rechaza una carpeta enorme y una skill que ya está dentro del proyecto', () => {
    const base = dir(), project = join(base, 'proyecto'), grande = join(base, 'grande')
    mkdirSync(project); mkdirSync(grande); writeFileSync(join(grande, 'SKILL.md'), 'x')
    for (let i = 0; i < 210; i++) writeFileSync(join(grande, `f${i}.txt`), 'x')
    expect(importSkill(project, grande).ok).toBe(false)
    const dentro = join(project, '.tutti', 'skills', 'mia'); mkdirSync(dentro, { recursive: true }); writeFileSync(join(dentro, 'SKILL.md'), 'x')
    expect(importSkill(project, dentro).ok).toBe(false)
  })
})
