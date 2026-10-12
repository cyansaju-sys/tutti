import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureGlobalContext, globalContextFile, legacyContextFile, contextSources, ensureProjectDir, openProjectContext, projectContextFile, readContext, tuttiDir } from '../../../../src/main/services/context/context'

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

  it('al abrir el proyecto solo se crea .tutti con su README; cada subcarpeta, al añadir algo', () => {
    openProjectContext(project)
    expect(existsSync(tuttiDir(project))).toBe(false)                   // mirar el contexto no crea nada
    expect(ensureProjectDir(project)).toBe(tuttiDir(project))
    expect(readdirSync(tuttiDir(project))).toEqual(['README.md'])
    expect(ensureProjectDir(project, 'docs/how-to')).toBe(join(tuttiDir(project), 'docs', 'how-to'))
    expect(existsSync(join(tuttiDir(project), 'docs', 'how-to'))).toBe(true)
    for (const f of ['specs', 'hooks', 'steering', 'skills', 'docs/tutorials']) expect(existsSync(join(tuttiDir(project), f))).toBe(false)
    expect(readFileSync(join(tuttiDir(project), 'README.md'), 'utf8')).toContain('contexto.md')
    writeFileSync(join(tuttiDir(project), 'README.md'), 'mío')
    ensureProjectDir(project, 'specs')
    expect(readFileSync(join(tuttiDir(project), 'README.md'), 'utf8')).toBe('mío')      // no pisa lo que ya haya
    expect(ensureProjectDir(project, '../fuera')).toBe(join(tuttiDir(project), 'fuera'))    // nunca sale de .tutti
    expect(existsSync(projectContextFile(project))).toBe(false)         // el contexto no se crea hasta guardar
  })

  it('el de .tutti se entrega entero y OpenCode lo carga como archivo y no se repite como instrucciones de OpenCode', () => {
    ensureProjectDir(project); ensureProjectDir(project, 'steering'); writeFileSync(projectContextFile(project), '# Mi app\n\nUsa yarn.\n')
    expect(openProjectContext(project)).toMatchObject({ exists: true, text: '# Mi app\n\nUsa yarn.\n' })
    expect(readContext(project)).toEqual({ files: [projectContextFile(project)], text: '# Mi app\n\nUsa yarn.' })
  })

  it('el global va primero y OpenCode lo carga como archivo', () => {
    writeFileSync(ensureGlobalContext(), '# Preferencias\n\nResponde en español.\n')
    ensureProjectDir(project); ensureProjectDir(project, 'steering'); writeFileSync(projectContextFile(project), '# Mi app\n\nUsa yarn.\n')
    const ctx = readContext(project)!
    expect(ctx.text).toBe('# Preferencias\n\nResponde en español.\n\n# Mi app\n\nUsa yarn.')
    expect(ctx.files).toEqual([globalContextFile(), projectContextFile(project)])
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
    ensureProjectDir(project); ensureProjectDir(project, 'steering'); writeFileSync(projectContextFile(project), '# Nuevo\n')
    expect(readContext(project)!.text).toBe('# Nuevo')               // el del repositorio manda
  })

describe('un solo archivo de contexto por proyecto', () => {
  it('si el proyecto ya tiene AGENTS.md, ese es el contexto: se edita ahí, sin copias, y OpenCode no lo repite', () => {
    const agents = join(project, 'AGENTS.md')
    writeFileSync(agents, '# Reglas\n\nUsa yarn.\n')
    expect(projectContextFile(project)).toBe(agents)
    expect(openProjectContext(project)).toMatchObject({ file: agents, exists: true, text: '# Reglas\n\nUsa yarn.\n' })
    expect(readContext(project)).toEqual({ files: [], text: '# Reglas\n\nUsa yarn.' })
    expect(existsSync(tuttiDir(project))).toBe(false)                   // no se crea nada más
  })

  it('sin AGENTS.md el contexto va a .tutti/steering y no se crea ningún AGENTS.md', () => {
    expect(projectContextFile(project)).toBe(join(tuttiDir(project), 'steering', 'contexto.md'))
    ensureProjectDir(project, 'steering'); writeFileSync(projectContextFile(project), '# Mi app\n')
    expect(existsSync(join(project, 'AGENTS.md'))).toBe(false)
  })

  it('un contexto ya guardado en .tutti manda sobre un AGENTS.md que aparezca después', () => {
    ensureProjectDir(project, 'steering'); writeFileSync(join(tuttiDir(project), 'steering', 'contexto.md'), '# Mío\n')
    writeFileSync(join(project, 'AGENTS.md'), '# Otro\n')
    expect(projectContextFile(project)).toBe(join(tuttiDir(project), 'steering', 'contexto.md'))
  })

  it('un AGENTS.md que solo apunta a .tutti (de una versión anterior) no cuenta como contexto', () => {
    writeFileSync(join(project, 'AGENTS.md'), 'Las reglas viven en `.tutti/steering/contexto.md`.\n')
    expect(projectContextFile(project)).toBe(join(tuttiDir(project), 'steering', 'contexto.md'))
    expect(readContext(project)).toBeNull()
  })
})

describe('steering al estilo de Kiro', () => {
  const steering = (name: string, text: string): void => { ensureProjectDir(project, 'steering'); writeFileSync(join(tuttiDir(project), 'steering', name), text) }
  const git = (...args: string[]): void => { execFileSync('git', args, { cwd: project, stdio: 'ignore' }) }

  it('sin cabecera un steering se entrega siempre (como Kiro), sin su cabecera; manual y auto solo se listan con su ruta', () => {
    steering('contexto.md', '# Mi app\n')
    steering('estilo.md', '---\ninclusion: always\n---\n\n# Estilo\n\nSin punto y coma.\n')
    steering('suelto.md', '# Suelto\n\nSe entrega.\n')
    steering('despliegue.md', '---\ninclusion: manual\n---\n\n# Despliegue\nNo se copia.\n')
    steering('api.md', '---\ninclusion: auto\nname: api-design\ndescription: Patrones de la API REST\n---\n\n# API\nNo se copia.\n')
    const ctx = readContext(project)!
    expect(ctx.text).toContain('# Mi app')
    expect(ctx.text).toContain('Sin punto y coma.')
    expect(ctx.text).toContain('Se entrega.')
    expect(ctx.text).not.toContain('inclusion:')
    expect(ctx.text).not.toContain('No se copia')
    expect(ctx.text).toContain('- api-design: Patrones de la API REST (.tutti/steering/api.md)')
    expect(ctx.text).toContain('- despliegue (.tutti/steering/despliegue.md)')
  })

  it('OpenCode recibe el steering ya ensamblado como un solo archivo de instrucciones', () => {
    steering('contexto.md', '# Mi app\n'); steering('estilo.md', '# Estilo\n')
    const ctx = readContext(project)!
    expect(ctx.files).toHaveLength(2)
    expect(ctx.files[0]).toBe(projectContextFile(project))
    expect(readFileSync(ctx.files[1], 'utf8')).toContain('# Estilo')
  })

  it('fileMatch se entrega entero solo si hay cambios en archivos que coinciden con el patrón', () => {
    git('init', '-q'); git('config', 'user.email', 'a@b.c'); git('config', 'user.name', 'x')
    steering('react.md', '---\ninclusion: fileMatch\nfileMatchPattern: "src/components/**/*.tsx"\n---\n\n# React\nUsa componentes de función.\n')
    steering('ts.md', '---\ninclusion: fileMatch\nfileMatchPattern: ["**/*.ts", "**/*.tsx"]\n---\n\n# TS\nTipos estrictos.\n')
    git('add', '-A'); git('commit', '-q', '-m', 'base')
    expect(readContext(project)!.text).not.toContain('Usa componentes de función')                 // sin cambios: solo listados
    expect(readContext(project)!.text).toContain('- react [src/components/**/*.tsx] (.tutti/steering/react.md)')
    mkdirSync(join(project, 'src', 'components'), { recursive: true })
    writeFileSync(join(project, 'src', 'components', 'Boton.tsx'), 'export {}')
    const text = readContext(project)!.text
    expect(text).toContain('Usa componentes de función')
    expect(text).toContain('Tipos estrictos.')                                                    // el segundo patrón (lista) también coincide
  })

  it('las referencias #[[file:…]] y #[[folder:…]] se sustituyen por el contenido real y nunca salen del proyecto', () => {
    writeFileSync(join(project, 'openapi.yaml'), 'openapi: 3.0.0\ninfo:\n  title: API\n')
    mkdirSync(join(project, 'config')); writeFileSync(join(project, 'config', 'a.json'), '{}')
    steering('refs.md', 'Contrato: #[[file:openapi.yaml]]\nSolo la línea 2: #[[file:openapi.yaml:2-2]]\nConfig: #[[folder:config]]\nSecreto: #[[file:../fuera.txt]]\nNo existe: #[[file:nada.md]]\n')
    const text = readContext(project)!.text
    expect(text).toContain('openapi: 3.0.0')
    expect(text).toContain('// openapi.yaml:2-2')
    expect(text).toContain('- a.json')
    expect(text).toContain('está fuera del proyecto')
    expect(text).toContain('no se encontró nada.md')
    expect(text).not.toContain('#[[')
  })

  it('las fuentes enumeran cada parte con su modo y si va entera o solo listada', () => {
    writeFileSync(ensureGlobalContext(), '# Preferencias\n\nResponde en español.\n')
    steering('contexto.md', '# Mi app\n'); steering('estilo.md', '# Estilo\n'); steering('manual.md', '---\ninclusion: manual\n---\n# M\n')
    const rows = contextSources(project)
    expect(rows.map((r) => [r.kind, r.name, r.mode, r.delivered])).toEqual([['global', 'global', undefined, undefined], ['project', 'contexto.md', undefined, undefined], ['steering', 'estilo.md', 'always', 'full'], ['steering', 'manual.md', 'manual', 'index']])
    expect(contextSources(join(project, 'otro'))).toHaveLength(1)        // sin proyecto solo queda el global
  })
})
})
