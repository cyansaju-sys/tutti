/**
 * Servidores MCP de cada agente: leerlos, añadirlos y quitarlos.
 *
 * Se añaden con el propio comando de cada agente (`claude mcp ...`, `opencode mcp ...`) para respetar su formato;
 * la lectura es directa de sus archivos de configuración.
 */
import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { McpAgent, McpResult, McpScope, McpServer, McpSpec } from '../../../shared/types'
import { tm } from '../../utils/i18n'
import { extendedPath, which } from '../../utils/shellpath'
import { type Entry, isObject, readJson, readMcpServers, writeAtomic, writeJson } from './files'
import { codexProjectConfig, mirrorToAgy, mirrorToCodex, PLUGINS_DIR, resolveEntry, sharedServers, withoutCodexServer } from './mirror'
import { parseToml } from './toml'

export const SUPPORTED: Record<McpAgent, string> = { claude: 'Claude Code', opencode: 'OpenCode', gemini: 'Gemini CLI', codex: 'Codex', agy: 'Antigravity', cursor: 'Cursor Agent', qwen: 'Qwen Code' }
export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const editFailed = (file: string, e: unknown): McpResult => ({ ok: false, message: tm('m.mcp.editFailed', { file, message: errorText(e) }) })
const removed = (found: boolean): McpResult => (found ? { ok: true, message: tm('m.mcp.removed') } : { ok: false, message: tm('m.mcp.notInFile') })

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

/** Servidores de `mcp_servers` en un config.toml de Codex, con `http_headers` como `headers` (el nombre que usan los demás). */
export function codexEntries(file: string): Array<[string, Entry]> {
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch { return [] }
  const servers = parseToml(text).mcp_servers
  if (!isObject(servers)) return []
  return Object.entries(servers).filter((e): e is [string, Entry] => isObject(e[1])).map(([name, entry]) => {
    const { http_headers: headers, ...rest } = entry
    return [name, isObject(headers) ? { ...rest, headers } : rest]
  })
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
export const samePath = (a: string, b: string): boolean => realOf(a) === realOf(b)
function realOf(p: string): string {
  let real: string
  try { real = realpathSync.native(p) } catch { real = resolve(p) }
  return process.platform === 'win32' ? real.toLowerCase() : real
}

export function listServers(project: string | null): McpServer[] {
  const servers: McpServer[] = []
  /** `shown`: la configuración que se muestra (la de `.mcp.json` para las entradas del espejo). */
  const addAll = (agent: McpAgent, scope: McpScope, entries: Iterable<[string, unknown]>, source: string, shown: (e: Entry) => Entry = (e) => e): void => {
    for (const [name, raw] of entries) {
      const entry = shown(isObject(raw) ? raw : {})
      servers.push({ name, agent, scope, ...describe(entry), config: entry, source })
    }
  }
  const scopes: McpScope[] = project ? ['global', 'project'] : ['global']

  const claudeFile = join(homedir(), '.claude.json')
  const claude = readJson(claudeFile)
  addAll('claude', 'global', Object.entries(isObject(claude.mcpServers) ? claude.mcpServers : {}), claudeFile)
  if (project) {
    const here = realOf(project)                                     // una vez: ~/.claude.json puede tener cientos de proyectos
    for (const [key, data] of Object.entries(isObject(claude.projects) ? claude.projects : {})) {
      if (isObject(data) && isObject(data.mcpServers) && realOf(key) === here) addAll('claude', 'project', Object.entries(data.mcpServers), claudeFile)
    }
    const shared = join(project, '.mcp.json')
    addAll('claude', 'shared', Object.entries(readMcpServers(shared)), shared)
  }
  for (const scope of scopes) {
    const file = scope === 'global' ? opencodeGlobalConfig() : join(project!, 'opencode.json')
    addAll('opencode', scope, opencodeEntries(file).map(([name, entry]) => [name, entry]), file)
  }
  for (const agent of ['gemini', 'qwen', 'cursor'] as const) {
    for (const scope of scopes) {
      const file = mcpServersFile(agent, scope, project)
      addAll(agent, scope, Object.entries(readMcpServers(file)), file)
    }
  }
  addAll('agy', 'global', Object.entries(readMcpServers(agyGlobalConfig())), agyGlobalConfig())
  const shared = project ? sharedServers(project) : {}
  const viaShared = (e: Entry): Entry => resolveEntry(e, shared)
  for (const file of project ? agyProjectFiles(project) : []) addAll('agy', 'project', Object.entries(readMcpServers(file)), file, viaShared)
  addAll('codex', 'global', codexEntries(codexConfig()), codexConfig())
  if (project) addAll('codex', 'project', codexEntries(codexProjectConfig(project)), codexProjectConfig(project), viaShared)
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
      argv.push(spec.url!, '--transport', spec.transport ?? 'http', '-s', cliScope)
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
      argv.push('-t', spec.transport ?? 'http')
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

/**
 * Ejecutable y argumentos con los que lanzar `argv`. En Windows las CLI instaladas con npm son `.cmd`, que Node no lanza sin shell:
 * van por cmd.exe con cada argumento entre comillas (y las comillas de dentro, dobladas).
 */
export function launchArgv(argv: string[], resolved: string | null, win = process.platform === 'win32'): { file: string; args: string[]; verbatim: boolean } {
  if (!win || !resolved || !/\.(cmd|bat)$/i.test(resolved)) return { file: resolved ?? argv[0], args: argv.slice(1), verbatim: false }
  const quoted = [resolved, ...argv.slice(1)].map((a) => `"${a.replace(/"/g, '""')}"`).join(' ')
  return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${quoted}"`], verbatim: true }
}

function run(argv: string[], cwd: string | null): Promise<McpResult> {
  const { file, args, verbatim } = launchArgv(argv, process.platform === 'win32' ? which(argv[0]) : null)
  return new Promise((done) => {
    execFile(file, args, { cwd: cwd ?? undefined, timeout: 60_000, encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: verbatim, env: { ...process.env, PATH: extendedPath() } },
      (err, stdout, stderr) => {
        const text = ((err ? stderr || stdout : stdout) || '').trim()
        done({ ok: !err, message: text || (err ? String(err.message) : tm('m.mcp.done')) })
      }).stdin?.end()
  })
}

export async function addServer(agent: McpAgent, spec: McpSpec, scope: McpScope, project: string | null): Promise<McpResult> {
  const error = validate(spec)
  if (error) return { ok: false, message: error }
  if (!(agent in SUPPORTED)) return { ok: false, message: tm('m.mcp.unknownAgent', { agent }) }
  if (agent === 'codex' && spec.kind === 'remote' && spec.transport === 'sse') return { ok: false, message: tm('m.mcp.codexSse') }
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
    return { ok: true, message: tm('m.mcp.done') }
  } catch (e) {
    return { ok: false, message: tm('m.mcp.mirrorFailed', { message: errorText(e) }) }
  }
}

/** Entrada de `.mcp.json` para un servidor, como la escribe `claude mcp add -s project`. */
export const claudeEntry = (spec: McpSpec): Entry => spec.kind === 'remote'
  ? { type: spec.transport ?? 'http', url: spec.url, ...(Object.keys(spec.headers ?? {}).length ? { headers: spec.headers } : {}) }
  : { type: 'stdio', command: spec.command, args: spec.args ?? [], env: spec.env ?? {} }

/**
 * Cambia en `.mcp.json` la entrada de `spec.name` (conservando el resto del archivo) y lleva el cambio al espejo de Antigravity y
 * Codex. A diferencia de quitar y volver a añadir, el servidor no desaparece entre medias ni se reescribe el espejo dos veces.
 */
export function writeSharedServer(project: string, spec: McpSpec): McpResult {
  const error = validate(spec)
  if (error) return { ok: false, message: error }
  const file = join(project, '.mcp.json')
  try {
    const data = readJson(file)
    data.mcpServers = { ...(isObject(data.mcpServers) ? data.mcpServers : {}), [spec.name]: claudeEntry(spec) }
    writeJson(file, data)
  } catch (e) {
    return editFailed(file, e)
  }
  return mirror(project, spec.name)
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
    writeJson(file, data)
    return { ok: true, message: tm('m.mcp.done') }
  } catch (e) {
    return editFailed(file, e)
  }
}

/** Quita `name` del `mcpServers` de un JSON. Devuelve false si no estaba. */
function removeFromMcpServersFile(file: string, name: string): boolean {
  const data = readJson(file)
  if (!isObject(data.mcpServers) || !(name in data.mcpServers)) return false
  delete data.mcpServers[name]
  writeJson(file, data)
  return true
}

/** Quita `name` de un opencode.json, esté donde esté (mcp.servers o mcp). Devuelve false si no estaba. */
export function removeFromOpencodeFile(file: string, name: string): boolean {
  const data = readJson(file)
  const mcp = data.mcp
  if (!isObject(mcp)) return false
  let found = false
  if (isObject(mcp.servers) && name in mcp.servers) { delete mcp.servers[name]; found = true }
  if (name !== 'servers' && name in mcp) { delete mcp[name]; found = true }
  if (found) writeJson(file, data)
  return found
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
    try { return removed(removeFromMcpServersFile(file, server.name)) } catch (e) { return editFailed(file, e) }
  }
  if (server.agent === 'agy') return run(['agy', 'mcp', 'remove', server.name], project)
  if (server.agent === 'codex' && server.scope !== 'global') {
    const file = server.source || codexProjectConfig(project ?? '')
    try {
      const text = readFileSync(file, 'utf8')
      const next = withoutCodexServer(text, server.name)
      if (next !== text) writeAtomic(file, next)
      return removed(next !== text)
    } catch (e) { return editFailed(file, e) }
  }
  if (server.agent === 'codex') return run(['codex', 'mcp', 'remove', server.name], project)
  // OpenCode no trae `mcp remove`: se edita su archivo
  const file = server.scope === 'global' ? opencodeGlobalConfig() : join(project ?? '', 'opencode.json')
  try {
    if (!existsSync(file)) return { ok: false, message: tm('m.mcp.noFile', { file }) }
    return removed(removeFromOpencodeFile(file, server.name))
  } catch (e) {
    return editFailed(file, e)
  }
}
