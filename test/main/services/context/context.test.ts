import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureGlobalContext, globalContextFile, legacyContextFile, openProjectContext, projectContextFile, readContext } from '../../../../src/main/services/context/context'

let base = ''
let project = ''
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'tutti-ctx-'))
  process.env.TUTTI_CONFIG_DIR = join(base, 'config')
  project = join(base, 'proyecto')
  mkdirSync(project, { recursive: true })
})
afterEach(() => { delete process.env.TUTTI_CONFIG_DIR; rmSync(base, { recursive: true, force: true }) })

describe('contexto en el repositorio y global', () => {
  it('sin nada escrito no hay contexto ni se crea ningún archivo', () => {
    expect(readContext(project)).toBeNull()
    const opened = openProjectContext(project)
    expect(opened).toMatchObject({ file: projectContextFile(project), exists: false })
    expect(opened.text).toContain('Contexto del proyecto')          // parte de la plantilla (en las pruebas, español)
  })

  it('el de AGENTS.md se entrega entero y no se repite como instrucciones de OpenCode', () => {
    writeFileSync(projectContextFile(project), '# Mi app\n\nUsa yarn.\n')
    expect(openProjectContext(project)).toMatchObject({ exists: true, text: '# Mi app\n\nUsa yarn.\n' })
    expect(readContext(project)).toEqual({ files: [], text: '# Mi app\n\nUsa yarn.' })
  })

  it('el global va primero y OpenCode lo carga como archivo', () => {
    writeFileSync(ensureGlobalContext(), '# Preferencias\n\nResponde en español.\n')
    writeFileSync(projectContextFile(project), '# Mi app\n\nUsa yarn.\n')
    const ctx = readContext(project)!
    expect(ctx.text).toBe('# Preferencias\n\nResponde en español.\n\n# Mi app\n\nUsa yarn.')
    expect(ctx.files).toEqual([globalContextFile()])
  })

  it('las plantillas sin tocar no se envían', () => {
    ensureGlobalContext()                                              // crea la plantilla global
    expect(readContext(project)).toBeNull()
  })

  it('un contexto antiguo (en la configuración) se sigue usando hasta que se guarde en el repositorio', () => {
    const old = legacyContextFile(project)
    mkdirSync(join(old, '..'), { recursive: true })
    writeFileSync(old, '# Antiguo\n\nViene de la configuración.\n')
    expect(openProjectContext(project)).toMatchObject({ exists: false, text: '# Antiguo\n\nViene de la configuración.' })
    expect(readContext(project)).toEqual({ files: [old], text: '# Antiguo\n\nViene de la configuración.' })
    writeFileSync(projectContextFile(project), '# Nuevo\n')
    expect(readContext(project)!.text).toBe('# Nuevo')               // el del repositorio manda
  })
})
