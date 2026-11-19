/** Lo que Codex trae por su cuenta (prompts, skills y servidores MCP de `~/.codex` y `.codex`): lo que el chat de Codex ofrece en lugar de lo de Claude. */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { tm } from '@/backend/utils/i18n'
import { expandInit, INIT_PROMPT } from '../init'
import type { ChatCommand, ChatItem } from '@/shared/types'

export const codexHome = (): string => process.env.CODEX_HOME || join(homedir(), '.codex')

export const readText = (file: string): string => { try { return readFileSync(file, 'utf8') } catch { return '' } }

/** La descripción del frontmatter (`description:`) de un .md, o la primera línea con texto. */
const describe = (text: string): string => {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? ''
  return (/^description:\s*(.+)$/m.exec(head)?.[1] ?? '').replace(/^["']|["']$/g, '').trim()
}

/** Los prompts personalizados de Codex (`~/.codex/prompts/*.md`): se invocan como `/prompts:nombre`. */
export function codexPrompts(): Array<{ name: string; description: string; hint: string; file: string }> {
  const dir = join(codexHome(), 'prompts')
  try {
    return readdirSync(dir).filter((f) => /\.md$/i.test(f)).sort().map((f) => {
      const text = readText(join(dir, f))
      const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? ''
      return { name: f.replace(/\.md$/i, ''), description: describe(text), hint: /^argument-hint:\s*(.+)$/m.exec(head)?.[1].trim() ?? '', file: join(dir, f) }
    })
  } catch { return [] }
}

/** Los comandos «/» de Codex: sus prompts personalizados. */
/**
 * Los comandos de Codex que el chat sabe cumplir. El SDK no tiene lista de comandos ni ejecuta los «/» del CLI, así que se ofrecen los que se pueden
 * traducir: `/init` y `/review` son prompts que Codex entiende; `/new` y `/clear` los resuelve el panel.
 */
const BUILTIN_PROMPTS: Record<string, string> = {
  init: INIT_PROMPT,
  review: 'Review the current uncommitted changes in this repository (staged, unstaged and untracked files; use git status and git diff). Do not modify anything. Report prioritized, actionable findings: bugs and risky logic first, then missing tests or edge cases, then smaller cleanups. For each one say the file and line, what is wrong and a concrete fix. If everything looks fine, say so.'
}

export const listCodexCommands = (): ChatCommand[] => [
  { name: 'clear', description: tm('chat.cxClear'), hint: '', builtin: true },
  { name: 'new', description: tm('chat.cxNew'), hint: '', builtin: true },
  { name: 'init', description: tm('chat.cxInit'), hint: '', builtin: true },
  { name: 'review', description: tm('chat.cxReview'), hint: tm('chat.cxReviewHint'), builtin: true },
  ...codexPrompts().map((p) => ({ name: `prompts:${p.name}`, description: p.description, hint: p.hint, builtin: false }))
]

/** Si el mensaje empieza por `/prompts:nombre args`, lo cambia por el contenido del prompt (con `$ARGUMENTS` y `$1…$9` resueltos); si no, queda igual. */
export function expandPrompt(text: string): string {
  if (/^\/init(\s|$)/.test(text.trim())) return expandInit(text)
  const own = /^\/(review)(?:\s+([\s\S]*))?$/.exec(text.trim())          // /review: su prompt (y lo que se añada detrás)
  if (own) return `${BUILTIN_PROMPTS[own[1]]}${own[2]?.trim() ? `\n\n${own[2].trim()}` : ''}`
  const m = /^\/prompts:(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim())
  const prompt = m && codexPrompts().find((p) => p.name === m[1])
  if (!m || !prompt) return text
  const args = (m[2] ?? '').trim()
  const parts = args ? args.split(/\s+/) : []
  const body = readText(prompt.file).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  return body.replace(/\$ARGUMENTS/g, args).replace(/\$([1-9])/g, (_, n: string) => parts[Number(n) - 1] ?? '').trim() || text
}

/** Los servidores MCP de `config.toml` (el de usuario y el del proyecto): el nombre y su URL o comando. */
export function codexMcp(project: string | null): ChatItem[] {
  const files: Array<[string, ChatItem['scope']]> = [[join(codexHome(), 'config.toml'), 'global']]
  if (project && existsSync(join(project, '.codex', 'config.toml'))) files.push([join(project, '.codex', 'config.toml'), 'local'])
  const out: ChatItem[] = []
  for (const [file, scope] of files) {
    let current: ChatItem | null = null
    for (const line of readText(file).split(/\r?\n/)) {
      const header = /^\s*\[(.+?)\]\s*$/.exec(line)
      if (header) {
        const server = /^mcp_servers\.(?:"([^"]+)"|([^.\s]+))$/.exec(header[1])
        current = server ? { name: server[1] ?? server[2], description: '', scope } : null          // las subtablas (`.env`…) no abren otro servidor
        if (current && !out.some((i) => i.name === current!.name)) out.push(current)
        continue
      }
      const value = current && /^\s*(url|command)\s*=\s*"([^"]*)"/.exec(line)
      if (current && value && !current.description) current.description = value[2]
    }
  }
  for (const s of projectMcpJson(project)) if (!out.some((i) => i.name === s.name)) out.push({ name: s.name, description: String(s.config.url ?? s.config.command ?? ''), scope: 'local' })          // los del `.mcp.json` del proyecto, como locales
  return out
}

export interface ProjectMcp { name: string; config: Record<string, unknown> }

/** Los servidores del `.mcp.json` del proyecto (el estándar que comparten los agentes), ya en el formato de `mcp_servers` de Codex: `command`/`args`/`env` si son locales, `url` si son remotos. Sin nombre válido para TOML o sin forma de conectarse, se saltan. */
export function projectMcpJson(project: string | null): ProjectMcp[] {
  if (!project) return []
  try {
    const parsed = JSON.parse(readText(join(project, '.mcp.json'))) as { mcpServers?: Record<string, Record<string, unknown>> }
    return Object.entries(parsed.mcpServers ?? {}).flatMap(([name, s]): ProjectMcp[] => {
      if (!/^[\w-]+$/.test(name) || !s || typeof s !== 'object') return []
      const str = (v: unknown): v is string => typeof v === 'string' && v !== ''
      const strings = (o: unknown): Record<string, string> => Object.fromEntries(Object.entries((o && typeof o === 'object' ? o : {}) as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) as Record<string, string>
      if (str(s.url)) return [{ name, config: { url: s.url, ...(Object.keys(strings(s.headers)).length ? { http_headers: strings(s.headers) } : {}) } }]
      if (str(s.command)) return [{ name, config: { command: s.command, ...(Array.isArray(s.args) ? { args: s.args.filter((a): a is string => typeof a === 'string') } : {}), ...(Object.keys(strings(s.env)).length ? { env: strings(s.env) } : {}) } }]
      return []
    })
  } catch { return [] }
}
