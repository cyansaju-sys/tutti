import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expandSlash, slashCommands } from '../../../src/main/services/slash'

const project = mkdtempSync(join(tmpdir(), 'slash-'))
mkdirSync(join(project, '.claude', 'commands', 'git'), { recursive: true })
mkdirSync(join(project, '.claude', 'skills', 'deploy'), { recursive: true })
mkdirSync(join(project, '.gemini', 'commands'), { recursive: true })
writeFileSync(join(project, '.claude', 'commands', 'review.md'), '---\ndescription: Revisa el diff\n---\nRevisa esto: $ARGUMENTS\n')
writeFileSync(join(project, '.claude', 'commands', 'git', 'pr.md'), 'Prepara un PR\n')
writeFileSync(join(project, '.claude', 'skills', 'deploy', 'SKILL.md'), '---\ndescription: Despliega\n---\nPasos del despliegue\n')
writeFileSync(join(project, '.gemini', 'commands', 'plan.toml'), 'description = "Planifica"\nprompt = """\nPlanifica {{args}}\n"""\n')

describe('/comandos de los agentes', () => {
  it('lista los del proyecto: comandos, subcarpetas con «:» y skills', () => {
    const names = slashCommands(project, 'claude').filter((c) => c.source === 'project').map((c) => c.name)
    expect(names).toEqual(['deploy', 'git:pr', 'review'])
    expect(slashCommands(project, 'claude').find((c) => c.name === 'review')?.description).toBe('Revisa el diff')
    expect(slashCommands(project, 'gemini').find((c) => c.name === 'plan')?.description).toBe('Planifica')
  })

  it('añade los de Tutti, que valen para cualquier agente, y los de archivo ganan', () => {
    expect(slashCommands(project, 'agy').map((c) => c.name)).toEqual(['explain', 'review', 'security-review'])
    expect(slashCommands(project, 'claude').find((c) => c.name === 'review')?.source).toBe('project')
  })

  it('al enviar, sustituye el comando por su texto con los argumentos', () => {
    expect(expandSlash(project, 'claude', '/review el login')).toBe('Revisa esto: el login')
    expect(expandSlash(project, 'gemini', '/plan la tienda')).toBe('Planifica la tienda')
    expect(expandSlash(project, 'claude', '/git:pr rápido')).toBe('Prepara un PR\n\nARGUMENTS: rápido')
    expect(expandSlash(project, 'claude', '/desconocido x')).toBe('/desconocido x')
    expect(expandSlash(project, 'claude', 'hola')).toBe('hola')
  })
})
