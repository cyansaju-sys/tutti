/**
 * Servidores MCP de cada agente: leerlos, añadirlos y quitarlos.
 *
 * Se añaden con el propio comando de cada agente (`claude mcp ...`, `opencode mcp ...`) para respetar su formato;
 * la lectura es directa de sus archivos de configuración.
 */
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { McpAgent, McpResult, McpScope, McpServer, McpSpec } from '../../../shared/types'
import { tm } from '../../utils/i18n'
import { extendedPath } from '../../utils/shellpath'
import { codexProjectConfig, mirrorToAgy, mirrorToCodex, PLUGINS_DIR, resolveEntry, sharedServers, withoutCodexServer } from './mirror'

export const SUPPORTED: Record<McpAgent, string> = { claude: 'Claude Code', opencode: 'OpenCode', gemini: 'Gemini CLI', codex: 'Codex', agy: 'Antigravity', cursor: 'Cursor Agent', qwen: 'Qwen Code' }
export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

type Entry = Record<string, unknown>

function readJson(path: string): Record<string, unknown> {
  try { return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown> } catch { return {} }
}
const isObject = (v: unknown): v is Entry => typeof v === 'object' && v !== null && !Array.isArray(v)

/** ('remote' | 'local', URL o comando) de una entrada de configuración. */
export function describe(entry: Entry): { kind: 'remote' | 'local'; target: string } {
  let command: string | undefined
  if (Array.isArray(entry.command)) command = entry.command.map(String).join(' ')
  else if (entry.command) command = [String(entry.command), ...((entry.args as unknown[]) ?? []).map(String)].join(' ')
  if (entry.url || entry.serverUrl || entry.httpUrl || ['http', 'sse', 'remote'].includes(String(entry.type))) return { kind: 'remote', target: String(entry.url ?? entry.serverUrl ?? entry.httpUrl ?? '') }
  return { kind: 'local', target: command ?? '' }
}

export const geminiGlobalConfig = (): string => join(homedir(), '.gemini', 'settings.json')
export const agyGlobalConfig = (): string => join(homedir(), '.gemini', 'config', 'mcp_config.json')
/** `mcp_config.json` de los plugins del proyecto: los de `.agents/plugins/` y los de Tutti en `.tutti/plugins/` (ver mirror.ts). */
const agyProjectFiles = (project: string): string[] => [join(project, '.agents', 'plugins'), join(project, PLUGINS_DIR)].flatMap((root) => {
  try {
    return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(root, d.name, 'mcp_config.json')).filter((f) => existsSync(f))
  } catch { return [] }
})
export const codexConfig = (): string => join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'config.toml')

/** Servidores de `[mcp_servers.<nombre>]` en un config.toml de Codex (solo lo que hace falta: command, args, url, env, cabeceras). */
export function codexEntries(file: string): Array<[string, Entry]> {
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch { return [] }
  const out = new Map<string, Entry>()
  let current: Entry | null = null
  const value = (raw: string): unknown => {
    const v = raw.trim()
    if (v.startsWith('[')) return [...v.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2])
    const q = /^"((?:[^"\\]|\\.)*)"|^'([^']*)'/.exec(v)
    return q ? (q[1] ?? q[2]) : v
  }
  for (const line of text.split(/\r?\n/)) {
    const head = /^\s*\[\s*mcp_servers\.("([^"]+)"|[^.\]\s]+)(\.[A-Za-z_]+)?\s*\]\s*$/.exec(line)
    if (head) {
      const name = head[2] ?? head[1]
      if (!out.has(name)) out.set(name, {})
      const sub = head[3]?.slice(1)
      current = sub ? ((out.get(name)![sub === 'http_headers' ? 'headers' : sub] ??= {}) as Entry) : out.get(name)!
      continue
    }
    if (/^\s*\[/.test(line)) { current = null; continue }
    const kv = /^\s*([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*$/.exec(line)
    if (kv && current) current[kv[1]] = value(kv[2])
  }
  return [...out.entries()]
}

export const qwenGlobalConfig = (): string => join(homedir(), '.qwen', 'settings.json')
export const cursorGlobalConfig = (): string => join(homedir(), '.cursor', 'mcp.json')
/** Archivo de MCP de un agente que lo guarda en `mcpServers` de un JSON (Cursor Agent y Qwen Code, además de Gemini). */
export const mcpServersFile = (agent: 'cursor' | 'qwen' | 'gemini', scope: McpScope, project: string | null): string =>
  scope === 'global' || !project
    ? { cursor: cursorGlobalConfig(), qwen: qwenGlobalConfig(), gemini: geminiGlobalConfig() }[agent]
    : join(project, ...{ cursor: ['.cursor', 'mcp.json'], qwen: ['.qwen', 'settings.json'], gemini: ['.gemini', 'settings.json'] }[agent])

export const opencodeGlobalConfig = (): string => join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode', 'opencode.json')

/**
 * Servidores de un opencode.json. La 2.x los guarda en `mcp.servers.<nombre>` y la 1.x directamente en `mcp.<nombre>`
 * (la 2.x lee las dos formas): se aceptan ambas.
 */
export function opencodeEntries(file: string): Array<[string, Entry, 'servers' | 'flat']> {
  const mcp = readJson(file).mcp
  if (!isObject(mcp)) return []
  const out: Array<[string, Entry, 'servers' | 'flat']> = []
  for (const [name, value] of Object.entries(mcp)) {
    if (name === 'servers' && isObject(value)) {
      for (const [n, e] of Object.entries(value)) out.push([n, isObject(e) ? e : {}, 'servers'])
    } else if (isObject(value) && (value.type || value.url || value.command)) out.push([name, value, 'flat'])
  }
  return out
}

/** ¿Son la misma carpeta? Sigue los enlaces simbólicos: Claude guarda la ruta real y el proyecto puede abrirse por un enlace. */
export function samePath(a: string, b: string): boolean {
  const real = (p: string): string => {
    try { return realpathSync.native(p) } catch { return resolve(p) }
  }
  const [x, y] = [real(a), real(b)]
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y
}

export function listServers(project: string | null): McpServer[] {
  const servers: McpServer[] = []
  const add = (name: string, agent: McpAgent, scope: McpScope, entry: Entry, source: string): void => {
    servers.push({ name, agent, scope, ...describe(entry), config: entry, source })
  }

  const claudeFile = join(homedir(), '.claude.json')
  const claude = readJson(claudeFile)
  const scopes: Array<[McpScope, Entry, string]> = [['global', isObject(claude.mcpServers) ? claude.mcpServers : {}, claudeFile]]
  if (project) {
    const projects = isObject(claude.projects) ? claude.projects : {}
    for (const [key, data] of Object.entries(projects)) {
      if (samePath(key, project) && isObject(data) && isObject(data.mcpServers)) scopes.push(['project', data.mcpServers, claudeFile])
    }
    const shared = join(project, '.mcp.json')
    const sharedServers = readJson(shared).mcpServers
    scopes.push(['shared', isObject(sharedServers) ? sharedServers : {}, shared])
  }
  for (const [scope, entries, source] of scopes) for (const [name, entry] of Object.entries(entries)) add(name, 'claude', scope, isObject(entry) ? entry : {}, source)

  const files: Array<[McpScope, string]> = [['global', opencodeGlobalConfig()]]
  if (project) files.push(['project', join(project, 'opencode.json')])
  for (const [scope, file] of files) for (const [name, entry] of opencodeEntries(file)) add(name, 'opencode', scope, entry, file)

  for (const [name, entry] of Object.entries(isObject(readJson(geminiGlobalConfig()).mcpServers) ? (readJson(geminiGlobalConfig()).mcpServers as Entry) : {})) add(name, 'gemini', 'global', isObject(entry) ? entry : {}, geminiGlobalConfig())
  if (project) {
    const file = join(project, '.gemini', 'settings.json')
    const found = readJson(file).mcpServers
    for (const [name, entry] of Object.entries(isObject(found) ? found : {})) add(name, 'gemini', 'project', isObject(entry) ? entry : {}, file)
  }
  for (const agent of ['qwen', 'cursor'] as const) {
    for (const scope of project ? (['global', 'project'] as const) : (['global'] as const)) {
      const file = mcpServersFile(agent, scope, project)
      const found = readJson(file).mcpServers
      for (const [name, entry] of Object.entries(isObject(found) ? found : {})) add(name, agent, scope, isObject(entry) ? entry : {}, file)
    }
  }
  const agyServers = readJson(agyGlobalConfig()).mcpServers
  for (const [name, entry] of Object.entries(isObject(agyServers) ? agyServers : {})) add(name, 'agy', 'global', isObject(entry) ? entry : {}, agyGlobalConfig())
  const shared = project ? sharedServers(project) : {}
  for (const file of project ? agyProjectFiles(project) : []) {
    const found = readJson(file).mcpServers
    for (const [name, entry] of Object.entries(isObject(found) ? found : {})) add(name, 'agy', 'project', resolveEntry(isObject(entry) ? entry : {}, shared), file)
  }
  for (const [name, entry] of codexEntries(codexConfig())) add(name, 'codex', 'global', entry, codexConfig())
  if (project) for (const [name, entry] of codexEntries(codexProjectConfig(project))) add(name, 'codex', 'project', resolveEntry(entry, shared), codexProjectConfig(project))
  return servers
}

/** Mensaje de error si `spec` no es válido; null si está bien. */
export function validate(spec: McpSpec): string | null {
  if (!NAME_RE.test(spec.name ?? '')) return tm('m.mcp.nameRule')
  if (spec.kind === 'remote') return /^https?:\/\/\S+$/.test(spec.url ?? '') ? null : tm('m.mcp.urlRule')
  return (spec.command ?? '').trim() ? null : tm('m.mcp.needCommand')
}

/** Comando (argv) que añade el servidor con la CLI del agente. */
export function buildAddArgv(agent: McpAgent, spec: McpSpec, scope: McpScope): string[] {
  const remote = spec.kind === 'remote'
  const headers = Object.entries(spec.headers ?? {})
  const env = Object.entries(spec.env ?? {})
  const args = spec.args ?? []
  if (agent === 'claude') {
    const cliScope = { global: 'user', project: 'local', shared: 'project' }[scope]
    const argv = ['claude', 'mcp', 'add', spec.name]               // el nombre va antes: -H y -e aceptan varios valores
    if (remote) {
      argv.push(spec.url!, '--transport', 'http', '-s', cliScope)
      for (const [k, v] of headers) argv.push('-H', `${k}: ${v}`)
    } else {
      argv.push('-s', cliScope)
      for (const [k, v] of env) argv.push('-e', `${k}=${v}`)
      argv.push('--', spec.command!, ...args)
    }
    return argv
  }
  if (agent === 'gemini' || agent === 'qwen') {                    // Qwen Code es un derivado de Gemini CLI: mismos argumentos
    const argv = [agent, 'mcp', 'add', '-s', scope === 'global' ? 'user' : 'project']
    if (remote) {
      argv.push('-t', 'http')
      for (const [k, v] of headers) argv.push('-H', `${k}: ${v}`)
      argv.push(spec.name, spec.url!)
    } else {
      for (const [k, v] of env) argv.push('-e', `${k}=${v}`)
      argv.push(spec.name, spec.command!, ...args)
    }
    return argv
  }
  if (agent === 'cursor') throw new Error('Cursor Agent no tiene `mcp add`: se escribe su mcp.json')
  if (agent === 'agy') {                                           // las opciones van antes del nombre
    const argv = ['agy', 'mcp', 'add']
    for (const [k, v] of headers) argv.push('--header', `${k}: ${v}`)
    for (const [k, v] of env) argv.push('--env', `${k}=${v}`)
    return remote ? [...argv, spec.name, spec.url!] : [...argv, spec.name, '--', spec.command!, ...args]
  }
  if (agent === 'codex') {
    const argv = ['codex', 'mcp', 'add', spec.name]
    if (remote) return [...argv, '--url', spec.url!]
    for (const [k, v] of env) argv.push('--env', `${k}=${v}`)
    return [...argv, '--', spec.command!, ...args]
  }
  const argv = ['opencode', 'mcp', 'add']
  if (scope === 'global') argv.push('--global')
  if (remote) {
    argv.push('--url', spec.url!)
    for (const [k, v] of headers) argv.push('--header', `${k}=${v}`)
    argv.push(spec.name)
  } else {
    for (const [k, v] of env) argv.push('--env', `${k}=${v}`)
    argv.push(spec.name, '--', spec.command!, ...args)
  }
  return argv
}

function run(argv: string[], cwd: string | null): Promise<McpResult> {
  return new Promise((done) => {
    execFile(argv[0], argv.slice(1), { cwd: cwd ?? undefined, timeout: 60_000, encoding: 'utf8', windowsHide: true, env: { ...process.env, PATH: extendedPath() } },
      (err, stdout, stderr) => {
        const text = ((err ? stderr || stdout : stdout) || '').trim()
        done({ ok: !err, message: text || (err ? String(err.message) : 'Hecho') })
      }).stdin?.end()
  })
}

export async function addServer(agent: McpAgent, spec: McpSpec, scope: McpScope, project: string | null): Promise<McpResult> {
  const error = validate(spec)
  if (error) return { ok: false, message: error }
  if (!(agent in SUPPORTED)) return { ok: false, message: tm('m.mcp.unknownAgent', { agent }) }
  if (agent === 'codex' && scope === 'global' && spec.kind === 'remote' && Object.keys(spec.headers ?? {}).length) return { ok: false, message: tm('m.mcp.codexHeaders') }
  if (scope !== 'global' && !project) return { ok: false, message: tm('m.mcp.needProject') }
  if (agent === 'cursor') return addToMcpServersFile(mcpServersFile('cursor', scope, project), spec)
  if ((agent === 'agy' || agent === 'codex') && scope !== 'global') {    // en el proyecto son un espejo de .mcp.json: se añade allí
    if (!(spec.name in sharedServers(project!))) {
      const added = await addServer('claude', spec, 'shared', project)
      if (!added.ok) return added
    }
    return mirror(project!, spec.name, agent)
  }
  const result = await run(buildAddArgv(agent, spec, scope), project)
  if (!result.ok || agent !== 'claude' || scope !== 'shared') return result
  const mirrored = mirror(project!, spec.name)
  return mirrored.ok ? result : mirrored
}

/** Lleva a Antigravity y Codex el cambio de `name` en `.mcp.json`; `force` los crea aunque el agente no parezca instalado. */
function mirror(project: string, name: string, force?: 'agy' | 'codex'): McpResult {
  try {
    mirrorToAgy(project, name, force === 'agy')
    mirrorToCodex(project, name, force === 'codex')
    return { ok: true, message: 'Hecho' }
  } catch (e) {
    return { ok: false, message: tm('m.mcp.mirrorFailed', { message: e instanceof Error ? e.message : String(e) }) }
  }
}

/** Entrada de `mcpServers` (formato de Cursor, que también usa Antigravity) para un servidor. */
const cursorEntry = (spec: McpSpec): Entry => spec.kind === 'remote'
  ? { url: spec.url, ...(Object.keys(spec.headers ?? {}).length ? { headers: spec.headers } : {}) }
  : { command: spec.command, ...(spec.args?.length ? { args: spec.args } : {}), ...(Object.keys(spec.env ?? {}).length ? { env: spec.env } : {}) }

/** Cursor no trae `mcp add`: se escribe su mcp.json (conservando lo demás que tenga). */
function addToMcpServersFile(file: string, spec: McpSpec): McpResult {
  try {
    const data = readJson(file)
    const servers = isObject(data.mcpServers) ? data.mcpServers : {}
    servers[spec.name] = cursorEntry(spec)
    data.mcpServers = servers
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
    return { ok: true, message: 'Hecho' }
  } catch (e) {
    return { ok: false, message: `No se pudo editar ${file}: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/** Quita `name` del `mcpServers` de un JSON. Devuelve false si no estaba. */
function removeFromMcpServersFile(file: string, name: string): boolean {
  const data = readJson(file)
  if (!isObject(data.mcpServers) || !(name in data.mcpServers)) return false
  delete data.mcpServers[name]
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  return true
}

/** Quita `name` de un opencode.json, esté donde esté (mcp.servers o mcp). Devuelve false si no estaba. */
export function removeFromOpencodeFile(file: string, name: string): boolean {
  const data = readJson(file)
  const mcp = data.mcp
  if (!isObject(mcp)) return false
  let removed = false
  if (isObject(mcp.servers) && name in mcp.servers) { delete mcp.servers[name]; removed = true }
  if (name !== 'servers' && name in mcp) { delete mcp[name]; removed = true }
  if (removed) writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  return removed
}

export async function removeServer(server: McpServer, project: string | null): Promise<McpResult> {
  if (server.agent === 'claude') {
    const cliScope = { global: 'user', project: 'local', shared: 'project' }[server.scope]
    const result = await run(['claude', 'mcp', 'remove', server.name, '-s', cliScope], project)
    if (!result.ok || server.scope !== 'shared' || !project) return result
    const mirrored = mirror(project, server.name)
    return mirrored.ok ? result : mirrored
  }
  if (server.agent === 'gemini' || server.agent === 'qwen') return run([server.agent, 'mcp', 'remove', '-s', server.scope === 'global' ? 'user' : 'project', server.name], project)
  if (server.agent === 'cursor' || (server.agent === 'agy' && server.scope !== 'global')) {
    const file = server.agent === 'cursor' ? mcpServersFile('cursor', server.scope, project) : server.source || join(project ?? '', PLUGINS_DIR, 'tutti-mcp', 'mcp_config.json')
    try { return removeFromMcpServersFile(file, server.name) ? { ok: true, message: 'Quitado' } : { ok: false, message: 'No estaba en el archivo' } } catch (e) { return { ok: false, message: `No se pudo editar ${file}: ${e instanceof Error ? e.message : String(e)}` } }
  }
  if (server.agent === 'agy') return run(['agy', 'mcp', 'remove', server.name], project)
  if (server.agent === 'codex' && server.scope !== 'global') {
    const file = server.source || codexProjectConfig(project ?? '')
    try {
      const text = readFileSync(file, 'utf8')
      const next = withoutCodexServer(text, server.name)
      if (next === text) return { ok: false, message: 'No estaba en el archivo' }
      writeFileSync(file, next, 'utf8')
      return { ok: true, message: 'Quitado' }
    } catch (e) { return { ok: false, message: `No se pudo editar ${file}: ${e instanceof Error ? e.message : String(e)}` } }
  }
  if (server.agent === 'codex') return run(['codex', 'mcp', 'remove', server.name], project)
  // OpenCode no trae `mcp remove`: se edita su archivo
  const file = server.scope === 'global' ? opencodeGlobalConfig() : join(project ?? '', 'opencode.json')
  try {
    if (!existsSync(file)) return { ok: false, message: `No existe ${file}` }
    return removeFromOpencodeFile(file, server.name) ? { ok: true, message: 'Quitado' } : { ok: false, message: 'No estaba en el archivo' }
  } catch (e) {
    return { ok: false, message: `No se pudo editar ${file}: ${e instanceof Error ? e.message : String(e)}` }
  }
}
