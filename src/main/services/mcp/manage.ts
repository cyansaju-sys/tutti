/** Gestionar los MCP ya instalados: probar, editar y desactivar/activar. */
import type { McpAgent, McpProbe, McpResult, McpServer, McpSpec, McpTransport } from '../../../shared/types'
import { tm } from '../../utils/i18n'
import { addDisabled, asServer, findDisabled, keyOf, removeDisabled } from './disabled'
import { addServer, removeServer, validate, writeSharedServer } from './mcp'
import { probeSpec } from './probe'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strings = (v: unknown): Record<string, string> => (isObject(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)])) : {})

/** Transporte de una entrada remota: `type: "sse"`, o en Gemini CLI y Qwen Code `url` sin tipo (allí `httpUrl` es HTTP y `url`, SSE). */
export function transportOf(config: Record<string, unknown>, agent?: McpAgent): McpTransport {
  if (config.type === 'sse') return 'sse'
  return (agent === 'gemini' || agent === 'qwen') && config.url && !config.httpUrl && !config.type ? 'sse' : 'http'
}

/** Lo que hace falta para volver a añadir un servidor, sacado de su entrada de configuración (con los valores reales). */
export function specFromConfig(name: string, config: Record<string, unknown>, agent?: McpAgent): McpSpec {
  const env = { ...strings(config.environment), ...strings(config.env) }
  const url = config.url ?? config.httpUrl ?? config.serverUrl
  if (url || ['http', 'sse', 'remote'].includes(String(config.type))) {
    const sse = transportOf(config, agent) === 'sse'
    return { name, kind: 'remote', url: String(url ?? ''), ...(sse ? { transport: 'sse' as const } : {}), headers: strings(config.headers), env }
  }
  const parts = Array.isArray(config.command) ? config.command.map(String) : [String(config.command ?? ''), ...(Array.isArray(config.args) ? config.args.map(String) : [])]
  return { name, kind: 'local', command: parts[0], args: parts.slice(1), env }
}

/** La especificación de un servidor de la lista; si está desactivado, la guardada. */
export function specOf(server: McpServer, project: string | null): McpSpec {
  return (server.disabled && findDisabled(server, project)?.spec) || specFromConfig(server.name, server.config, server.agent)
}

export const probeServer = (server: McpServer, project: string | null): Promise<McpProbe> => probeSpec(specOf(server, project), undefined, project ?? undefined)

/** Cambia un servidor: lo quita y lo añade con la nueva especificación en el mismo agente y alcance; si falla, deja el que estaba. */
export async function updateServer(old: McpServer, spec: McpSpec, project: string | null): Promise<McpResult> {
  const invalid = validate(spec)
  if (invalid) return { ok: false, message: invalid }
  if (old.disabled) {
    addDisabled({ ...keyOf(old, project), spec })
    return { ok: true, message: tm('m.mcp.updated') }
  }
  if (old.agent === 'claude' && old.scope === 'shared' && project && spec.name === old.name) {    // .mcp.json: se cambia en su sitio
    const written = writeSharedServer(project, spec)
    return written.ok ? { ok: true, message: tm('m.mcp.updated') } : written
  }
  const previous = specFromConfig(old.name, old.config, old.agent)
  const removed = await removeServer(old, project)
  if (!removed.ok) return removed
  const added = await addServer(old.agent, spec, old.scope, project)
  if (added.ok) return { ok: true, message: tm('m.mcp.updated') }
  const restored = await addServer(old.agent, previous, old.scope, project)
  return { ok: false, message: restored.ok ? `${added.message}\n${tm('m.mcp.kept')}` : `${added.message}\n${tm('m.mcp.lost', { message: restored.message })}` }
}

/** Quita el servidor del agente y se lo apunta para poder volver a activarlo. */
export async function disableServer(server: McpServer, project: string | null): Promise<McpResult> {
  const spec = specFromConfig(server.name, server.config, server.agent)
  const removed = await removeServer(server, project)
  if (!removed.ok) return removed
  addDisabled({ ...keyOf(server, project), spec })
  return { ok: true, message: tm('m.mcp.disabled') }
}

export async function enableServer(server: McpServer, project: string | null): Promise<McpResult> {
  const entry = findDisabled(server, project)
  if (!entry) return { ok: false, message: tm('m.mcp.notDisabled') }
  if (entry.locked) return { ok: false, message: tm('m.mcp.locked') }
  const added = await addServer(entry.agent, entry.spec, entry.scope, project)
  if (added.ok) removeDisabled(entry)
  return added.ok ? { ok: true, message: tm('m.mcp.enabled') } : added
}

/** Borra el servidor del agente; si estaba desactivado, olvida lo que Tutti tenía apuntado. */
export async function deleteServer(server: McpServer, project: string | null): Promise<McpResult> {
  if (!server.disabled) return removeServer(server, project)
  removeDisabled(keyOf(server, project))
  return { ok: true, message: tm('m.mcp.removed') }
}

export { asServer }
