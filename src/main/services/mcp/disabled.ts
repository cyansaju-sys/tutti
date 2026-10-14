/**
 * MCP desactivados: se quitan del agente (que no tiene interruptor) y Tutti guarda aquí cómo estaban para volver a ponerlos.
 * Viven en los ajustes de la app (<config>/tutti/settings.json), no en el proyecto, porque pueden llevar secretos: sus `env` y
 * cabeceras se guardan cifrados con el llavero del sistema (safeStorage) si lo hay.
 */
import { safeStorage } from 'electron'
import type { McpAgent, McpScope, McpServer, McpSpec } from '../../../shared/types'
import { getSetting, setSetting } from '../settings'

/** `locked`: sus secretos no se pudieron descifrar (otro equipo u otro llavero); no se activa sin ellos. */
export interface DisabledEntry { agent: McpAgent; scope: McpScope; name: string; project: string | null; spec: McpSpec; locked?: boolean }
/** Como se guarda: la especificación sin `env` ni `headers`, que van cifrados en `sealed`. */
type Stored = Omit<DisabledEntry, 'locked'> & { sealed?: string }

let storage = { get: (): unknown => getSetting('mcpDisabled'), set: (v: Stored[]): void => setSetting('mcpDisabled', v) }
/** Para las pruebas: otro almacén en lugar de los ajustes de la app. */
export const useDisabledStorage = (s: typeof storage): void => { storage = s }

/** Cifra y descifra texto; null si no se puede (sin llavero, o cifrado en otro sitio). */
export interface Vault { seal: (text: string) => string | null; open: (sealed: string) => string | null }
let vault: Vault = {
  seal: (text) => { try { return safeStorage?.isEncryptionAvailable() ? safeStorage.encryptString(text).toString('base64') : null } catch { return null } },
  open: (sealed) => { try { return safeStorage.decryptString(Buffer.from(sealed, 'base64')) } catch { return null } }
}
/** Para las pruebas: otro cifrado en lugar del del sistema. */
export const useDisabledVault = (v: Vault): void => { vault = v }

const strings = (v: unknown): Record<string, string> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, string>) : {})

function seal(entry: DisabledEntry): Stored {
  const { locked: _locked, ...rest } = entry
  const { env, headers, ...spec } = entry.spec
  if (!Object.keys(env ?? {}).length && !Object.keys(headers ?? {}).length) return rest
  const sealed = vault.seal(JSON.stringify({ env: env ?? {}, headers: headers ?? {} }))
  return sealed ? { ...rest, spec, sealed } : rest                  // sin llavero: como antes, en claro
}

function parseSecrets(text: string | null): { env?: unknown; headers?: unknown } | null {
  if (text === null) return null
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === 'object' && value !== null ? value : null
  } catch { return null }
}

function unseal(stored: Stored): DisabledEntry {
  if (!stored.sealed) return stored
  const { sealed, ...entry } = stored
  const secrets = parseSecrets(vault.open(sealed))
  if (!secrets) return { ...entry, locked: true }
  const env = strings(secrets.env)
  const headers = strings(secrets.headers)
  return { ...entry, spec: { ...entry.spec, ...(Object.keys(env).length ? { env } : {}), ...(Object.keys(headers).length ? { headers } : {}) } }
}

function all(): DisabledEntry[] {
  const raw = storage.get()
  return Array.isArray(raw) ? (raw as Stored[]).map(unseal) : []
}
/** Guarda la lista; una entrada bloqueada se queda con lo que tenía cifrado (no se puede volver a cifrar sin abrirla). */
function save(entries: DisabledEntry[]): void {
  const raw = storage.get()
  const previous = Array.isArray(raw) ? (raw as Stored[]) : []
  storage.set(entries.map((e) => (e.locked ? previous.find((p) => same(p, e)) ?? seal(e) : seal(e))))
}
const same = (a: Pick<DisabledEntry, 'agent' | 'scope' | 'name' | 'project'>, b: Pick<DisabledEntry, 'agent' | 'scope' | 'name' | 'project'>): boolean =>
  a.agent === b.agent && a.scope === b.scope && a.name.toLowerCase() === b.name.toLowerCase() && a.project === b.project

/** El `project` solo cuenta si el alcance no es global. */
export const keyOf = (server: Pick<McpServer, 'agent' | 'scope' | 'name'>, project: string | null): Pick<DisabledEntry, 'agent' | 'scope' | 'name' | 'project'> =>
  ({ agent: server.agent, scope: server.scope, name: server.name, project: server.scope === 'global' ? null : project })

export function addDisabled(entry: DisabledEntry): void { save([...all().filter((e) => !same(e, entry)), entry]) }
export function removeDisabled(key: Pick<DisabledEntry, 'agent' | 'scope' | 'name' | 'project'>): void { save(all().filter((e) => !same(e, key))) }
export const findDisabled = (server: Pick<McpServer, 'agent' | 'scope' | 'name'>, project: string | null): DisabledEntry | undefined => disabledFinder(project)(server)

/** Como `findDisabled`, pero leyendo los ajustes una sola vez: para buscar muchos seguidos. */
export function disabledFinder(project: string | null): (server: Pick<McpServer, 'agent' | 'scope' | 'name'>) => DisabledEntry | undefined {
  const entries = all()
  return (server) => {
    const key = keyOf(server, project)
    return entries.find((e) => same(e, key))
  }
}

/** Los desactivados que valen para `project` (los globales y los de ese proyecto). */
export function listDisabled(project: string | null): DisabledEntry[] {
  return all().filter((e) => e.scope === 'global' || (project !== null && e.project === project))
}

/** Un desactivado con la forma de un servidor de la lista (`config` rehecho desde su especificación). */
export function asServer(e: DisabledEntry): McpServer {
  const s = e.spec
  const config: Record<string, unknown> = s.kind === 'remote'
    ? { url: s.url, ...(s.transport === 'sse' ? { type: 'sse' } : {}), ...(Object.keys(s.headers ?? {}).length ? { headers: s.headers } : {}) }
    : { command: s.command, args: s.args ?? [], ...(Object.keys(s.env ?? {}).length ? { env: s.env } : {}) }
  return { name: e.name, agent: e.agent, scope: e.scope, kind: s.kind, target: s.kind === 'remote' ? s.url ?? '' : [s.command, ...(s.args ?? [])].join(' '), config, source: '', disabled: true }
}
