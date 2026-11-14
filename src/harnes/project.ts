/** Lo que el proyecto trae para el chat, leído de `.tutti` o, si el proyecto usa esa, de `.agents`: skills, hooks y servidores MCP. */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ChatItem, ChatProjectItems } from '@/shared/types'
import { tuttiDir } from '@/main/services/context/context'
import { loadHooks } from '@/main/services/hooks'
import { listServers } from '@/main/services/mcp/mcp'
import { listPowers } from '@/main/services/powers'
import { specsState } from '@/main/services/specs'
import { roadmapState } from '@/main/services/roadmap'
import { listRoles } from '@/main/services/context/roles'
import { globalSteeringDir } from '@/main/services/context/context'
import { loadSteering } from '@/main/services/context/steering'

/** La descripción del frontmatter de un SKILL.md (`description: ...`), o '' si no la tiene. */
const describeSkill = (file: string): string => {
  try {
    const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, 'utf8'))?.[1] ?? ''
    return /^description:\s*(.+)$/m.exec(head)?.[1].replace(/^["']|["']$/g, '').trim() ?? ''
  } catch { return '' }
}

/** Las skills (carpetas con SKILL.md) de una carpeta, ordenadas por nombre. */
function skillsIn(root: string, scope: ChatItem['scope']): ChatItem[] {
  try {
    return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() || d.isSymbolicLink()).flatMap((d) => {
      try {
        const file = readdirSync(join(root, d.name)).find((n) => n.toLowerCase() === 'skill.md')
        return file ? [{ name: d.name, description: describeSkill(join(root, d.name, file)), scope }] : []
      } catch { return [] }
    }).sort((a, b) => a.name.localeCompare(b.name))
  } catch { return [] }
}

/** Las del proyecto (.tutti o .agents) y, aparte, las globales del usuario. */
const skillsOf = (project: string): ChatItem[] => [
  ...skillsIn(join(tuttiDir(project), 'skills'), 'local'),
  ...skillsIn(join(homedir(), '.claude', 'skills'), 'global'),
  ...skillsIn(join(homedir(), '.agents', 'skills'), 'global')
]

const hooksOf = (project: string): ChatItem[] => loadHooks(project).filter((h) => !h.error).map((h) => ({ name: h.name, description: h.description || h.trigger, scope: 'local' as const }))

function mcpOf(project: string): ChatItem[] {
  const own = listServers(project).filter((s) => !(s.scope === 'global' && s.name.toLowerCase() === 'tutti')).map((s) => ({ name: s.name, description: s.target, scope: s.scope === 'global' ? 'global' as const : 'local' as const }))
  const powers = listPowers(project).filter((p) => p.scope === 'project').flatMap((p) => p.mcp.map((m) => ({ name: m.name, description: p.name, scope: 'local' as const })))
  const seen = new Set<string>()
  return [...own, ...powers].filter((i) => !seen.has(i.name) && !!seen.add(i.name))
}

/** Los roles de `<.tutti|.agents>/roles`: el nombre y su título (o, si no tiene, el agente y la dificultad). */
const rolesOf = (project: string): ChatItem[] => listRoles(project).map((r) => ({ name: r.name, description: r.title !== r.name ? r.title : [r.agent, r.difficulty].filter(Boolean).join(' · '), scope: 'local' as const }))

const steeringOf = (project: string): ChatItem[] =>
  loadSteering(project, { globalDir: globalSteeringDir() }).map((d) => ({ name: d.base, description: d.description, scope: d.scope === 'global' ? 'global' as const : 'local' as const }))

const powersOf = (project: string): ChatItem[] => listPowers(project).filter((p) => !p.error).map((p) => ({ name: p.name, description: p.description, scope: p.scope === 'global' ? 'global' as const : 'local' as const }))

/** Las specs de `<.tutti|.agents>/specs`, con el avance de sus tareas. */
function specsOf(project: string): ChatItem[] {
  try { return specsState(project).specs.map((sp) => ({ name: sp.name, description: sp.total ? `${sp.done}/${sp.total}` : '', scope: 'local' as const })) } catch { return [] }
}

/** Los ítems del roadmap (.tutti/roadmap.md): el cambio al que apuntan o su texto, con su fase. */
function roadmapOf(project: string): ChatItem[] {
  try {
    return roadmapState(project).phases.flatMap((p) => p.items.map((it) => ({ name: (it.change ?? it.text).slice(0, 80), description: `${p.title} · ${it.status}`, scope: 'local' as const })))
  } catch { return [] }
}

export function projectItems(project: string | null): ChatProjectItems {
  if (!project || !existsSync(project)) return { skills: [], hooks: [], mcp: [], roles: [], steering: [], powers: [], specs: [], roadmap: [] }
  return { skills: skillsOf(project), hooks: hooksOf(project), mcp: mcpOf(project), roles: rolesOf(project), steering: steeringOf(project), powers: powersOf(project), specs: specsOf(project), roadmap: roadmapOf(project) }
}
