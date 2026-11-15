/** Las menciones «#tipo:nombre» del chat convertidas en instrucciones: a cada una se le añade al mensaje dónde leer lo que nombra. */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative } from 'node:path'
import { globalSteeringDir, tuttiDir } from '@/backend/services/context/context'
import { listRoles } from '@/backend/services/context/roles'
import { loadSteering } from '@/backend/services/context/steering'
import { loadHooks } from '@/backend/services/hooks'
import { listPowers, powerSummaries } from '@/backend/services/powers'
import { roadmapState } from '@/backend/services/roadmap'

const TOKEN = /(?:^|\s)#(role|spec|road|doc|diff|hook|steering|power|skill|mcp|file|dir):(\S+)/g

const MAX_DIFF = 20_000

/** El diff de los cambios sin confirmar (de un archivo o de todos) para pegarlo en el mensaje; recortado si es enorme. */
function diffOf(project: string, name: string): string | null {
  const git = (args: string[]): string => execFileSync('git', args, { cwd: project, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 15_000 })
  try {
    const head = (() => { try { git(['rev-parse', '--verify', 'HEAD']); return ['HEAD'] } catch { return [] as string[] } })()          // sin commits todavía: se compara con el índice
    const target = name === 'all' ? [] : ['--', name]
    let text = git(['diff', ...head, ...target]).trim()
    if (!text && name !== 'all') text = `(archivo nuevo sin seguimiento: léelo en ${name})`
    if (!text) return null
    return text.length > MAX_DIFF ? `${text.slice(0, MAX_DIFF)}\n… (recortado; ejecuta git diff para ver el resto)` : text
  } catch { return null }
}

/** Una instrucción por mención (o null si no se encuentra lo que nombra). `rel` da la ruta relativa al proyecto cuando está dentro. */
function describe(project: string, kind: string, name: string): string | null {
  const rel = (p: string): string => { const r = relative(project, p); return r && !r.startsWith('..') ? r : p }
  const norm = (s: string): string => s.replace(/\s+/g, '_').toLowerCase()
  switch (kind) {
    case 'role': { const r = listRoles(project).find((x) => x.name === name); return r ? `Rol «${r.name}»: lee ${rel(r.file)} y trabaja según ese rol.` : null }
    case 'spec': {
      const dir = join(tuttiDir(project), 'specs', name)
      return existsSync(dir) ? `Spec «${name}»: está en ${rel(dir)} (requirements.md, design.md y tasks.md); léelos antes de actuar y marca las tareas de tasks.md al terminarlas.` : null
    }
    case 'road': {
      const rm = roadmapState(project)
      const item = rm.phases.flatMap((p) => p.items.map((it) => ({ p, it }))).find(({ it }) => norm((it.change ?? it.text).slice(0, 80)) === norm(name))
      return item ? `Ítem del roadmap «${item.it.text}» (fase «${item.p.title}», ${item.it.status}); el roadmap está en ${rm.rel}${item.it.change ? ` y su spec en ${rel(join(tuttiDir(project), 'specs', item.it.change))}` : ''}.` : null
    }
    case 'doc': {
      const file = join(tuttiDir(project), 'docs', `${name}.md`)
      return existsSync(file) ? `Documento «${name}»: lee ${rel(file)} y úsalo como referencia.` : null
    }
    case 'diff': {
      const diff = diffOf(project, name)
      return diff ? `Cambios sin confirmar${name === 'all' ? '' : ` de ${name}`} (git diff):\n\`\`\`diff\n${diff}\n\`\`\`` : null
    }
    case 'hook': { const h = loadHooks(project).find((x) => x.name === name); return h ? `Hook «${h.name}»: su definición está en ${rel(h.file)}.` : null }
    case 'steering': { const d = loadSteering(project, { globalDir: globalSteeringDir() }).find((x) => x.base === name); return d ? `Steering «${d.base}»: lee ${rel(d.file)} y sigue sus indicaciones.` : null }
    case 'power': { const p = listPowers(project).find((x) => x.name === name); return p ? `Power «${p.name}»: está en ${rel(p.dir)}; revisa lo que trae y úsalo.` : null }
    case 'skill': {
      const dirs = [join(tuttiDir(project), 'skills'), join(homedir(), '.claude', 'skills'), join(homedir(), '.agents', 'skills')]
      const dir = dirs.map((d) => join(d, name)).find((d) => existsSync(d))
      return dir ? `Skill «${name}»: está en ${rel(dir)}; léela (SKILL.md) y aplícala.` : null
    }
    case 'mcp': return `Servidor MCP «${name}»: usa sus herramientas (mcp__${name}__*) para esta tarea.`
    case 'file': return `Archivo ${name}: léelo.`
    case 'dir': return `Carpeta ${name}: revisa su contenido.`
    default: return null
  }
}

/** El mensaje con un bloque final que explica cada mención; sin menciones (o sin proyecto) queda igual. */
export function expandMentions(project: string | null, text: string): string {
  if (!project) return text
  const lines: string[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(TOKEN)) {
    const key = `${m[1]}:${m[2]}`
    if (seen.has(key)) continue
    seen.add(key)
    try { const line = describe(project, m[1], m[2]); if (line) lines.push(`- ${line}`) } catch { /* si no se puede resolver, la mención queda como texto */ }
  }
  // los Powers que encajan con lo pedido (por sus palabras clave, nombre y descripción) se ofrecen solos, sin tener que mencionarlos ni pasar por el MCP
  try {
    for (const p of powerSummaries(project, text.replace(TOKEN, ' ')).filter((x) => x.matches).slice(0, 3)) {
      if (seen.has(`power:${p.name}`)) continue
      const dir = listPowers(project).find((x) => x.name === p.name)?.dir
      if (dir) lines.push(`- Power «${p.name}» (${p.description || 'sin descripción'}) parece relevante: está en ${relative(project, dir).startsWith('..') ? dir : relative(project, dir)}; léelo (POWER.md y lo que trae) solo si de verdad lo necesitas.`)
    }
  } catch { /* sin Powers legibles: nada que ofrecer */ }
  return lines.length ? `${text}\n\n---\nReferencias del proyecto:\n${lines.join('\n')}` : text
}
