import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addDisabled, asServer, findDisabled, listDisabled, removeDisabled, useDisabledStorage, useDisabledVault } from '../../../../src/main/services/mcp/disabled'
import { enableServer, specFromConfig, transportOf, updateServer } from '../../../../src/main/services/mcp/manage'
import { listServers } from '../../../../src/main/services/mcp/mcp'
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
  it('transporte: type "sse", o url sin tipo en Gemini CLI y Qwen Code', () => {
    expect(specFromConfig('a', { type: 'sse', url: 'https://x/sse' }).transport).toBe('sse')
    expect(specFromConfig('b', { type: 'http', url: 'https://x/mcp' }).transport).toBeUndefined()
    expect(transportOf({ url: 'https://x/sse' }, 'gemini')).toBe('sse')
    expect(transportOf({ httpUrl: 'https://x/mcp' }, 'gemini')).toBe('http')
    expect(transportOf({ url: 'https://x/mcp' }, 'cursor')).toBe('http')
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
  it('guarda env y cabeceras cifrados; si no se pueden abrir, queda bloqueado y no se activa', async () => {
    let saved: unknown = []
    useDisabledStorage({ get: () => saved, set: (v) => { saved = v } })
    let works = true
    useDisabledVault({ seal: (t) => `s:${Buffer.from(t).toString('base64')}`, open: (s) => (works ? Buffer.from(s.slice(2), 'base64').toString() : null) })
    try {
      addDisabled({ agent: 'claude', scope: 'global', name: 'api', project: null, spec: { name: 'api', kind: 'remote', url: 'https://x/mcp', headers: { Authorization: 'Bearer secreto' } } })
      addDisabled({ agent: 'claude', scope: 'global', name: 'sin', project: null, spec: { name: 'sin', kind: 'local', command: 'npx' } })
      expect(JSON.stringify(saved)).not.toContain('secreto')
      expect((saved as Array<{ sealed?: string }>).map((e) => !!e.sealed)).toEqual([true, false])          // sin secretos, nada que cifrar
      expect(findDisabled({ agent: 'claude', scope: 'global', name: 'api' }, null)?.spec.headers).toEqual({ Authorization: 'Bearer secreto' })
      works = false
      const locked = findDisabled({ agent: 'claude', scope: 'global', name: 'api' }, null)!
      expect(locked.locked).toBe(true)
      expect(locked.spec.headers).toBeUndefined()
      expect((await enableServer(asServer(locked), null)).ok).toBe(false)
      removeDisabled({ agent: 'claude', scope: 'global', name: 'sin', project: null })        // reescribir la lista no pierde lo cifrado
      works = true
      expect(findDisabled({ agent: 'claude', scope: 'global', name: 'api' }, null)?.spec.headers).toEqual({ Authorization: 'Bearer secreto' })
    } finally { useDisabledVault({ seal: () => null, open: () => null }) }
  })
})

describe('editar un servidor de .mcp.json', () => {
  it('lo cambia en su sitio, conservando el resto del archivo', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tutti-edit-'))
    writeFileSync(join(root, '.mcp.json'), JSON.stringify({ otro: 1, mcpServers: { api: { type: 'http', url: 'https://a/mcp' }, fs: { type: 'stdio', command: 'x' } } }))
    const old = listServers(root).find((x) => x.agent === 'claude' && x.scope === 'shared' && x.name === 'api')!
    const r = await updateServer(old, { name: 'api', kind: 'remote', url: 'https://b/sse', transport: 'sse', headers: { A: 'b' } }, root)
    expect(r.ok).toBe(true)
    const data = JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8'))
    expect(data.otro).toBe(1)
    expect(Object.keys(data.mcpServers)).toEqual(['api', 'fs'])                 // mismo sitio: no se quita y se vuelve a añadir
    expect(data.mcpServers.api).toEqual({ type: 'sse', url: 'https://b/sse', headers: { A: 'b' } })
  })
  it('no escribe nada si la especificación no es válida', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tutti-edit-'))
    writeFileSync(join(root, '.mcp.json'), JSON.stringify({ mcpServers: { api: { type: 'http', url: 'https://a/mcp' } } }))
    const old = listServers(root).find((x) => x.agent === 'claude' && x.scope === 'shared')!
    expect((await updateServer(old, { name: 'api', kind: 'remote', url: 'ftp://no' }, root)).ok).toBe(false)
    expect(JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers.api.url).toBe('https://a/mcp')
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
  it('remoto: un 401 con OAuth pide iniciar sesión desde el agente', async () => {
    const server = createServer((_req, res) => { res.writeHead(401, { 'www-authenticate': 'Bearer resource_metadata="http://x/.well-known/oauth-protected-resource"' }); res.end() })
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
    const r = await probeSpec({ name: 's', kind: 'remote', url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }, 5000)
    server.close()
    expect(r.ok).toBe(false)
    expect(r.message).toContain('OAuth')
  })
  it('local: arranca en el proyecto y expande ${VAR} y ${VAR:-defecto}', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutti-probe-'))
    writeFileSync(join(dir, 'srv.js'), `const TOOLS = [{ name: process.cwd() + '|' + process.env.K + '|' + process.argv[2] }]; const reply = ${reply.toString()}; let b=''; process.stdin.on('data', d => { b += d; let i; while ((i = b.indexOf('\\n')) >= 0) { const m = JSON.parse(b.slice(0, i)); b = b.slice(i + 1); const r = reply(m); if (r) console.log(JSON.stringify(r)) } })`)
    process.env.TUTTI_PROBE_TEST = 'de-entorno'
    try {
      const r = await probeSpec({ name: 's', kind: 'local', command: process.execPath, args: ['srv.js', '${TUTTI_NO_DEFINIDA:-defecto}'], env: { K: '${TUTTI_PROBE_TEST}' } }, 10_000, dir)
      expect(r.ok).toBe(true)
      expect(r.tools[0].name).toBe(`${realpathSync(dir)}|de-entorno|defecto`)
    } finally { delete process.env.TUTTI_PROBE_TEST }
  })
  const sseServer = (opts: { postStatus?: number }): Promise<{ url: string; close: () => void }> => {
    let stream: import('node:http').ServerResponse | null = null
    const server = createServer((req, res) => {
      if (req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.write('event: endpoint\ndata: /messages?session=1\n\n')
        stream = res
        return
      }
      if (req.url === '/sse' && opts.postStatus) { res.writeHead(opts.postStatus); res.end(); return }
      let body = ''
      req.on('data', (d) => { body += d })
      req.on('end', () => {
        res.writeHead(202); res.end()
        const r = reply(JSON.parse(body) as { id?: number; method?: string })
        if (r) stream?.write(`event: message\ndata: ${JSON.stringify(r)}\n\n`)
      })
    })
    return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/sse`,
      close: () => { server.closeAllConnections(); server.close() }
    })))
  }
  it('remoto SSE (transporte antiguo): endpoint y respuestas por el flujo', async () => {
    const s = await sseServer({})
    const r = await probeSpec({ name: 's', kind: 'remote', url: s.url, transport: 'sse' }, 5000)
    s.close()
    expect(r.ok).toBe(true)
    expect(r.tools.map((t) => t.name)).toEqual(['buscar', 'leer'])
  })
  it('remoto: si el POST da 405, se prueba por SSE', async () => {
    const s = await sseServer({ postStatus: 405 })
    const r = await probeSpec({ name: 's', kind: 'remote', url: s.url }, 5000)
    s.close()
    expect(r.ok).toBe(true)
    expect(r.tools).toHaveLength(2)
  })
})
