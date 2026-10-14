import { describe, expect, it } from 'vitest'
import type { McpServer } from '@shared/types'
import { agentsMissing, isAppServer, mask, removeTargets, parsePairs, specFromServer, splitArgs } from '../../../../src/renderer/src/features/mcp/lib/mcp'

const server = (patch: Partial<McpServer>): McpServer => ({ name: 'x', agent: 'claude', scope: 'global', kind: 'remote', target: '', config: {}, source: '', ...patch })

describe('MCP en la interfaz', () => {
  it('el servidor «tutti» de la app (global) no se muestra; uno de proyecto con ese nombre, sí', () => {
    expect(isAppServer({ name: 'tutti', scope: 'global' })).toBe(true)
    expect(isAppServer({ name: 'Tutti', scope: 'global' })).toBe(true)
    expect(isAppServer({ name: 'tutti', scope: 'shared' })).toBe(false)
    expect(isAppServer({ name: 'context7', scope: 'global' })).toBe(false)
  })
  it('al quitar un servidor de .mcp.json, Antigravity y Codex no se borran aparte (lo siguen)', () => {
    const sv = (agent: McpServer['agent'], scope: McpServer['scope'], disabled = false): McpServer => ({ name: 'x', agent, scope, kind: 'local', target: 'x', config: {}, source: '', disabled })
    const group = [sv('claude', 'shared'), sv('agy', 'project'), sv('codex', 'project'), sv('gemini', 'project'), sv('codex', 'global'), sv('agy', 'project', true)]
    expect(removeTargets(group).map((x) => `${x.agent}:${x.scope}${x.disabled ? ':off' : ''}`)).toEqual(['claude:shared', 'gemini:project', 'codex:global', 'agy:project:off'])
    expect(removeTargets([sv('agy', 'project')])).toHaveLength(1)                  // sin .mcp.json, se borra como cualquier copia
  })
  it('parsea pares con distintos separadores', () => {
    expect(parsePairs('Authorization: Bearer a:b\n\nX-Id: 1\nsin separador', [': '])).toEqual({ Authorization: 'Bearer a:b', 'X-Id': '1' })
    expect(parsePairs('A=1\nB = dos\n=vacio', ['='])).toEqual({ A: '1', B: 'dos' })
  })
  it('divide argumentos respetando comillas', () => {
    expect(splitArgs('-y @scope/pkg --flag "con espacios" \'otro valor\'')).toEqual(['-y', '@scope/pkg', '--flag', 'con espacios', 'otro valor'])
    expect(splitArgs('')).toEqual([])
    expect(splitArgs('a "" b')).toEqual(['a', '', 'b'])
  })
  it('oculta solo lo que parece un secreto', () => {
    expect(mask('Authorization', 'Bearer abcdef', false)).toMatch(/^•+$/)
    expect(mask('Authorization', 'Bearer abcdef', true)).toBe('Bearer abcdef')
    expect(mask('Content-Type', 'json', false)).toBe('json')
  })
  it('qué agentes aún no tienen el servidor', () => {
    const a = server({ name: 'n', agent: 'claude' })
    expect(agentsMissing(a, [a], ['claude', 'opencode'])).toEqual(['opencode'])
    expect(agentsMissing(a, [a, server({ name: 'n', agent: 'opencode' })], ['claude', 'opencode'])).toEqual([])
    expect(agentsMissing(a, [a, server({ name: 'n', agent: 'opencode', scope: 'project' })], ['claude', 'opencode'])).toEqual(['opencode'])   // otro alcance
  })
  it('convierte un servidor para copiarlo a otro agente', () => {
    const local = server({ kind: 'local', config: { type: 'local', command: ['npx', '-y', 'srv'], environment: { A: '1' } } })
    expect(specFromServer(local)).toMatchObject({ kind: 'local', command: 'npx', args: ['-y', 'srv'], env: { A: '1' } })
    const remote = server({ config: { type: 'http', url: 'https://x', headers: { H: 'v' } } })
    expect(specFromServer(remote)).toMatchObject({ kind: 'remote', url: 'https://x', headers: { H: 'v' } })
  })
  it('copiar un remoto conserva SSE y lee httpUrl o serverUrl', () => {
    expect(specFromServer(server({ agent: 'claude', config: { type: 'sse', url: 'https://x/sse' } }))).toMatchObject({ url: 'https://x/sse', transport: 'sse' })
    expect(specFromServer(server({ agent: 'gemini', config: { url: 'https://g/sse' } })).transport).toBe('sse')
    expect(specFromServer(server({ agent: 'gemini', config: { httpUrl: 'https://g/mcp' } }))).toMatchObject({ url: 'https://g/mcp' })
    expect(specFromServer(server({ agent: 'gemini', config: { httpUrl: 'https://g/mcp' } })).transport).toBeUndefined()
    expect(specFromServer(server({ agent: 'agy', config: { serverUrl: 'https://a/mcp' } })).url).toBe('https://a/mcp')
  })
})
