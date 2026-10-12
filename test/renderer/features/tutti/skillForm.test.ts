import { describe, expect, it } from 'vitest'
import { buildSkillFile, EMPTY_SKILL_FORM, skillAgentPrompt, skillFormError } from '../../../../src/renderer/src/features/tutti/lib/skillForm'

const base = { ...EMPTY_SKILL_FORM, name: 'Revisar PR', description: 'Revisa un pull request. Úsala al revisar cambios.' }

describe('formulario de una skill', () => {
  it('pide un nombre y una descripción (sin ella el agente no sabría cuándo usarla)', () => {
    expect(skillFormError(EMPTY_SKILL_FORM)).toBe('name')
    expect(skillFormError({ ...EMPTY_SKILL_FORM, name: 'x' })).toBe('description')
    expect(skillFormError(base)).toBeNull()
  })

  it('el SKILL.md lleva el nombre en minúsculas con guiones y la descripción en una línea', () => {
    const text = buildSkillFile('es', { ...base, description: 'Revisa un PR.\nÚsala al revisar.' })
    expect(text).toMatch(/^---\nname: revisar-pr\ndescription: Revisa un PR\. Úsala al revisar\.\n---\n/)
  })

  it('sin instrucciones deja el esqueleto corto; con instrucciones, las suyas', () => {
    expect(buildSkillFile('es', base)).toContain('## Cuándo usarla')
    expect(buildSkillFile('en', base)).toContain('## When to use it')
    const own = buildSkillFile('es', { ...base, instructions: '1. Lee el diff.\n2. Resume.' })
    expect(own).toContain('# Revisar PR')
    expect(own).toContain('1. Lee el diff.')
    expect(own).not.toContain('## Cuándo usarla')
  })

  it('al agente se le pide editar la plantilla existente, conservando la cabecera', () => {
    const prompt = skillAgentPrompt('es', base, '.tutti/skills/revisar-pr')
    expect(prompt).toContain('.tutti/skills/revisar-pr/SKILL.md')
    expect(prompt).toContain('no la recrees')
    expect(prompt).toContain(base.description)
  })
})
