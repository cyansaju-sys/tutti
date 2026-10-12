import { describe, expect, it } from 'vitest'
import { buildSteeringFile, EMPTY_STEERING_FORM, foundationFiles, foundationPrompt, patternList, steeringFormError } from '../../../../src/renderer/src/features/tutti/lib/steeringForm'
import { parseSteering } from '../../../../src/main/services/context/steering'

describe('formulario de steering (modos de Kiro)', () => {
  it('pide un nombre, patrones para fileMatch y descripción para auto', () => {
    expect(steeringFormError(EMPTY_STEERING_FORM)).toBe('name')
    const base = { ...EMPTY_STEERING_FORM, name: 'api' }
    expect(steeringFormError(base)).toBeNull()
    expect(steeringFormError({ ...base, inclusion: 'fileMatch' })).toBe('patterns')
    expect(steeringFormError({ ...base, inclusion: 'fileMatch', patterns: ' , ' })).toBe('patterns')
    expect(steeringFormError({ ...base, inclusion: 'auto' })).toBe('description')
    expect(patternList('src/**/*.tsx, **/*.ts')).toEqual(['src/**/*.tsx', '**/*.ts'])
  })

  it('lo que se escribe lo entiende el motor de steering, en cada modo', () => {
    const read = (f: Parameters<typeof buildSteeringFile>[0]) => parseSteering('x.md', buildSteeringFile(f))
    const base = { ...EMPTY_STEERING_FORM, name: 'API Design' }
    expect(read(base)).toMatchObject({ inclusion: 'always', body: '# API Design' })
    expect(read({ ...base, inclusion: 'manual' }).inclusion).toBe('manual')
    expect(read({ ...base, inclusion: 'fileMatch', patterns: 'src/**/*.tsx' })).toMatchObject({ inclusion: 'fileMatch', patterns: ['src/**/*.tsx'] })
    expect(read({ ...base, inclusion: 'fileMatch', patterns: '**/*.ts, **/*.tsx' }).patterns).toEqual(['**/*.ts', '**/*.tsx'])
    expect(read({ ...base, inclusion: 'auto', description: 'Patrones de la API REST' })).toMatchObject({ inclusion: 'auto', name: 'api-design', description: 'Patrones de la API REST' })
  })

  it('los archivos base son product, tech y structure, y se entregan siempre', () => {
    const files = foundationFiles('es')
    expect(Object.keys(files)).toEqual(['product.md', 'tech.md', 'structure.md'])
    for (const [name, text] of Object.entries(files)) expect(parseSteering(name, text).inclusion).toBe('always')
    expect(foundationPrompt('es', '.tutti/steering')).toContain('product.md, tech.md y structure.md')
    expect(foundationPrompt('en', 'dir')).toContain('do not recreate')
  })
})
