/** Los roles del proyecto: archivos .md de `.tutti/roles` (o `.agents/roles`) con una cabecera (name, difficulty, depends-on, agent, model) y secciones. */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { tuttiDir } from './context'

export interface RoleSummary {
  name: string; title: string; difficulty: string; depends_on: string[]; agent: string; model: string
  specialty: string; deliverable: string; description: string; file: string
}

/** Un rol a partir de su archivo: la cabecera da difficulty, depends-on, agent y model; las tres secciones `##`, por orden, su especialidad, entregable y descripción. */
export function parseRole(name: string, text: string, file = ''): RoleSummary {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? ''
  const key = (k: string): string => new RegExp(`^${k}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(head)?.[1] ?? ''
  const body = head ? text.slice(text.indexOf('---', 3) + 3) : text
  const [, ...sections] = body.split(/^## .*$/m)
  const nth = (i: number): string => (sections[i] ?? '').trim()
  return {
    name, title: /^# (.*)$/m.exec(body)?.[1]?.trim() || name, difficulty: key('difficulty'),
    depends_on: [...new Set(key('depends-on').split(',').map((d) => d.trim()).filter((d) => d && d !== name))],
    agent: key('agent'), model: key('model'), specialty: nth(0), deliverable: nth(1), description: nth(2), file
  }
}

/** Los roles de una carpeta, por nombre; vacío si no existe. */
function rolesIn(dir: string): RoleSummary[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => /\.md$/i.test(f)).sort().map((f) => {
    let text = ''
    try { text = readFileSync(join(dir, f), 'utf8') } catch { /* ilegible: se lista vacío */ }
    return parseRole(f.replace(/\.md$/i, ''), text, join(dir, f))
  })
}

/** Los roles del proyecto, por nombre; vacío si no hay carpeta de roles. */
export function listRoles(project: string): RoleSummary[] {
  return rolesIn(join(tuttiDir(project), 'roles'))
}

/** Los roles personales, válidos en todos los proyectos: `~/.agents/roles` y `~/.tutti/roles` (si un nombre está en las dos, gana `.tutti`). */
export function listGlobalRoles(home: string = homedir()): RoleSummary[] {
  const byName = new Map<string, RoleSummary>()
  for (const dir of ['.agents', '.tutti']) for (const r of rolesIn(join(home, dir, 'roles'))) byName.set(r.name, r)
  return [...byName.values()]
}

/** Los alias de modelo (o ids completos) que entiende Claude; el modelo de un rol puede ser de otro agente y entonces se ignora. */
const CLAUDE_MODEL = /^(sonnet|opus|haiku|fable|inherit|claude-[\w.-]+)$/i

/**
 * Los roles como subagentes de Claude (la opción `agents` del SDK): los globales y los del proyecto, y si un nombre se repite gana el del
 * proyecto. Se omiten los roles que piden otro agente (`agent: opencode`…): solo cuentan los que no fijan agente o fijan Claude.
 */
export function roleSubagents(project: string | null, home: string = homedir()): Record<string, { description: string; prompt: string; model?: string }> {
  const byName = new Map<string, RoleSummary>()
  for (const r of [...listGlobalRoles(home), ...(project ? listRoles(project) : [])]) byName.set(r.name, r)
  const out: Record<string, { description: string; prompt: string; model?: string }> = {}
  for (const r of byName.values()) {
    if (r.agent && !/claude/i.test(r.agent)) continue
    const name = r.name.trim().replace(/\s+/g, '-')
    if (!name) continue
    const prompt = [`# ${r.title}`, r.specialty && `## Especialidad\n${r.specialty}`, r.deliverable && `## Entregable\n${r.deliverable}`, r.description && `## Descripción\n${r.description}`].filter(Boolean).join('\n\n')
    out[name] = {
      description: `Rol «${r.title}»${r.specialty ? `: ${r.specialty.replace(/\s+/g, ' ').slice(0, 240)}` : ''}`,
      prompt,
      model: CLAUDE_MODEL.test(r.model) ? r.model : undefined
    }
  }
  return out
}
