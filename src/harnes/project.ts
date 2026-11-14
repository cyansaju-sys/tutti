/** Lo que el proyecto trae para el chat, leído de `.tutti` o, si el proyecto usa esa, de `.agents`: skills, hooks y servidores MCP. */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ChatItem, ChatProjectItems } from '@/shared/types'
import { tuttiDir } from '@/main/services/context/context'
import { loadHooks } from '@/main/services/hooks'
import { listServers } from '@/main/services/mcp/mcp'
import { listPowers } from '@/main/services/powers'

/** La descripción del frontmatter de un SKILL.md (`description: ...`), o '' si no la tiene. */
const describeSkill = (file: string): string => {
  try {
    const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, 'utf8'))?.[1] ?? ''
    return /^description:\s*(.+)$/m.exec(head)?.[1].replace(/^["']|["']$/g, '').trim() ?? ''
  } catch { return '' }
}

function skillsOf(project: string): ChatItem[] {
  const root = join(tuttiDir(project), 'skills')
  try {
    return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => {
      const file = readdirSync(join(root, d.name)).find((n) => n.toLowerCase() === 'skill.md')
      return file ? [{ name: d.name, description: describeSkill(join(root, d.name, file)) }] : []
    }).sort((a, b) => a.name.localeCompare(b.name))
  } catch { return [] }
}

const hooksOf = (project: string): ChatItem[] => loadHooks(project).filter((h) => !h.error).map((h) => ({ name: h.name, description: h.description || h.trigger }))

function mcpOf(project: string): ChatItem[] {
  const own = listServers(project).filter((s) => s.scope === 'project').map((s) => ({ name: s.name, description: s.target }))
  const powers = listPowers(project).filter((p) => p.scope === 'project').flatMap((p) => p.mcp.map((m) => ({ name: m.name, description: p.name })))
  const seen = new Set<string>()
  return [...own, ...powers].filter((i) => !seen.has(i.name) && !!seen.add(i.name))
}

export function projectItems(project: string | null): ChatProjectItems {
  if (!project || !existsSync(project)) return { skills: [], hooks: [], mcp: [] }
  return { skills: skillsOf(project), hooks: hooksOf(project), mcp: mcpOf(project) }
}
