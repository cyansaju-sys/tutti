import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createPower, installPower, listPowers, mcpEntry, parsePower, powerGuide, powerSummaries, removePower } from '../../../../src/main/services/powers'

const dir = (): string => mkdtempSync(join(tmpdir(), 'tutti-power-'))
function power(base: string, name: string, extra: Record<string, string> = {}): string {
  const d = join(base, name)
  mkdirSync(d, { recursive: true })
  writeFileSync(join(d, 'POWER.md'), `---\nname: ${name}\ndescription: Hace cosas\nkeywords: [db, "sql"]\n---\n# ${name}`)
  for (const [file, text] of Object.entries(extra)) { mkdirSync(join(d, file, '..'), { recursive: true }); writeFileSync(join(d, file), text) }
  return d
}

describe('Powers', () => {
  beforeAll(() => { process.env.TUTTI_CONFIG_DIR = dir() })          // los globales, en una carpeta de prueba
  it('lee la cabecera, el mcp.json y lo que trae', () => {
    const d = power(dir(), 'base-datos', {
      'mcp.json': JSON.stringify({ mcpServers: { pg: { command: 'npx', args: ['-y', 'pg-mcp'] }, api: { url: 'https://x.dev/mcp' } } }),
      'steering/estilo.md': '# x', 'skills/consultar/SKILL.md': '# x', 'hooks/a.json': '{}'
    })
    const p = parsePower(d, 'project')
    expect(p).toMatchObject({ name: 'base-datos', description: 'Hace cosas', keywords: ['db', 'sql'], steering: ['estilo.md'], skills: ['consultar'], hooks: ['a.json'] })
    expect(p.mcp.map((s) => [s.name, s.kind])).toEqual([['pg', 'local'], ['api', 'remote']])
    expect(p.error).toBeUndefined()
  })

  it('marca como inválido un Power sin POWER.md o con un mcp.json roto', () => {
    const base = dir(), vacio = join(base, 'vacio'); mkdirSync(vacio)
    expect(parsePower(vacio, 'project').error).toBeTruthy()
    expect(parsePower(power(base, 'roto', { 'mcp.json': '{' }), 'project').error).toBeTruthy()
    expect(parsePower(power(base, 'sin-comando', { 'mcp.json': JSON.stringify({ mcpServers: { a: {} } }) }), 'project').error).toBeTruthy()
  })

  it('instala en el proyecto o en global, sin pisar, y lo quita', () => {
    const base = dir(), project = join(base, 'proyecto'), src = power(base, 'mio')
    mkdirSync(project)
    const res = installPower(project, src, 'project')
    expect(res).toEqual({ ok: true, message: join(project, '.tutti', 'powers', 'mio') })
    expect(existsSync(join(res.message, 'POWER.md'))).toBe(true)
    expect(installPower(project, src, 'project').ok).toBe(false)
    expect(installPower(null, src, 'project').ok).toBe(false)
    expect(listPowers(project).map((p) => p.name)).toContain('mio')
    expect(removePower(project, 'mio', 'project').ok).toBe(true)
    expect(existsSync(res.message)).toBe(false)
    expect(removePower(project, '../x', 'project').ok).toBe(false)
  })

  it('rechaza una carpeta enorme y un Power que ya está dentro de su destino', () => {
    const base = dir(), project = join(base, 'proyecto'), grande = power(base, 'grande')
    mkdirSync(project)
    for (let i = 0; i < 210; i++) writeFileSync(join(grande, `f${i}.txt`), 'x')
    expect(installPower(project, grande, 'project').ok).toBe(false)
    const dentro = power(join(project, '.tutti', 'powers'), 'dentro')
    expect(installPower(project, dentro, 'project').ok).toBe(false)
  })

  it('mcpEntry deja vacíos los valores de env y cabeceras salvo que se pidan', () => {
    const local = { name: 'pg', kind: 'local' as const, command: 'npx', args: ['-y', 'pg'], env: { TOKEN: 'secreto' } }
    const remote = { name: 'api', kind: 'remote' as const, url: 'https://x.dev/mcp', transport: 'sse' as const, headers: { Authorization: 'Bearer x' } }
    expect(mcpEntry(local, false)).toEqual({ command: 'npx', args: ['-y', 'pg'], env: { TOKEN: '' } })
    expect(mcpEntry(local, true)).toMatchObject({ env: { TOKEN: 'secreto' } })
    expect(mcpEntry(remote, false)).toEqual({ type: 'sse', url: 'https://x.dev/mcp', headers: { Authorization: '' } })
  })

  it('crea un Power copiando steering, skills y hooks del proyecto, y lo lee de vuelta', async () => {
    const project = join(dir(), 'proyecto')
    mkdirSync(join(project, '.tutti', 'steering'), { recursive: true }); writeFileSync(join(project, '.tutti', 'steering', 'estilo.md'), '# estilo')
    mkdirSync(join(project, '.tutti', 'skills', 'revisar'), { recursive: true }); writeFileSync(join(project, '.tutti', 'skills', 'revisar', 'SKILL.md'), '# r')
    mkdirSync(join(project, '.tutti', 'hooks'), { recursive: true }); writeFileSync(join(project, '.tutti', 'hooks', 'a.json'), '{}')
    const draft = { name: 'mi-power', description: 'Reúne "cosas"\nvarias', keywords: ['db', 'sql'], scope: 'project' as const, mcp: [], steering: ['project:estilo.md'], skills: ['revisar', '../fuera'], hooks: ['a.json'], withValues: false }
    const res = await createPower(project, draft)
    expect(res).toEqual({ ok: true, message: join(project, '.tutti', 'powers', 'mi-power') })
    expect(parsePower(res.message, 'project')).toMatchObject({ name: 'mi-power', keywords: ['db', 'sql'], steering: ['estilo.md'], skills: ['revisar'], hooks: ['a.json'] })
    expect(parsePower(res.message, 'project').error).toBeUndefined()
    expect(existsSync(join(project, '.tutti', 'steering', 'estilo.md'))).toBe(true)          // lo original se queda
    expect((await createPower(project, draft)).ok).toBe(false)          // no pisa
    expect((await createPower(project, { ...draft, name: 'otro', steering: [], skills: [], hooks: [] })).ok).toBe(false)          // sin nada que meter
    expect((await createPower(project, { ...draft, name: '../x' })).ok).toBe(false)
    expect((await createPower(null, { ...draft, name: 'global' })).ok).toBe(false)          // en el proyecto, sin proyecto
  })

  it('powerSummaries da una línea por Power y powerGuide su guía y lo que trae, sin arrancar MCP si no tiene', async () => {
    const base = dir(), project = join(base, 'proyecto')
    mkdirSync(project)
    installPower(project, power(base, 'guiado', { 'steering/estilo.md': '# x', 'skills/a/SKILL.md': '# a' }), 'project')
    installPower(project, power(base, 'roto', { 'mcp.json': '{' }), 'project')          // el inválido no aparece
    expect(powerSummaries(project)).toEqual([{ name: 'guiado', description: 'Hace cosas', keywords: ['db', 'sql'] }])
    const res = await powerGuide(project, 'GUIADO')
    expect(res.ok).toBe(true)
    expect(res.info).toMatchObject({ name: 'guiado', guide: '# guiado', mcp: [], steering: [join(project, '.tutti', 'powers', 'guiado', 'steering', 'estilo.md')], skills: [join(project, '.tutti', 'powers', 'guiado', 'skills', 'a')] })
    expect((await powerGuide(project, 'roto')).ok).toBe(false)
    expect((await powerGuide(project, 'nada')).ok).toBe(false)
  })
})
