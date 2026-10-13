/**
 * Sincronizar los MCP entre agentes. La fuente es la de Claude Code: `.mcp.json` en el proyecto y los MCP de usuario en
 * `~/.claude.json` para los globales. Tutti compara cada agente con ella: lo que falta se añade, lo que difiere se resuelve a
 * mano (usar la fuente o usar el del agente) y lo que solo está en otro agente se puede traer a la fuente.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { McpAgent, McpResult, McpScope, McpServer, McpSpec, SyncScope, SyncState } from '../../../shared/types'
import { tm } from '../../utils/i18n'
import { detectAgents } from '../agents/agents'
import { findDisabled } from './disabled'
import { specFromConfig, updateServer } from './manage'
import { addServer, listServers, removeFromOpencodeFile, removeServer, SUPPORTED } from './mcp'

const TARGETS: McpAgent[] = ['opencode', 'gemini', 'qwen', 'cursor', 'codex', 'agy']
const GLOBAL_ONLY: McpAgent[] = ['codex', 'agy']
/** Comando con el que se detecta cada agente, si no es su nombre. */
const COMMAND: Partial<Record<McpAgent, string>> = { cursor: 'cursor-agent' }

export type Installed = (agent: McpAgent) => boolean
/** Agentes instalados; se mira la primera vez que se necesita. */
export function installedAgents(): Installed {
  let present: Set<string> | null = null
  return (agent) => (present ??= new Set(detectAgents().map((a) => a.command))).has(COMMAND[agent] ?? agent)
}

/** Alcance en el que cada agente guarda lo que corresponde a `scope` (Claude lo comparte en `.mcp.json`). */
const scopeFor = (agent: McpAgent, scope: SyncScope): McpScope => (scope === 'global' ? 'global' : agent === 'claude' ? 'shared' : 'project')

const sorted = (o: Record<string, string> | undefined): Array<[string, string]> => Object.entries(o ?? {}).sort(([a], [b]) => a.localeCompare(b))
/** Lo que identifica a un servidor, para decir si dos agentes lo tienen igual. */
const norm = (s: McpSpec): string => JSON.stringify([s.kind, s.url ?? '', s.command ?? '', s.args ?? [], sorted(s.headers), sorted(s.env)])

const hasHeaders = (s: McpSpec): boolean => Object.keys(s.headers ?? {}).length > 0

function collect(project: string | null, scope: SyncScope): { source: Map<string, McpServer>; others: McpServer[] } {
  const all = listServers(project)
  const lower = (s: string): string => s.toLowerCase()
  const source = new Map(all.filter((s) => s.agent === 'claude' && s.scope === scopeFor('claude', scope)).map((s) => [lower(s.name), s]))
  const others = all.filter((s) => s.agent !== 'claude' && TARGETS.includes(s.agent) && s.scope === scopeFor(s.agent, scope))
  return { source, others }
}

export function syncState(project: string | null, scope: SyncScope, installed: Installed = installedAgents()): SyncState {
  const empty: SyncState = { available: false, source: '', servers: [], extras: 0, local: 0 }
  if (scope === 'project' && !project) return empty
  if (!installed('claude')) return empty
  const targets = TARGETS.filter((a) => installed(a) && !(scope === 'project' && GLOBAL_ONLY.includes(a)))
  const { source, others } = collect(project, scope)
  const servers = [...source.values()].map((src) => {
    const spec = specFromConfig(src.name, src.config)
    return {
      name: src.name,
      agents: targets.map((agent) => {
        if (scope === 'project' && agent === 'opencode') return { agent, state: 'launch' as const }          // lo recibe al abrirlo desde Tutti: no se escribe opencode.json
        const found = others.find((o) => o.agent === agent && o.name.toLowerCase() === src.name.toLowerCase())
        if (agent === 'codex' && spec.kind === 'remote' && hasHeaders(spec)) return { agent, state: 'unsupported' as const }
        if (!found) return { agent, state: findDisabled({ agent, scope: scopeFor(agent, scope), name: src.name }, project) ? 'disabled' as const : 'missing' as const }
        return { agent, state: norm(specFromConfig(found.name, found.config)) === norm(spec) ? 'ok' as const : 'differs' as const }
      })
    }
  })
  const extras = new Set(others.filter((o) => !source.has(o.name.toLowerCase())).map((o) => o.name.toLowerCase()))
  const local = scope === 'project' ? standardizable(project, collect(project, scope)).size : 0
  return { available: true, source: [...source.values()][0]?.source ?? '', servers, extras: extras.size, local }
}

/** Añade a cada agente instalado lo que le falta de la fuente. No toca lo que ya está (aunque difiera). */
export async function applySync(project: string | null, scope: SyncScope, installed: Installed = installedAgents()): Promise<McpResult> {
  const state = syncState(project, scope, installed)
  if (!state.available) return { ok: false, message: tm('m.mcp.syncNone') }
  const { source } = collect(project, scope)
  let added = 0
  const problems: string[] = []
  for (const sv of state.servers) {
    const spec = specFromConfig(sv.name, source.get(sv.name.toLowerCase())!.config)
    for (const { agent, state: s } of sv.agents) {
      if (s !== 'missing') continue
      const r = await addServer(agent, spec, scopeFor(agent, scope), project)
      if (r.ok) added++
      else problems.push(`${sv.name} · ${SUPPORTED[agent]}: ${r.message}`)
    }
  }
  return { ok: problems.length === 0, message: tm('m.mcp.syncApplied', { added: String(added) }) + (problems.length ? `\n${problems.join('\n')}` : '') }
}

/** Pasa a la fuente (Claude Code) los servidores que solo están en otros agentes. */
export async function pullSync(project: string | null, scope: SyncScope, installed: Installed = installedAgents()): Promise<McpResult> {
  const state = syncState(project, scope, installed)
  if (!state.available) return { ok: false, message: tm('m.mcp.syncNone') }
  const { source, others } = collect(project, scope)
  const seen = new Set<string>()
  let added = 0
  const problems: string[] = []
  for (const o of others) {
    const key = o.name.toLowerCase()
    if (source.has(key) || seen.has(key)) continue
    seen.add(key)
    const r = await addServer('claude', specFromConfig(o.name, o.config), scopeFor('claude', scope), project)
    if (r.ok) added++
    else problems.push(`${o.name}: ${r.message}`)
  }
  return { ok: problems.length === 0, message: tm('m.mcp.syncPulled', { added: String(added) }) + (problems.length ? `\n${problems.join('\n')}` : '') }
}

/** Un servidor que difiere en `agent`: `source` deja el agente como la fuente; `agent` pasa a la fuente lo del agente. */
export async function resolveSync(project: string | null, scope: SyncScope, name: string, agent: McpAgent, use: 'source' | 'agent'): Promise<McpResult> {
  const { source, others } = collect(project, scope)
  const from = source.get(name.toLowerCase())
  const other = others.find((o) => o.agent === agent && o.name.toLowerCase() === name.toLowerCase())
  if (!from || !other) return { ok: false, message: tm('m.mcp.syncGone') }
  return use === 'source' ? updateServer(other, specFromConfig(other.name, from.config), project) : updateServer(from, specFromConfig(from.name, other.config), project)
}

/** Los MCP de proyecto que se pueden pasar a `.mcp.json`: los locales de Claude y los que solo están en otros agentes (por nombre). */
function standardizable(project: string | null, { source, others }: ReturnType<typeof collect>): Map<string, { server: McpServer; locals: McpServer[] }> {
  const out = new Map<string, { server: McpServer; locals: McpServer[] }>()
  const locals = listServers(project).filter((s) => s.agent === 'claude' && s.scope === 'project')
  for (const sv of [...locals, ...others]) {
    const key = sv.name.toLowerCase()
    if (source.has(key)) continue
    const prev = out.get(key)
    if (prev) { if (sv.agent === 'claude') prev.locals.push(sv) } else out.set(key, { server: sv, locals: sv.agent === 'claude' ? [sv] : [] })
  }
  return out
}

/** Los MCP que entrega Tutti a OpenCode al arrancarlo: los de `.mcp.json` (lo de OpenCode en el proyecto no se escribe en `opencode.json`). */
export function launchServers(project: string): McpSpec[] {
  return listServers(project).filter((s) => s.agent === 'claude' && s.scope === 'shared').map((s) => specFromConfig(s.name, s.config))
}

const SECRET = /key|token|secret|auth|pass|pwd|credential/i
/** ¿Lleva claves, tokens…? `.mcp.json` se versiona: esos servidores no se mueven. */
function hasSecrets(config: Record<string, unknown>): boolean {
  const maps = [config.env, config.environment, config.headers].filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
  return maps.some((m) => Object.entries(m).some(([k, v]) => SECRET.test(k) && !/^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(String(v))))
}

/** Quita de opencode.json los servidores `names`; si el archivo se queda sin nada más que `$schema`, lo borra. */
export function cleanOpencodeFile(file: string, names: string[]): { removed: number; deleted: boolean } {
  let removed = 0
  for (const name of names) if (removeFromOpencodeFile(file, name)) removed++
  if (!removed) return { removed, deleted: false }
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    const mcp = data.mcp as Record<string, unknown> | undefined
    if (mcp && (Object.keys(mcp).length === 0 || (Object.keys(mcp).length === 1 && mcp.servers && Object.keys(mcp.servers as object).length === 0))) delete data.mcp
    if (Object.keys(data).every((k) => k === '$schema')) { unlinkSync(file); return { removed, deleted: true } }
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  } catch { /* se queda como está */ }
  return { removed, deleted: false }
}

/**
 * Estandarizar los MCP locales del proyecto: los pasa a `.mcp.json` (el estándar compartido) y quita de `opencode.json` los que ya están
 * allí (OpenCode los recibe de `.mcp.json` al abrirlo desde Tutti); si el archivo solo tenía MCP, lo borra. Los que llevan secretos no se
 * mueven (`.mcp.json` se versiona) y los que en `opencode.json` están distintos no se tocan.
 */
export async function standardizeProject(project: string, installed: Installed = installedAgents()): Promise<McpResult> {
  if (!installed('claude')) return { ok: false, message: tm('m.mcp.syncNone') }
  const found = collect(project, 'project')
  const moved: string[] = []
  const secrets: string[] = []
  const problems: string[] = []
  for (const [, { server, locals }] of standardizable(project, found)) {
    if (hasSecrets(server.config)) { secrets.push(server.name); continue }
    const r = await addServer('claude', specFromConfig(server.name, server.config), 'shared', project)
    if (!r.ok) { problems.push(`${server.name}: ${r.message}`); continue }
    moved.push(server.name)
    for (const l of locals) await removeServer(l, project)          // la copia local ya no hace falta: la compartida manda
  }
  // opencode.json: fuera lo que ya está en .mcp.json igual
  const shared = new Map(listServers(project).filter((s) => s.agent === 'claude' && s.scope === 'shared').map((s) => [s.name.toLowerCase(), s]))
  const same: string[] = []
  const differs: string[] = []
  for (const o of listServers(project).filter((s) => s.agent === 'opencode' && s.scope === 'project')) {
    const src = shared.get(o.name.toLowerCase())
    if (!src) continue
    ;(norm(specFromConfig(o.name, o.config)) === norm(specFromConfig(src.name, src.config)) ? same : differs).push(o.name)
  }
  const file = join(project, 'opencode.json')
  const cleaned = existsSync(file) && same.length ? cleanOpencodeFile(file, same) : { removed: 0, deleted: false }
  if (!moved.length && !cleaned.removed && !secrets.length && !problems.length) return { ok: true, message: tm('m.mcp.stdNothing') }
  const parts = [
    moved.length ? tm('m.mcp.stdDone', { count: String(moved.length) }) : '',
    cleaned.deleted ? tm('m.mcp.stdOpencodeDeleted') : cleaned.removed ? tm('m.mcp.stdOpencodeKept', { count: String(cleaned.removed) }) : '',
    differs.length ? tm('m.mcp.stdDiffers', { names: differs.join(', ') }) : '',
    secrets.length ? tm('m.mcp.stdSecrets', { names: secrets.join(', ') }) : '',
    ...problems
  ].filter(Boolean)
  return { ok: problems.length === 0, message: parts.join('\n') }
}
