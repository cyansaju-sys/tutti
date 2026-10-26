/**
 * Los «/comandos» de cada agente que se guardan como archivos (los de proyecto y los del usuario). Un agente en modo no interactivo no los
 * resuelve él, así que Tutti los lista para el chat y, al enviar, sustituye el comando por su texto.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, extname, join } from 'node:path'
import type { SlashCommand } from '../../shared/types'
import { tm } from '../utils/i18n'

type Format = 'md' | 'toml'
interface Place { dir: string; format: Format; skills?: boolean }
/** Comandos de Tutti para el chat: funcionan con cualquier agente porque son un texto que se le envía (solo lectura). Los de archivo con su mismo nombre ganan. */
const TUTTI_COMMANDS = ['review', 'security-review', 'explain']
const MAX_COMMANDS = 200
const MAX_DEPTH = 3

/** Dónde busca cada agente: carpetas del proyecto y del usuario. */
function places(command: string, project: string | null): Array<Place & { source: SlashCommand['source'] }> {
  const home = homedir()
  const both = (rel: string[], place: Place): Array<Place & { source: SlashCommand['source'] }> => [
    ...(project ? [{ ...place, dir: join(project, ...rel), source: 'project' as const }] : []),
    { ...place, dir: join(home, ...rel), source: 'user' as const }
  ]
  switch (command) {
    case 'claude': return [...both(['.claude', 'commands'], { dir: '', format: 'md' }), ...both(['.claude', 'skills'], { dir: '', format: 'md', skills: true })]
    case 'opencode': return [
      ...both(['.opencode', 'command'], { dir: '', format: 'md' }), ...both(['.opencode', 'commands'], { dir: '', format: 'md' }),
      { dir: join(home, '.config', 'opencode', 'command'), format: 'md', source: 'user' }, { dir: join(home, '.config', 'opencode', 'commands'), format: 'md', source: 'user' }
    ]
    case 'gemini': return both(['.gemini', 'commands'], { dir: '', format: 'toml' })
    case 'codex': return [{ dir: join(home, '.codex', 'prompts'), format: 'md', source: 'user' }]
    default: return []
  }
}

const isDir = (p: string): boolean => { try { return statSync(p).isDirectory() } catch { return false } }
const field = (text: string, key: string): string => {
  const m = new RegExp(`^${key}\\s*[:=]\\s*(?:"([^"]*)"|'([^']*)'|(.+))$`, 'm').exec(text)
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim()
}
const frontmatter = (text: string): { head: string; body: string } => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  return m ? { head: m[1], body: text.slice(m[0].length) } : { head: '', body: text }
}

function walk(dir: string, rel: string[], depth: number, format: Format, out: Array<{ name: string; file: string }>): void {
  let names: string[] = []
  try { names = readdirSync(dir).sort() } catch { return }
  for (const n of names) {
    if (out.length >= MAX_COMMANDS || n.startsWith('.')) continue
    const path = join(dir, n)
    if (isDir(path)) { if (depth < MAX_DEPTH) walk(path, [...rel, n], depth + 1, format, out) }
    else if (extname(n).toLowerCase() === `.${format}`) out.push({ name: [...rel, basename(n, extname(n))].join(':'), file: path })
  }
}

/** Lo que dice un archivo de comando: su descripción y su texto. */
function parse(file: string, format: Format): { description: string; body: string } {
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch { return { description: '', body: '' } }
  if (format === 'toml') {
    const prompt = /^prompt\s*=\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)'''|"((?:[^"\\]|\\.)*)")/m.exec(text)
    return { description: field(text, 'description'), body: (prompt?.[1] ?? prompt?.[2] ?? prompt?.[3] ?? '').trim() }
  }
  const { head, body } = frontmatter(text)
  const firstLine = body.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim() ?? ''
  return { description: field(head, 'description') || firstLine.slice(0, 120), body: body.trim() }
}

export function slashCommands(project: string | null, command: string): SlashCommand[] {
  const found = new Map<string, SlashCommand>()
  for (const place of places(command, project)) {
    if (!existsSync(place.dir)) continue
    const entries: Array<{ name: string; file: string }> = []
    if (place.skills) {
      for (const d of readdirSync(place.dir).sort()) { const file = join(place.dir, d, 'SKILL.md'); if (existsSync(file)) entries.push({ name: d, file }) }
    } else walk(place.dir, [], 1, place.format, entries)
    for (const e of entries) {
      const name = command === 'codex' ? `prompts:${e.name}` : e.name
      if (!found.has(name)) found.set(name, { name, description: parse(e.file, place.format).description, source: place.source, file: e.file })      // el del proyecto gana al del usuario
    }
  }
  for (const name of TUTTI_COMMANDS) if (!found.has(name)) found.set(name, { name, description: tm(`m.chat.cmd.${name}.desc` as never), source: 'builtin', file: '' })
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}


/** «/comando argumentos» -> el texto del comando con sus argumentos puestos; si no es un comando conocido, el mensaje tal cual. */
export function expandSlash(project: string | null, command: string, text: string): string {
  const m = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim())
  if (!m) return text
  const found = slashCommands(project, command).find((c) => c.name === m[1])
  if (!found) return text
  if (!found.file) return tm(`m.chat.cmd.${found.name}.prompt` as never, { args: (m[2] ?? '').trim() })      // uno de Tutti: su texto con lo que se escribió detrás
  const format: Format = command === 'gemini' ? 'toml' : 'md'
  const args = (m[2] ?? '').trim()
  const { body } = parse(found.file, format)
  if (!body) return text
  const words = args.split(/\s+/).filter(Boolean)
  const used = /\$ARGUMENTS|\{\{args\}\}|\$[1-9]/.test(body)
  const filled = body.replace(/\$ARGUMENTS|\{\{args\}\}/g, args).replace(/\$([1-9])/g, (_s, n: string) => words[Number(n) - 1] ?? '')
  return used || !args ? filled : `${filled}\n\nARGUMENTS: ${args}`
}
