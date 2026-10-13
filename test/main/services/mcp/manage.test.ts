import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addDisabled, asServer, findDisabled, listDisabled, removeDisabled, useDisabledStorage } from '../../../../src/main/services/mcp/disabled'
import { specFromConfig } from '../../../../src/main/services/mcp/manage'
import { probeSpec } from '../../../../src/main/services/mcp/probe'

const TOOLS = [{ name: 'buscar', description: 'Busca cosas\nmás texto' }, { name: 'leer', description: 'Lee' }]
const reply = (msg: { id?: number; method?: string }): unknown =>
  msg.method === 'initialize' ? { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'f', version: '1' } } }
    : msg.method === 'tools/list' ? { jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } } : null

describe('especificación desde la configuración', () => {
  it('Claude, OpenCode y remotos', () => {
    expect(specFromConfig('a', { command: 'npx', args: ['-y', 's'], env: { K: 'v' } })).toEqual({ name: 'a', kind: 'local', command: 'npx', args: ['-y', 's'], env: { K: 'v' } })
    expect(specFromConfig('b', { type: 'local', command: ['uvx', 's'], environment: { T: '1' } })).toMatchObject({ command: 'uvx', args: ['s'], env: { T: '1' } })
    expect(specFromConfig('c', { httpUrl: 'https://x/mcp', headers: { A: 'b' } })).toMatchObject({ kind: 'remote', url: 'https://x/mcp', headers: { A: 'b' } })
  })
})

describe('desactivados', () => {
  it('se apuntan por agente, alcance y proyecto', () => {
    let saved: unknown = []
    useDisabledStorage({ get: () => saved, set: (v) => { saved = v } })
    const spec = { name: 'x', kind: 'local' as const, command: 'npx', args: ['-y', 'x'] }
    addDisabled({ agent: 'claude', scope: 'shared', name: 'x', project: '/p', spec })
    addDisabled({ agent: 'claude', scope: 'global', name: 'g', project: null, spec: { ...spec, name: 'g' } })
    expect(listDisabled('/p').map((e) => e.name).sort()).toEqual(['g', 'x'])
    expect(listDisabled('/otro').map((e) => e.name)).toEqual(['g'])
    expect(findDisabled({ agent: 'claude', scope: 'shared', name: 'X' }, '/p')?.spec.command).toBe('npx')
    expect(asServer(findDisabled({ agent: 'claude', scope: 'shared', name: 'x' }, '/p')!)).toMatchObject({ disabled: true, target: 'npx -y x', kind: 'local' })
    removeDisabled({ agent: 'claude', scope: 'shared', name: 'x', project: '/p' })
    expect(listDisabled('/p').map((e) => e.name)).toEqual(['g'])
  })
})

describe('probar', () => {
  it('local: habla JSON-RPC por stdio', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutti-probe-'))
    const script = join(dir, 'srv.js')
    writeFileSync(script, `const TOOLS = ${JSON.stringify(TOOLS)}; const reply = ${reply.toString()}; let b=''; process.stdin.on('data', d => { b += d; let i; while ((i = b.indexOf('\\n')) >= 0) { const m = JSON.parse(b.slice(0, i)); b = b.slice(i + 1); const r = reply(m); if (r) console.log(JSON.stringify(r)) } })`)
    const r = await probeSpec({ name: 's', kind: 'local', command: process.execPath, args: [script] }, 10_000)
    expect(r.ok).toBe(true)
    expect(r.tools).toEqual([{ name: 'buscar', description: 'Busca cosas' }, { name: 'leer', description: 'Lee' }])
  })
  it('local: un comando que no existe falla con mensaje', async () => {
    const r = await probeSpec({ name: 's', kind: 'local', command: 'tutti-no-existe-xyz' }, 5000)
    expect(r.ok).toBe(false)
    expect(r.message).toBeTruthy()
  })
  it('remoto: JSON y SSE, con sesión', async () => {
    const seen: Array<string | undefined> = []
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (d) => { body += d })
      req.on('end', () => {
        const msg = JSON.parse(body) as { id?: number; method?: string }
        seen.push(req.headers['mcp-session-id'] as string | undefined)
        if (msg.method === 'notifications/initialized') { res.writeHead(202); res.end(); return }
        if (msg.method === 'initialize') { res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'S1' }); res.end(JSON.stringify(reply(msg))); return }
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.write(`event: message\ndata: ${JSON.stringify(reply(msg))}\n\n`)      // sin cerrar: el flujo sigue abierto
      })
    })
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`
    const r = await probeSpec({ name: 's', kind: 'remote', url }, 5000)
    server.closeAllConnections(); server.close()
    expect(r.ok).toBe(true)
    expect(r.tools.map((t) => t.name)).toEqual(['buscar', 'leer'])
    expect(seen.slice(1)).toEqual(['S1', 'S1'])
  })
  it('remoto: 401 pide autenticación', async () => {
    const server = createServer((_req, res) => { res.writeHead(401); res.end() })
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
    const r = await probeSpec({ name: 's', kind: 'remote', url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }, 5000)
    server.close()
    expect(r.ok).toBe(false)
    expect(r.message).toContain('401')
  })
})
