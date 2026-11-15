/** Los roles del proyecto: archivos .md de `.tutti/roles` (o `.agents/roles`) con una cabecera (name, difficulty, depends-on, agent, model) y secciones. */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

/** Los roles del proyecto, por nombre; vacío si no hay carpeta de roles. */
export function listRoles(project: string): RoleSummary[] {
  const dir = join(tuttiDir(project), 'roles')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => /\.md$/i.test(f)).sort().map((f) => {
    let text = ''
    try { text = readFileSync(join(dir, f), 'utf8') } catch { /* ilegible: se lista vacío */ }
    return parseRole(f.replace(/\.md$/i, ''), text, join(dir, f))
  })
}
