/**
 * Powers al estilo de Kiro: una carpeta con POWER.md (cabecera con name, description y keywords) que puede traer, además, mcp.json (servidores
 * MCP), steering/, skills/ y hooks/. Viven en .tutti/powers (del proyecto) o en la configuración de Tutti (de todos tus proyectos).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import type { McpAgent, McpResult, McpServer, McpSpec, PowerDraft, PowerInfo, PowerScope, PowerSources } from '../../../shared/types'
import { tm } from '../../utils/i18n'
import { configDir, globalSteeringDir } from '../context/context'
import { loadSteering, parseSteering } from '../context/steering'
import { hooksDir } from '../hooks'
import { isObject } from '../mcp/files'
import { specFromConfig } from '../mcp/manage'
import { probeSpec } from '../mcp/probe'
import { listServers, NAME_RE, removeServer, validate } from '../mcp/mcp'
import { MAX_BYTES, MAX_FILES, measure, SKIP } from '../skills'

export const globalPowersDir = (): string => join(configDir(), 'powers')
const powersDir = (project: string | null, scope: PowerScope): string | null => (scope === 'global' ? globalPowersDir() : project ? join(project, '.tutti', 'powers') : null)

const findFile = (dir: string, name: string): string | undefined => { try { return readdirSync(dir).find((n) => n.toLowerCase() === name) } catch { return undefined } }
const listDir = (dir: string, only?: (name: string) => boolean): string[] => { try { return readdirSync(dir).filter((n) => !n.startsWith('.') && (!only || only(n))).sort() } catch { return [] } }

/** `keywords: a, b` o `keywords: [a, b]` de la cabecera: con qué palabras del prompt vale la pena cargar el Power. */
function keywordsOf(raw: string): string[] {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)
  const line = m && /^keywords:\s*(.*)$/m.exec(m[1])
  if (!line) return []
  return line[1].replace(/^\[|\]$/g, '').split(',').map((k) => k.trim().replace(/^(['"])(.*)\1$/, '$2')).filter(Boolean)
}

/** Los servidores de mcp.json (formato `mcpServers`, como el de Claude Code y Kiro). Lanza si el archivo o alguno de ellos no vale. */
function readMcp(file: string): McpSpec[] {
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'))
  const servers = isObject(data) && isObject(data.mcpServers) ? data.mcpServers : null
  if (!servers) throw new Error('mcpServers')
  return Object.entries(servers).map(([name, config]) => {
    const spec = specFromConfig(name, isObject(config) ? config : {})
    const invalid = validate(spec)
    if (invalid) throw new Error(`${name}: ${invalid}`)
    return spec
  })
}

/** Lee la carpeta de un Power. Si no es válido, `error` dice por qué (y el resto va vacío). */
export function parsePower(dir: string, scope: PowerScope): PowerInfo {
  const fallback = basename(dir)
  const empty: PowerInfo = { name: fallback, description: '', keywords: [], scope, dir, mcp: [], steering: [], skills: [], hooks: [] }
  const md = findFile(dir, 'power.md')
  if (!md) return { ...empty, error: tm('m.power.noPowerMd', { name: fallback }) }
  const raw = readFileSync(join(dir, md), 'utf8')
  const head = parseSteering(join(dir, md), raw)
  const name = head.name === 'POWER' || head.name === 'power' ? fallback : head.name
  if (!NAME_RE.test(name)) return { ...empty, error: tm('m.power.badName') }
  let mcp: McpSpec[] = []
  const mcpFile = findFile(dir, 'mcp.json')
  if (mcpFile) { try { mcp = readMcp(join(dir, mcpFile)) } catch (e) { return { ...empty, name, error: tm('m.power.badMcp', { name, message: e instanceof Error ? e.message : String(e) }) } } }
  return {
    ...empty, name, description: head.description, keywords: keywordsOf(raw), mcp,
    steering: listDir(join(dir, 'steering'), (n) => n.toLowerCase().endsWith('.md')),
    skills: listDir(join(dir, 'skills'), (n) => !!findFile(join(dir, 'skills', n), 'skill.md')),
    hooks: listDir(join(dir, 'hooks'))
  }
}

/** Los Powers instalados: los del proyecto (si hay) y los globales; si se llaman igual, manda el del proyecto. */
export function listPowers(project: string | null): PowerInfo[] {
  const read = (scope: PowerScope): PowerInfo[] => {
    const root = powersDir(project, scope)
    if (!root) return []
    return listDir(root, (n) => { try { return statSync(join(root, n)).isDirectory() } catch { return false } }).map((n) => parsePower(join(root, n), scope))
  }
  const mine = read('project')
  const names = new Set(mine.map((p) => p.name))
  return [...mine, ...read('global').filter((p) => !names.has(p.name))]
}

/** Copia la carpeta de un Power a su sitio (`<alcance>/<nombre>`) sin pisar nada. El destino nuevo va en `message`. */
export function installPower(project: string | null, source: string, scope: PowerScope): McpResult {
  const src = resolve(source)
  const root = powersDir(project, scope)
  if (!root) return { ok: false, message: tm('m.power.needProject') }
  try {
    if (!statSync(src).isDirectory()) return { ok: false, message: tm('m.power.notDir') }
    const power = parsePower(src, scope)
    if (power.error) return { ok: false, message: power.error }
    const { files, bytes } = measure(src)
    if (files > MAX_FILES || bytes > MAX_BYTES) return { ok: false, message: tm('m.power.tooBig', { name: power.name }) }
    const target = join(root, power.name)
    if (resolve(target) === src || src.startsWith(resolve(root) + sep)) return { ok: false, message: tm('m.power.already') }
    if (existsSync(target)) return { ok: false, message: tm('m.fs.exists', { name: power.name }) }
    cpSync(src, target, { recursive: true, filter: (from) => !SKIP.has(basename(from)) })
    return { ok: true, message: target }
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) } }
}

export function removePower(project: string | null, name: string, scope: PowerScope): McpResult {
  const root = powersDir(project, scope)
  const power = root && NAME_RE.test(name) ? listPowers(project).find((p) => p.name === name && p.scope === scope) : undefined
  if (!power) return { ok: false, message: tm('m.power.notFound', { name }) }
  try { rmSync(power.dir, { recursive: true, force: true }); return { ok: true, message: power.dir } } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) } }
}

// ---- crear un Power con lo que ya tienes ----

const skillsDir = (project: string): string => join(project, '.tutti', 'skills')
/** El servidor «tutti» que la app registra en los agentes no es tuyo: no se empaqueta. */
const isAppServer = (s: { name: string; scope: string }): boolean => s.scope === 'global' && s.name.toLowerCase() === 'tutti'
const blank = (o: Record<string, string> | undefined, keep: boolean): Record<string, string> => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, keep ? v : '']))

/** La entrada de mcp.json de un servidor. Sin `withValues`, las variables y cabeceras quedan con su nombre pero vacías (suelen llevar tokens). */
export function mcpEntry(spec: McpSpec, withValues: boolean): Record<string, unknown> {
  if (spec.kind === 'remote') {
    const headers = blank(spec.headers, withValues)
    return { ...(spec.transport === 'sse' ? { type: 'sse' } : {}), url: spec.url, ...(Object.keys(headers).length ? { headers } : {}) }
  }
  const env = blank(spec.env, withValues)
  return { command: spec.command, ...(spec.args?.length ? { args: spec.args } : {}), ...(Object.keys(env).length ? { env } : {}) }
}

/** Lo que se puede meter en un Power nuevo: los MCP (uno por nombre), los steering, las skills y los hooks que tienes. */
export function powerSources(project: string | null): PowerSources {
  const seen = new Map<string, McpAgent[]>()
  for (const s of listServers(project)) {
    if (isAppServer(s) || s.disabled) continue
    seen.set(s.name, [...(seen.get(s.name) ?? []), s.agent])
  }
  const steering = project ? loadSteering(project, { globalDir: globalSteeringDir() }) : []
  return {
    mcp: [...seen].map(([name, agents]) => ({ name, agents })).sort((a, b) => a.name.localeCompare(b.name)),
    steering: steering.map((d) => ({ id: `${d.scope}:${d.base}`, name: d.name, scope: d.scope })),
    skills: project ? listDir(skillsDir(project), (n) => !!findFile(join(skillsDir(project), n), 'skill.md')) : [],
    hooks: project ? listDir(hooksDir(project)) : []
  }
}

const oneLine = (v: string): string => v.replace(/\s+/g, ' ').replace(/"/g, "'").trim()

/**
 * Crea la carpeta de un Power con lo elegido. Steering, skills y hooks se copian (lo original se queda); los MCP que estaban en `.mcp.json` se
 * mueven: se quitan de allí (y del espejo de Antigravity y Codex) para que los agentes no los carguen siempre. Como salen de ese archivo, se
 * guardan con sus valores reales (no hay otra copia); los demás MCP respetan `withValues`. El destino va en `message`.
 */
export async function createPower(project: string | null, draft: PowerDraft): Promise<McpResult> {
  const name = draft.name.trim()
  if (!NAME_RE.test(name)) return { ok: false, message: tm('m.power.badName') }
  const root = powersDir(project, draft.scope)
  if (!root) return { ok: false, message: tm('m.power.needProject') }
  if (!draft.mcp.length && !draft.steering.length && !draft.skills.length && !draft.hooks.length) return { ok: false, message: tm('m.power.empty') }
  const target = join(root, name)
  if (existsSync(target)) return { ok: false, message: tm('m.fs.exists', { name }) }
  const moved: McpServer[] = []          // los de .mcp.json, que se quitan al final
  try {
    const sources = powerSources(project)
    const pick = <T>(wanted: string[], all: T[], key: (x: T) => string): T[] => all.filter((x) => wanted.includes(key(x)))      // solo lo que existe: nunca una ruta que venga de fuera
    mkdirSync(target, { recursive: true })
    const isShared = (s: McpServer): boolean => s.agent === 'claude' && s.scope === 'shared'
    const servers = new Map<string, McpServer>()
    for (const s of listServers(project).filter((x) => !isAppServer(x) && !x.disabled)) if (!servers.has(s.name) || (isShared(s) && !isShared(servers.get(s.name)!))) servers.set(s.name, s)          // si está en .mcp.json, esa es la entrada
    const chosen = pick(draft.mcp, sources.mcp, (x) => x.name).map((x) => servers.get(x.name)!)
    moved.push(...chosen.filter(isShared))
    if (chosen.length) writeFileSync(join(target, 'mcp.json'), JSON.stringify({ mcpServers: Object.fromEntries(chosen.map((s) => [s.name, mcpEntry(specFromConfig(s.name, s.config, s.agent), draft.withValues || isShared(s))])) }, null, 2) + '\n', 'utf8')
    const steering = project ? loadSteering(project, { globalDir: globalSteeringDir() }) : []
    for (const x of pick(draft.steering, sources.steering, (x) => x.id)) {
      const doc = steering.find((d) => `${d.scope}:${d.base}` === x.id)
      if (doc) { mkdirSync(join(target, 'steering'), { recursive: true }); cpSync(doc.file, join(target, 'steering', doc.base)) }
    }
    for (const n of pick(draft.skills, sources.skills, (x) => x)) {
      const { files, bytes } = measure(join(skillsDir(project!), n))
      if (files > MAX_FILES || bytes > MAX_BYTES) throw new Error(tm('m.power.tooBig', { name: n }))
      cpSync(join(skillsDir(project!), n), join(target, 'skills', n), { recursive: true, filter: (from) => !SKIP.has(basename(from)) })
    }
    for (const n of pick(draft.hooks, sources.hooks, (x) => x)) cpSync(join(hooksDir(project!), n), join(target, 'hooks', n), { recursive: true })
    const keywords = draft.keywords.map((k) => oneLine(k)).filter(Boolean)
    const head = ['---', `name: ${name}`, `description: "${oneLine(draft.description)}"`, ...(keywords.length ? [`keywords: [${keywords.map((k) => `"${k}"`).join(', ')}]`] : []), '---', '', `# ${name}`, '', oneLine(draft.description)]
    writeFileSync(join(target, 'POWER.md'), head.join('\n').trimEnd() + '\n', 'utf8')
  } catch (e) {
    rmSync(target, { recursive: true, force: true })
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
  for (const s of moved) {          // el Power ya está escrito: ahora sí se quitan de .mcp.json
    const removed = await removeServer(s, project)
    if (!removed.ok) return { ok: false, message: tm('m.power.notRemoved', { name: s.name, message: removed.message }) }
  }
  return { ok: true, message: target }
}

// ---- carga bajo demanda: lo que ven los agentes por el servidor MCP de la app ----

/** Una línea por Power: lo único que los agentes ven siempre. */
export function powerSummaries(project: string | null): Array<{ name: string; description: string; keywords: string[] }> {
  return listPowers(project).filter((p) => !p.error).map((p) => ({ name: p.name, description: p.description, keywords: p.keywords }))
}

/** La guía de un Power y lo que trae, y las herramientas de sus MCP (se arrancan solo ahora, para preguntarles y se cierran). */
export async function powerGuide(project: string | null, name: string): Promise<{ ok: boolean; info: unknown }> {
  const power = listPowers(project).find((p) => p.name.toLowerCase() === name.toLowerCase() && !p.error)
  if (!power) return { ok: false, info: tm('m.power.notFound', { name }) }
  const file = findFile(power.dir, 'power.md')
  const guide = file ? parseSteering(join(power.dir, file), readFileSync(join(power.dir, file), 'utf8')).body : ''
  const at = (sub: string, names: string[]): string[] => names.map((n) => join(power.dir, sub, n))
  const servers = await Promise.all(power.mcp.map(async (spec) => {
    const probe = await probeSpec(spec, 20_000, project ?? undefined)
    return { name: spec.name, tools: probe.ok ? probe.tools : [], ...(probe.ok ? {} : { error: probe.message }) }
  }))
  return { ok: true, info: { name: power.name, guide, steering: at('steering', power.steering), skills: at('skills', power.skills), mcp: servers } }
}
