import type { MsgKey } from '@shared/i18n'
import type { McpScope, McpServer, McpSpec, McpTransport } from '@shared/types'

export const SCOPE_KEYS: Record<McpScope, MsgKey> = { global: 'mcp.scope.global', project: 'mcp.scope.project', shared: 'mcp.scope.shared' }
export const AGENT_NAMES: Record<string, string> = { claude: 'Claude Code', opencode: 'OpenCode', gemini: 'Gemini CLI', codex: 'Codex', agy: 'Antigravity', qwen: 'Qwen Code', cursor: 'Cursor Agent' }
const SECRET = /key|token|secret|auth|pass|pwd|credential/i      // valores que se ocultan

/** «Clave: valor» o «CLAVE=valor» por línea -> objeto. */
export function parsePairs(text: string, separators: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const sep = separators.find((s) => line.includes(s))
    if (!sep) continue
    const i = line.indexOf(sep)
    const key = line.slice(0, i).trim()
    if (key) out[key] = line.slice(i + sep.length).trim()
  }
  return out
}

/** Divide una línea de argumentos respetando comillas simples y dobles (como una shell sencilla). */
export function splitArgs(text: string): string[] {
  const out: string[] = []
  let current = ''
  let quote: string | null = null
  let started = false
  for (const ch of text) {
    if (quote) { if (ch === quote) quote = null; else current += ch }
    else if (ch === '"' || ch === "'") { quote = ch; started = true }
    else if (/\s/.test(ch)) { if (started || current) { out.push(current); current = ''; started = false } }
    else current += ch
  }
  if (started || current) out.push(current)
  return out
}

export const isSecret = (key: string): boolean => SECRET.test(key)
export const mask = (key: string, value: string, reveal: boolean): string =>
  reveal || !isSecret(key) ? value : '•'.repeat(Math.min(12, Math.max(4, value.length)))

/** El servidor «tutti» que la app registra en los agentes (orquestación): no se muestra ni se sincroniza. */
export const isAppServer = (server: Pick<McpServer, 'name' | 'scope'>): boolean => server.scope === 'global' && server.name.toLowerCase() === 'tutti'

/** Agentes soportados que todavía no tienen este servidor (mismo nombre y alcance). */
export function agentsMissing(server: McpServer, all: McpServer[], supported: string[]): string[] {
  const scope = server.scope === 'shared' ? 'project' : server.scope
  const have = new Set(all.map((s) => `${s.agent}|${s.name}|${s.scope === 'shared' ? 'project' : s.scope}`))
  return supported.filter((a) => a !== server.agent && !have.has(`${a}|${server.name}|${scope}`))
}

/**
 * Qué copias cambia «Editar». Si el servidor está en `.mcp.json`, en el proyecto solo se cambia esa: Antigravity la sigue sola y los
 * demás agentes, con Sincronizar. Las globales se cambian todas.
 */
export function editTargets(group: McpServer[]): McpServer[] {
  const shared = group.find((s) => s.agent === 'claude' && s.scope === 'shared')
  return shared ? group.filter((s) => s.scope === 'global' || s === shared) : group
}

/**
 * Qué copias borra «Quitar». Si el servidor está en `.mcp.json`, las de Antigravity y Codex en el proyecto no se borran aparte: siguen a
 * `.mcp.json` y Tutti se las quita al quitarlo de ahí.
 */
export function removeTargets(group: McpServer[]): McpServer[] {
  if (!group.some((s) => s.agent === 'claude' && s.scope === 'shared')) return group
  return group.filter((s) => !((s.agent === 'agy' || s.agent === 'codex') && s.scope !== 'global' && !s.disabled))
}

/** Transporte de un remoto: `type: "sse"`, o en Gemini CLI y Qwen Code `url` sin tipo (allí `httpUrl` es HTTP). Como en el proceso principal. */
export function transportOf(server: Pick<McpServer, 'agent' | 'config'>): McpTransport {
  const cfg = server.config as Record<string, unknown>
  if (cfg.type === 'sse') return 'sse'
  return (server.agent === 'gemini' || server.agent === 'qwen') && cfg.url && !cfg.httpUrl && !cfg.type ? 'sse' : 'http'
}

/** Convierte un servidor ya configurado en lo que hace falta para añadirlo a otro agente. */
export function specFromServer(server: McpServer): McpSpec {
  const cfg = server.config as Record<string, unknown>
  const env = { ...((cfg.environment as Record<string, string>) ?? {}), ...((cfg.env as Record<string, string>) ?? {}) }
  const headers = { ...((cfg.headers as Record<string, string>) ?? {}) }
  if (server.kind === 'remote') {
    const sse = transportOf(server) === 'sse'
    return { name: server.name, kind: 'remote', url: String(cfg.url ?? cfg.httpUrl ?? cfg.serverUrl ?? ''), ...(sse ? { transport: 'sse' as const } : {}), headers, env }
  }
  const command = cfg.command
  const parts = Array.isArray(command) ? command.map(String) : [String(command ?? ''), ...((cfg.args as unknown[]) ?? []).map(String)]
  return { name: server.name, kind: 'local', command: parts[0], args: parts.slice(1), headers, env }
}

/** Nombre corto de un servidor: «io.github.acme/filesystem-mcp» -> «filesystem-mcp». */
export function shortName(registryName: string): string {
  const last = registryName.split('/').pop() ?? registryName
  const clean = last.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
  return /^[A-Za-z0-9]/.test(clean) ? clean : `mcp-${clean}`.slice(0, 64)
}

/** Un argumento listo para ponerlo en una línea de comando (con comillas si lleva espacios). */
export const quoteArg = (a: string): string => (/[\s"']/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)

/** Lo que se le entrega al diálogo de «Añadir servidor». */
export interface Prefill {
  name: string; kind: 'remote' | 'local'; url: string; transport: McpTransport; headers: string; command: string; args: string; env: string
}

/** Un servidor ya instalado, como los datos del diálogo (para editarlo). */
export function prefillFromServer(server: McpServer): Prefill {
  const spec = specFromServer(server)
  const pairs = (m: Record<string, string> | undefined, sep: string): string => Object.entries(m ?? {}).map(([k, v]) => `${k}${sep}${v}`).join('\n')
  return {
    name: server.name, kind: spec.kind, url: spec.url ?? '', transport: spec.transport ?? 'http', headers: pairs(spec.headers, ': '),
    command: spec.command ?? '', args: (spec.args ?? []).map(quoteArg).join(' '), env: pairs(spec.env, '=')
  }
}
