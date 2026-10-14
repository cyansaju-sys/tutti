import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applySync, cleanOpencodeFile, launchServers, resolveSync, standardizeProject, syncState } from '../../../../src/main/services/mcp/sync'

/** Solo Claude y Cursor "instalados": Cursor se escribe en un archivo, así que no hace falta ninguna CLI. */
const installed = (a: string): boolean => a === 'claude' || a === 'cursor'

const project = (claude: Record<string, unknown>, cursor?: Record<string, unknown>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'tutti-sync-'))
  writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: claude }))
  if (cursor) { mkdirSync(join(dir, '.cursor')); writeFileSync(join(dir, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: cursor })) }
  return dir
}

describe('sincronizar con Claude Code como fuente', () => {
  it('sin Claude instalado no hay fuente', () => {
    expect(syncState(project({}), 'project', (a) => a === 'cursor').available).toBe(false)
    expect(syncState(null, 'project', installed).available).toBe(false)
  })
  it('marca igual, falta y distinto, y cuenta lo que solo está en otro agente', () => {
    const dir = project(
      { igual: { command: 'npx', args: ['-y', 'a'] }, falta: { url: 'https://x/mcp' }, otro: { command: 'npx', args: ['-y', 'v1'] } },
      { igual: { command: 'npx', args: ['-y', 'a'] }, otro: { command: 'npx', args: ['-y', 'v2'] }, solo: { command: 'z' } }
    )
    const s = syncState(dir, 'project', installed)
    expect(s.available).toBe(true)
    const by = Object.fromEntries(s.servers.map((x) => [x.name, x.agents.map((a) => `${a.agent}:${a.state}`)]))
    expect(by).toEqual({ igual: ['cursor:ok'], falta: ['cursor:missing'], otro: ['cursor:differs'] })
    expect(s.extras).toBe(1)
  })
  it('añadir lo que falta, traer lo que sobra y resolver un desfase', async () => {
    const dir = project(
      { falta: { url: 'https://x/mcp' }, otro: { command: 'npx', args: ['-y', 'v1'] } },
      { otro: { command: 'npx', args: ['-y', 'v2'] }, solo: { command: 'z' } }
    )
    expect((await applySync(dir, 'project', installed)).ok).toBe(true)
    expect(syncState(dir, 'project', installed).servers.find((s) => s.name === 'falta')!.agents[0].state).toBe('ok')
    expect((await resolveSync(dir, 'project', 'otro', 'cursor', 'source')).ok).toBe(true)
    expect(syncState(dir, 'project', installed).servers.find((s) => s.name === 'otro')!.agents[0].state).toBe('ok')
    expect((await resolveSync(dir, 'project', 'nada', 'cursor', 'source')).ok).toBe(false)
  })
  it('SSE: Cursor lo detecta solo (igual con su url) y Codex no lo admite', () => {
    const dir = project({ viejo: { type: 'sse', url: 'https://x/sse' } }, { viejo: { url: 'https://x/sse' } })
    const s = syncState(dir, 'project', (a) => a === 'claude' || a === 'cursor' || a === 'codex')
    expect(s.servers[0].agents.map((a) => `${a.agent}:${a.state}`)).toEqual(['cursor:ok', 'codex:unsupported'])
  })
})

/** Pasar algo a .mcp.json usa la CLI de Claude Code: sin ella esa prueba no se puede hacer. */
const hasClaude = ((): boolean => { try { execFileSync('claude', ['--version'], { stdio: 'ignore', timeout: 8000 }); return true } catch { return false } })()

describe('estandarizar los MCP locales', () => {
  const read = (dir: string, file: string): Record<string, unknown> => JSON.parse(readFileSync(join(dir, file), 'utf8'))
  it('OpenCode en el proyecto no escribe opencode.json: lo recibe al abrirlo', () => {
    const dir = project({ a: { command: 'x' } })
    const s = syncState(dir, 'project', (a) => a === 'claude' || a === 'opencode')
    expect(s.servers[0].agents).toEqual([{ agent: 'opencode', state: 'launch' }])
    expect(launchServers(dir).map((x) => x.name)).toEqual(['a'])
  })
  it('cuenta los que se pueden pasar a .mcp.json', () => {
    const dir = project({ a: { command: 'x' } }, { solo: { command: 'z' } })
    expect(syncState(dir, 'project', installed).local).toBe(1)
  })
  it('quita de opencode.json lo que ya está igual en .mcp.json y borra el archivo si solo tenía MCP', async () => {
    const dir = project({ a: { command: 'npx', args: ['-y', 'a'] } })
    writeFileSync(join(dir, 'opencode.json'), JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: { servers: { a: { type: 'local', command: ['npx', '-y', 'a'] } } } }))
    const r = await standardizeProject(dir, installed)
    expect(r.ok).toBe(true)
    expect(r.message).toContain('eliminado')
    expect(existsSync(join(dir, 'opencode.json'))).toBe(false)
  })
  it('conserva opencode.json si tiene más ajustes, y no toca lo que está distinto', async () => {
    const dir = project({ a: { command: 'npx', args: ['-y', 'a'] }, b: { command: 'npx', args: ['-y', 'b1'] } })
    writeFileSync(join(dir, 'opencode.json'), JSON.stringify({ theme: 'dark', mcp: { servers: { a: { type: 'local', command: ['npx', '-y', 'a'] }, b: { type: 'local', command: ['npx', '-y', 'b2'] } } } }))
    const r = await standardizeProject(dir, installed)
    expect(r.message).toContain('Distintos')
    const file = read(dir, 'opencode.json') as { theme: string; mcp: { servers: Record<string, unknown> } }
    expect(file.theme).toBe('dark')
    expect(Object.keys(file.mcp.servers)).toEqual(['b'])
  })
  it.skipIf(!hasClaude)('no mueve a .mcp.json lo que lleva claves o tokens', async () => {
    const dir = project({}, { seguro: { command: 'z' }, secreto: { command: 'y', env: { API_KEY: 'sk-1' } } })
    const r = await standardizeProject(dir, installed)
    expect(r.message).toContain('secreto')
    expect(Object.keys((read(dir, '.mcp.json') as { mcpServers: Record<string, unknown> }).mcpServers)).toContain('seguro')
    expect(Object.keys((read(dir, '.mcp.json') as { mcpServers: Record<string, unknown> }).mcpServers)).not.toContain('secreto')
  })
  it('cleanOpencodeFile quita el 1.x plano y deja $schema fuera', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutti-oc-'))
    const file = join(dir, 'opencode.json')
    writeFileSync(file, JSON.stringify({ $schema: 's', mcp: { a: { type: 'local', command: ['x'] } } }))
    expect(cleanOpencodeFile(file, ['a'])).toEqual({ removed: 1, deleted: true })
  })
})
