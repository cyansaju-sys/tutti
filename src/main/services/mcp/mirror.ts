/**
 * MCP de proyecto de Antigravity y Codex como espejo de `.mcp.json`, que es la única fuente: Tutti solo escribe allí y estos dos
 * agentes lo siguen. Sus servidores locales arrancan con `.tutti/mcp/launch.mjs`, que lee `.mcp.json` en cada arranque (cambiar un
 * servidor no toca sus archivos); los remotos se apuntan con su URL, porque el agente los llama directamente.
 *
 * - Antigravity no tiene archivo de MCP por proyecto, pero carga los plugins de las carpetas que declara `.agents/plugins.json`:
 *   Tutti guarda el suyo, `tutti-mcp`, en `.tutti/plugins/` y lo declara allí.
 * - Codex lee `.codex/config.toml` del proyecto (si el proyecto es de confianza) y arranca sus servidores desde la raíz.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { which } from '../../utils/shellpath'
import { type Entry, isObject, readJson, readMcpServers, writeAtomic, writeJson } from './files'

/** Lanzador compartido, relativo a la raíz del proyecto. */
export const LAUNCHER_PATH = '.tutti/mcp/launch.mjs'
export const PLUGIN = 'tutti-mcp'
/** Carpeta de plugins de Tutti en el proyecto, relativa a su raíz (así la declara `.agents/plugins.json`). */
export const PLUGINS_DIR = '.tutti/plugins'
export const agyProjectPlugin = (project: string): string => join(project, PLUGINS_DIR, PLUGIN)
export const agyPluginsJson = (project: string): string => join(project, '.agents', 'plugins.json')
export const agyPluginConfig = (project: string): string => join(agyProjectPlugin(project), 'mcp_config.json')
export const codexProjectConfig = (project: string): string => join(project, '.codex', 'config.toml')
/** Cómo apunta cada agente al lanzador: Antigravity desde la carpeta del plugin, Codex desde la raíz (donde arranca sus servidores). */
const AGY_LAUNCHER = '${PLUGIN_ROOT}/../../mcp/launch.mjs'

/** ¿Es una entrada que lanza un servidor de `.mcp.json`? Devuelve su nombre allí. */
export function launchedName(entry: Entry): string | null {
  const args = entry.args
  return entry.command === 'node' && Array.isArray(args) && (args[0] === AGY_LAUNCHER || args[0] === LAUNCHER_PATH) && typeof args[1] === 'string' ? args[1] : null
}

const isRemote = (e: Entry): boolean => !!(e.url || e.httpUrl || e.serverUrl) || ['http', 'sse', 'remote'].includes(String(e.type))
const urlOf = (e: Entry): unknown => e.url ?? e.httpUrl ?? e.serverUrl
const headersOf = (e: Entry): Record<string, string> | null => (isObject(e.headers) && Object.keys(e.headers).length ? e.headers as Record<string, string> : null)

/** Entrada del plugin de Antigravity para el servidor `name` de `.mcp.json`. */
export function pluginEntry(name: string, shared: Entry): Entry {
  if (!isRemote(shared)) return { command: 'node', args: [AGY_LAUNCHER, name] }
  const headers = headersOf(shared)
  return { url: urlOf(shared), ...(headers ? { headers } : {}) }
}

/** Servidores de `.mcp.json` del proyecto. */
export const sharedServers = (project: string): Entry => readMcpServers(join(project, '.mcp.json'))

/** La configuración que muestra Tutti para una entrada del espejo: la de `.mcp.json` si la lanza desde allí. */
export function resolveEntry(entry: Entry, shared: Entry): Entry {
  const name = launchedName(entry)
  return name && isObject(shared[name]) ? shared[name] : entry
}

/** Escribe el lanzador (siempre al día con esta versión de Tutti). */
function writeLauncher(project: string): void {
  const file = join(project, LAUNCHER_PATH)
  let current = ''
  try { current = readFileSync(file, 'utf8') } catch { /* no existe */ }
  if (current !== LAUNCHER) writeAtomic(file, LAUNCHER)
}

/**
 * Pone el servidor `name` en el plugin de Antigravity tal como está en `.mcp.json`, o lo quita si ya no está allí. Solo si
 * Antigravity está instalado o el proyecto ya tiene el plugin: no se crea en proyectos de quien no lo usa.
 */
export function mirrorToAgy(project: string, name: string, force = false): void {
  dropLegacyPlugin(project)
  const plugin = agyProjectPlugin(project)
  if (!force && !existsSync(plugin) && !which('agy')) return
  const shared = sharedServers(project)[name]
  const file = agyPluginConfig(project)
  const data = readJson(file)
  const servers = isObject(data.mcpServers) ? data.mcpServers : {}
  if (isObject(shared)) servers[name] = pluginEntry(name, shared)
  else if (name in servers) delete servers[name]
  else return
  data.mcpServers = servers
  declarePluginsDir(project)
  const manifest = join(plugin, 'plugin.json')
  if (!existsSync(manifest)) writeJson(manifest, { name: PLUGIN })
  writeLauncher(project)
  writeJson(file, data)
}

/** Las primeras versiones guardaban el plugin en `.agents/plugins/tutti-mcp`: se quita (solo si es el de Tutti) para no cargarlo dos veces. */
function dropLegacyPlugin(project: string): void {
  const legacy = join(project, '.agents', 'plugins', PLUGIN)
  if (readJson(join(legacy, 'plugin.json')).name === PLUGIN) rmSync(legacy, { recursive: true, force: true })
}

/** Añade `.tutti/plugins` a las entradas de `.agents/plugins.json` (si no está), conservando lo demás que tenga. */
export function declarePluginsDir(project: string): void {
  const file = agyPluginsJson(project)
  const data = readJson(file)
  const entries = Array.isArray(data.entries) ? data.entries : []
  if (entries.some((e) => isObject(e) && String(e.path).replace(/^\.\//, '').replace(/\/$/, '') === PLUGINS_DIR)) return
  data.entries = [...entries, { path: PLUGINS_DIR }]
  writeJson(file, data)
}

const tomlKey = (k: string): string => (/^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k))
const tomlString = (v: unknown): string => JSON.stringify(String(v))

/** Bloque `[mcp_servers.<name>]` de Codex para el servidor `name` de `.mcp.json`. */
export function codexBlock(name: string, shared: Entry): string {
  const head = `[mcp_servers.${tomlKey(name)}]`
  if (!isRemote(shared)) return `${head}\ncommand = "node"\nargs = [${tomlString(LAUNCHER_PATH)}, ${tomlString(name)}]\n`
  const headers = headersOf(shared)
  const table = headers ? `\n[mcp_servers.${tomlKey(name)}.http_headers]\n${Object.entries(headers).map(([k, v]) => `${tomlKey(k)} = ${tomlString(v)}`).join('\n')}\n` : ''
  return `${head}\nurl = ${tomlString(urlOf(shared))}\n${table}`
}

/** Quita de un config.toml de Codex la tabla `[mcp_servers.<name>]` y sus subtablas. Devuelve el texto nuevo. */
export function withoutCodexServer(text: string, name: string): string {
  const out: string[] = []
  let skipping = false
  for (const line of text.split(/\r?\n/)) {
    const head = /^\s*\[\s*mcp_servers\.("([^"]+)"|[^.\]\s]+)(\.[^\]]+)?\s*\]\s*$/.exec(line)
    if (head) skipping = (head[2] ?? head[1]) === name
    else if (/^\s*\[/.test(line)) skipping = false
    if (!skipping) out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

/**
 * Pone el servidor `name` en `.codex/config.toml` del proyecto tal como está en `.mcp.json`, o lo quita si ya no está allí (o es SSE),
 * conservando el resto del archivo. Solo si Codex está instalado o el proyecto ya tiene ese archivo.
 */
export function mirrorToCodex(project: string, name: string, force = false): void {
  const file = codexProjectConfig(project)
  if (!force && !existsSync(file) && !which('codex')) return
  const found = sharedServers(project)[name]
  const shared = isObject(found) && found.type !== 'sse' ? found : undefined      // Codex solo habla Streamable HTTP: un SSE no se le pone
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch { /* no existe */ }
  const rest = withoutCodexServer(text, name).replace(/\s+$/, '')
  if (!isObject(shared) && rest === text.replace(/\s+$/, '')) return
  const next = isObject(shared) ? `${rest ? `${rest}\n\n` : ''}${codexBlock(name, shared)}` : `${rest}\n`
  if (isObject(shared) && !isRemote(shared)) writeLauncher(project)
  writeAtomic(file, next)
}

/**
 * Quita de un config.toml de Codex una copia del puente de Antigravity como servidor «tutti» (stdio con `mcp-bridge.mjs`). Codex recibe
 * «tutti» de Tutti por `-c mcp_servers.tutti.url=…` y mezcla esas claves con lo que haya en su archivo: con un `command` ahí, no arranca
 * («url is not supported for stdio»). Devuelve si lo quitó. Una entrada «tutti» distinta no se toca.
 */
export function dropCodexBridgeCopy(file: string): boolean {
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch { return false }
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^\s*\[\s*mcp_servers\.("tutti"|tutti)\s*\]\s*$/.test(l))
  if (start < 0) return false
  const end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l) && !/^\s*\[\s*mcp_servers\.("tutti"|tutti)\./.test(l))
  const block = lines.slice(start, end < 0 ? undefined : end).join('\n')
  if (!/^\s*command\s*=/m.test(block) || !block.includes('mcp-bridge.mjs')) return false
  writeAtomic(file, withoutCodexServer(text, 'tutti'))
  return true
}

/** Lanzador: arranca el servidor local `<nombre>` de `.mcp.json` desde la raíz del proyecto, con las mismas reglas que Claude Code. */
export const LAUNCHER = `// Generado por Tutti. Arranca el servidor <nombre> de .mcp.json desde la raiz del proyecto: edita .mcp.json, no este archivo.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const name = process.argv[2]
const fail = (message) => { console.error(message); process.exit(1) }
let server
try { server = JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers?.[name] } catch (e) { fail(\`No se pudo leer .mcp.json: \${e.message}\`) }
if (!server) fail(\`No esta en .mcp.json: \${name}\`)
// \${VAR} y \${VAR:-por defecto}, como en .mcp.json de Claude Code
const expand = (s) => String(s).replace(/\\$\\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\\}/g, (_, k, d) => process.env[k] ?? d ?? '')
const command = Array.isArray(server.command) ? [...server.command, ...(server.args ?? [])] : [server.command, ...(server.args ?? [])]
if (!command[0]) fail(\`\${name} no es un servidor local\`)
const env = { ...process.env }
for (const [k, v] of Object.entries({ ...server.environment, ...server.env })) env[k] = expand(v)
const child = spawn(expand(command[0]), command.slice(1).map(expand), { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' })
child.on('error', (e) => fail(e.message))
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s))
`
