/**
 * MCP desactivados: se quitan del agente (que no tiene interruptor) y Tutti guarda aquí cómo estaban para volver a ponerlos.
 * Viven en los ajustes de la app (<config>/tutti/settings.json), no en el proyecto, porque pueden llevar secretos.
 */
import type { McpAgent, McpScope, McpServer, McpSpec } from '../../../shared/types'
import { getSetting, setSetting } from '../settings'

export interface DisabledEntry { agent: McpAgent; scope: McpScope; name: string; project: string | null; spec: McpSpec }

let storage = { get: (): unknown => getSetting('mcpDisabled'), set: (v: DisabledEntry[]): void => setSetting('mcpDisabled', v) }
/** Para las pruebas: otro almacén en lugar de los ajustes de la app. */
export const useDisabledStorage = (s: typeof storage): void => { storage = s }

const all = (): DisabledEntry[] => (Array.isArray(storage.get()) ? (storage.get() as DisabledEntry[]) : [])
const same = (a: DisabledEntry, b: Pick<DisabledEntry, 'agent' | 'scope' | 'name' | 'project'>): boolean =>
  a.agent === b.agent && a.scope === b.scope && a.name.toLowerCase() === b.name.toLowerCase() && a.project === b.project

/** El `project` solo cuenta si el alcance no es global. */
export const keyOf = (server: Pick<McpServer, 'agent' | 'scope' | 'name'>, project: string | null): Pick<DisabledEntry, 'agent' | 'scope' | 'name' | 'project'> =>
  ({ agent: server.agent, scope: server.scope, name: server.name, project: server.scope === 'global' ? null : project })

export function addDisabled(entry: DisabledEntry): void { storage.set([...all().filter((e) => !same(e, entry)), entry]) }
export function removeDisabled(key: Pick<DisabledEntry, 'agent' | 'scope' | 'name' | 'project'>): void { storage.set(all().filter((e) => !same(e, key))) }
export function findDisabled(server: Pick<McpServer, 'agent' | 'scope' | 'name'>, project: string | null): DisabledEntry | undefined {
  const key = keyOf(server, project)
  return all().find((e) => same(e, key))
}

/** Los desactivados que valen para `project` (los globales y los de ese proyecto). */
export function listDisabled(project: string | null): DisabledEntry[] {
  return all().filter((e) => e.scope === 'global' || (project !== null && e.project === project))
}

/** Un desactivado con la forma de un servidor de la lista (`config` rehecho desde su especificación). */
export function asServer(e: DisabledEntry): McpServer {
  const s = e.spec
  const config: Record<string, unknown> = s.kind === 'remote'
    ? { url: s.url, ...(Object.keys(s.headers ?? {}).length ? { headers: s.headers } : {}) }
    : { command: s.command, args: s.args ?? [], ...(Object.keys(s.env ?? {}).length ? { env: s.env } : {}) }
  return { name: e.name, agent: e.agent, scope: e.scope, kind: s.kind, target: s.kind === 'remote' ? s.url ?? '' : [s.command, ...(s.args ?? [])].join(' '), config, source: '', disabled: true }
}
