/**
 * Probar un servidor MCP: conectar como lo haría un agente (initialize + tools/list) y devolver sus herramientas.
 * Local: arranca el comando (desde el proyecto) y habla JSON-RPC por stdin/stdout. Remoto: Streamable HTTP (respuesta JSON o SSE) o,
 * si es un SSE o el servidor no acepta el POST, el transporte SSE antiguo.
 */
import { spawn } from 'node:child_process'
import type { McpProbe, McpSpec } from '../../../shared/types'
import { tm } from '../../utils/i18n'
import { extendedPath } from '../../utils/shellpath'

type Tool = { name: string; description: string }
/** La versión que se pide; el servidor contesta con la suya si no la conoce, y esa es la que se usa después. */
const PROTOCOL = '2025-11-25'
const INIT = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'tutti', version: '1.0.0' } } }
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
const versionOf = (init: Rpc): string => String((init.result as { protocolVersion?: unknown } | undefined)?.protocolVersion ?? PROTOCOL)

const VAR = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g
/** `${VAR}` y `${VAR:-por defecto}`, como los expande Claude Code en `.mcp.json` (y el lanzador de Tutti). */
export const expandVars = (s: string, env: NodeJS.ProcessEnv = process.env): string => s.replace(VAR, (_, k: string, d?: string) => env[k] ?? d ?? '')
const expandMap = (m: Record<string, string> | undefined): Record<string, string> | undefined => m && Object.fromEntries(Object.entries(m).map(([k, v]) => [k, expandVars(v)]))

/** El servidor con las variables ya expandidas, tal como lo arrancaría el agente. */
export function expandSpec(spec: McpSpec): McpSpec {
  return {
    ...spec,
    ...(spec.url !== undefined ? { url: expandVars(spec.url) } : {}),
    ...(spec.command !== undefined ? { command: expandVars(spec.command) } : {}),
    ...(spec.args ? { args: spec.args.map((a) => expandVars(a)) } : {}),
    ...(spec.env ? { env: expandMap(spec.env) } : {}),
    ...(spec.headers ? { headers: expandMap(spec.headers) } : {})
  }
}

function probeLocal(spec: McpSpec, timeout: number, cwd?: string): Promise<Tool[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.command!, spec.args ?? [], { cwd, env: { ...process.env, PATH: extendedPath(), ...spec.env }, stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32', windowsHide: true })
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

/** Los eventos de un flujo SSE; al dejar de leerlo se cierra. */
async function* sseEvents(res: Response): AsyncGenerator<{ event: string; data: string }> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      buf += decoder.decode(value, { stream: true })
      const events = buf.split(/\r?\n\r?\n/)
      buf = events.pop() ?? ''
      for (const ev of events) {
        const lines = ev.split(/\r?\n/)
        const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim() || 'message'
        yield { event, data: lines.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n') }
      }
    }
  } finally { void reader.cancel().catch(() => undefined) }
}

/** El mensaje con `id` de entre los eventos `message` de un flujo SSE. */
async function rpcIn(events: AsyncGenerator<{ event: string; data: string }>, id: number): Promise<Rpc> {
  for (;;) {
    const { done, value } = await events.next()
    if (done) throw new Error(tm('m.mcp.probeNoReply'))
    if (value.event !== 'message') continue
    try { const msg = JSON.parse(value.data) as Rpc; if (msg.id === id) return msg } catch { /* no es JSON */ }
  }
}

/** Primer mensaje con `id` de una respuesta HTTP: JSON simple o un flujo SSE (`data:` por evento). */
async function rpcFrom(res: Response, id: number): Promise<Rpc> {
  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream')) return (await res.json()) as Rpc
  const events = sseEvents(res)
  try { return await rpcIn(events, id) } finally { await events.return(undefined) }
}

/**
 * Un 401/403 corta la prueba. Si el servidor anuncia OAuth (o pide un Bearer que no se le ha dado) es que hay que iniciar sesión desde
 * el agente; si no, lo más probable es una cabecera que falta o está mal.
 */
function checkAuth(res: Response, spec: McpSpec): void {
  if (res.status !== 401 && res.status !== 403) return
  const challenge = res.headers.get('www-authenticate') ?? ''
  const hasAuth = Object.keys(spec.headers ?? {}).some((k) => k.toLowerCase() === 'authorization')
  const oauth = res.status === 401 && (/resource_metadata/i.test(challenge) || (/^\s*bearer/i.test(challenge) && !hasAuth))
  throw new Error(tm(oauth ? 'm.mcp.probeOauth' : 'm.mcp.probeAuth', { status: String(res.status) }))
}

/** SSE (el transporte antiguo): un GET abre el flujo, su evento `endpoint` dice a dónde mandar los mensajes y las respuestas llegan por él. */
async function probeSse(spec: McpSpec, signal: AbortSignal): Promise<Tool[]> {
  const res = await fetch(spec.url!, { headers: { Accept: 'text/event-stream', ...spec.headers }, signal })
  checkAuth(res, spec)
  if (!res.ok) throw new Error(tm('m.mcp.probeHttp', { status: String(res.status) }))
  const events = sseEvents(res)
  try {
    let endpoint = ''
    while (!endpoint) {
      const { done, value } = await events.next()
      if (done) throw new Error(tm('m.mcp.probeNoReply'))
      if (value.event === 'endpoint') endpoint = new URL(value.data, spec.url).href
    }
    const post = async (body: unknown): Promise<void> => {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...spec.headers }, body: JSON.stringify(body), signal })
      void r.body?.cancel()
      if (!r.ok) throw new Error(tm('m.mcp.probeHttp', { status: String(r.status) }))
    }
    await post(INIT)
    const init = await rpcIn(events, 1)
    if (init.error) throw new Error(init.error.message ?? 'error')
    await post(INITIALIZED)
    await post(LIST)
    return listed(await rpcIn(events, 2))
  } finally { await events.return(undefined) }
}

/** Respuestas con las que un servidor solo SSE rechaza el POST de Streamable HTTP: entonces se prueba por SSE. */
const SSE_ONLY = [400, 404, 405]

async function probeRemote(spec: McpSpec, timeout: number): Promise<Tool[]> {
  const signal = AbortSignal.timeout(timeout)
  if (spec.transport === 'sse') return probeSse(spec, signal)
  const base = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...spec.headers }
  const post = (body: unknown, extra: Record<string, string> = {}): Promise<Response> => fetch(spec.url!, { method: 'POST', headers: { ...base, ...extra }, body: JSON.stringify(body), signal })
  const first = await post(INIT)
  checkAuth(first, spec)
  if (SSE_ONLY.includes(first.status)) { void first.body?.cancel(); return probeSse(spec, signal) }
  if (!first.ok) throw new Error(tm('m.mcp.probeHttp', { status: String(first.status) }))
  const init = await rpcFrom(first, 1)
  if (init.error) throw new Error(init.error.message ?? 'error')
  const session = first.headers.get('mcp-session-id')
  const extra: Record<string, string> = { 'mcp-protocol-version': versionOf(init), ...(session ? { 'mcp-session-id': session } : {}) }
  await post(INITIALIZED, extra).then((r) => r.body?.cancel())
  const list = await post(LIST, extra)
  if (!list.ok) throw new Error(tm('m.mcp.probeHttp', { status: String(list.status) }))
  return listed(await rpcFrom(list, 2))
}

/** Prueba `spec` con las variables expandidas; los locales arrancan en `cwd` (la raíz del proyecto, como lo haría el agente). */
export async function probeSpec(spec: McpSpec, timeout = 20_000, cwd?: string): Promise<McpProbe> {
  const t0 = Date.now()
  const s = expandSpec(spec)
  try {
    const tools = await (s.kind === 'remote' ? probeRemote(s, timeout) : probeLocal(s, timeout, cwd))
    return { ok: true, message: tm('m.mcp.probeOk', { count: String(tools.length) }), tools, ms: Date.now() - t0 }
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    return { ok: false, message: name === 'TimeoutError' ? tm('m.mcp.probeTimeout') : e instanceof Error ? e.message : String(e), tools: [], ms: Date.now() - t0 }
  }
}
