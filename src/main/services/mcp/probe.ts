/**
 * Probar un servidor MCP: conectar como lo haría un agente (initialize + tools/list) y devolver sus herramientas.
 * Local: arranca el comando y habla JSON-RPC por stdin/stdout. Remoto: HTTP (Streamable HTTP, con respuesta JSON o SSE).
 */
import { spawn } from 'node:child_process'
import type { McpProbe, McpSpec } from '../../../shared/types'
import { tm } from '../../utils/i18n'
import { extendedPath } from '../../utils/shellpath'

type Tool = { name: string; description: string }
const INIT = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'tutti', version: '1.0.0' } } }
const INITIALIZED = { jsonrpc: '2.0', method: 'notifications/initialized' }
const LIST = { jsonrpc: '2.0', id: 2, method: 'tools/list' }
const NO_METHOD = -32601

const toolsOf = (result: unknown): Tool[] => {
  const list = (result as { tools?: unknown[] } | undefined)?.tools
  return Array.isArray(list) ? list.map((t) => ({ name: String((t as Tool).name ?? ''), description: String((t as Tool).description ?? '').split('\n')[0] })).filter((t) => t.name) : []
}
type Rpc = { id?: number; result?: unknown; error?: { code?: number; message?: string } }
/** Respuesta de tools/list: un servidor sin herramientas puede contestar «método no encontrado». */
const listed = (msg: Rpc): Tool[] => {
  if (msg.error) { if (msg.error.code === NO_METHOD) return []; throw new Error(msg.error.message ?? 'error') }
  return toolsOf(msg.result)
}

function probeLocal(spec: McpSpec, timeout: number): Promise<Tool[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.command!, spec.args ?? [], { env: { ...process.env, PATH: extendedPath(), ...spec.env }, stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32', windowsHide: true })
    let out = '', err = '', done = false
    const finish = (fn: () => void): void => { if (done) return; done = true; clearTimeout(timer); child.kill(); fn() }
    const timer = setTimeout(() => finish(() => reject(new Error(tm('m.mcp.probeTimeout')))), timeout)
    const send = (m: unknown): void => { try { child.stdin.write(JSON.stringify(m) + '\n') } catch { /* el proceso ya salió */ } }
    child.stdin.on('error', () => undefined)
    child.on('error', (e) => finish(() => reject(e)))
    child.on('exit', (code) => finish(() => reject(new Error(err.trim().split('\n').slice(-3).join('\n') || tm('m.mcp.probeExit', { code: String(code) })))))
    child.stderr.on('data', (d) => { err = (err + d).slice(-4000) })
    child.stdout.on('data', (d) => {
      out += d
      for (let i = out.indexOf('\n'); i >= 0; i = out.indexOf('\n')) {
        const line = out.slice(0, i).trim()
        out = out.slice(i + 1)
        let msg: Rpc
        try { msg = JSON.parse(line) as Rpc } catch { continue }
        if (msg.id === 1) {
          if (msg.error) return finish(() => reject(new Error(msg.error?.message ?? 'error')))
          send(INITIALIZED); send(LIST)
        } else if (msg.id === 2) finish(() => { try { resolve(listed(msg)) } catch (e) { reject(e) } })
      }
    })
    send(INIT)
  })
}

/** Primer mensaje con `id` de una respuesta HTTP: JSON simple o un flujo SSE (`data:` por evento). */
async function rpcFrom(res: Response, id: number): Promise<Rpc> {
  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream')) return (await res.json()) as Rpc
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) throw new Error(tm('m.mcp.probeNoReply'))
    buf += decoder.decode(value, { stream: true })
    const events = buf.split(/\r?\n\r?\n/)
    buf = events.pop() ?? ''
    for (const ev of events) {
      const data = ev.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')
      try { const msg = JSON.parse(data) as Rpc; if (msg.id === id) { void reader.cancel(); return msg } } catch { /* no es JSON */ }
    }
  }
}

async function probeRemote(spec: McpSpec, timeout: number): Promise<Tool[]> {
  const signal = AbortSignal.timeout(timeout)
  const base = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...spec.headers }
  const post = (body: unknown, extra: Record<string, string> = {}): Promise<Response> => fetch(spec.url!, { method: 'POST', headers: { ...base, ...extra }, body: JSON.stringify(body), signal })
  const first = await post(INIT)
  if (first.status === 401 || first.status === 403) throw new Error(tm('m.mcp.probeAuth', { status: String(first.status) }))
  if (!first.ok) throw new Error(tm('m.mcp.probeHttp', { status: String(first.status) }))
  const init = await rpcFrom(first, 1)
  if (init.error) throw new Error(init.error.message ?? 'error')
  const session = first.headers.get('mcp-session-id')
  const extra: Record<string, string> = { 'mcp-protocol-version': '2025-03-26', ...(session ? { 'mcp-session-id': session } : {}) }
  await post(INITIALIZED, extra).then((r) => r.body?.cancel())
  const list = await post(LIST, extra)
  if (!list.ok) throw new Error(tm('m.mcp.probeHttp', { status: String(list.status) }))
  return listed(await rpcFrom(list, 2))
}

export async function probeSpec(spec: McpSpec, timeout = 20_000): Promise<McpProbe> {
  const t0 = Date.now()
  try {
    const tools = await (spec.kind === 'remote' ? probeRemote(spec, timeout) : probeLocal(spec, timeout))
    return { ok: true, message: tm('m.mcp.probeOk', { count: String(tools.length) }), tools, ms: Date.now() - t0 }
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    return { ok: false, message: name === 'TimeoutError' ? tm('m.mcp.probeTimeout') : e instanceof Error ? e.message : String(e), tools: [], ms: Date.now() - t0 }
  }
}
