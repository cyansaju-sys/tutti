/**
 * Steering al estilo de Kiro: archivos Markdown de .tutti/steering con una cabecera opcional que dice cuándo se entregan al agente.
 *   inclusion: always (por defecto) · fileMatch (+ fileMatchPattern) · manual · auto (+ name y description)
 * `always` va entero; `fileMatch` va entero si hay cambios en archivos que coinciden con el patrón, y si no, solo se lista; `manual` y `auto` se
 * listan con su ruta para que el agente las lea cuando apliquen. Las referencias `#[[file:ruta]]`, `#[[file:ruta:12-28]]` y `#[[folder:ruta]]` se
 * sustituyen por el contenido real del proyecto (nunca fuera de él).
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'
import { tm } from '../../utils/i18n'
import { extendedPath } from '../../utils/shellpath'
import { globsToRegex } from '../search'

export type Inclusion = 'always' | 'fileMatch' | 'manual' | 'auto'
export interface Steering { file: string; base: string; name: string; inclusion: Inclusion; patterns: string[]; description: string; body: string }

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
const MAX_REF_CHARS = 20_000

const unquote = (v: string): string => v.trim().replace(/^(['"])(.*)\1$/, '$2')

/** La cabecera (YAML sencillo: `clave: valor`, con `fileMatchPattern` como texto o como lista) y el cuerpo del archivo. */
export function parseSteering(file: string, raw: string): Steering {
  const base = basename(file)
  const m = FRONT.exec(raw)
  const fields: Record<string, string> = {}
  if (m) for (const line of m[1].split('\n')) { const kv = /^([\w-]+):\s*(.*)$/.exec(line.trim()); if (kv) fields[kv[1]] = kv[2] }
  const mode = unquote(fields.inclusion ?? '')
  const inclusion: Inclusion = mode === 'fileMatch' || mode === 'manual' || mode === 'auto' ? mode : 'always'          // sin cabecera, siempre (como Kiro)
  let patterns: string[] = []
  const pat = (fields.fileMatchPattern ?? '').trim()
  if (pat.startsWith('[')) { try { patterns = (JSON.parse(pat.replace(/'/g, '"')) as unknown[]).filter((p): p is string => typeof p === 'string') } catch { patterns = [] } }
  else if (pat) patterns = [unquote(pat)]
  return { file, base, name: unquote(fields.name ?? '') || base.replace(/\.md$/i, ''), inclusion, patterns, description: unquote(fields.description ?? ''), body: (m ? raw.slice(m[0].length) : raw).trim() }
}

/** Los archivos de steering del proyecto (todos los .md de .tutti/steering menos el contexto del proyecto, que va aparte). */
export function loadSteering(project: string, skip = 'contexto.md'): Steering[] {
  const dir = join(project, '.tutti', 'steering')
  let names: string[] = []
  try { names = readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.md') && n !== skip).sort() } catch { return [] }
  const out: Steering[] = []
  for (const n of names) { try { out.push(parseSteering(join(dir, n), readFileSync(join(dir, n), 'utf8'))) } catch { /* ilegible: se omite */ } }
  return out
}

/** Los archivos con cambios sin guardar en git (modificados o nuevos): «los archivos en los que se está trabajando». */
export function changedFiles(project: string): string[] {
  try {
    const out = execFileSync('git', ['status', '--porcelain=v1', '-z', '-uall'], { cwd: project, encoding: 'utf8', timeout: 4000, env: { ...process.env, PATH: extendedPath() }, stdio: ['ignore', 'pipe', 'ignore'] })
    return out.split('\0').filter((e) => e.length > 3).map((e) => e.slice(3))
  } catch { return [] }
}

/** Sustituye `#[[file:…]]` y `#[[folder:…]]` por lo que hay en el proyecto; lo que no se puede leer queda marcado, no se esconde. */
export function resolveRefs(text: string, project: string): string {
  const root = resolve(project)
  return text.replace(/#\[\[(file|folder):([^\]]+)\]\]/g, (_all, kind: string, spec: string) => {
    const range = kind === 'file' ? /^(.*):(\d+)(?:-(\d+))?$/.exec(spec) : null
    const rel = range ? range[1] : spec
    const abs = resolve(root, rel)
    if (abs !== root && !abs.startsWith(root + sep)) return `[${tm('m.ctx.refOutside', { path: rel })}]`
    try {
      if (kind === 'folder') {
        const names = readdirSync(abs).sort().map((n) => `- ${n}${statSync(join(abs, n)).isDirectory() ? '/' : ''}`)
        return `\n${rel}/\n${names.join('\n')}\n`
      }
      let content = readFileSync(abs, 'utf8')
      if (range) { const from = Number(range[2]), to = Number(range[3] ?? range[2]); content = content.split('\n').slice(from - 1, to).join('\n') }
      return `\n\`\`\`\n// ${rel}${range ? `:${range[2]}${range[3] ? `-${range[3]}` : ''}` : ''}\n${content.slice(0, MAX_REF_CHARS)}\n\`\`\`\n`
    } catch { return `[${tm('m.ctx.refMissing', { path: rel })}]` }
  })
}

export interface SteeringPart { doc: Steering; delivered: 'full' | 'index'; chars: number }

/** Qué parte de cada archivo se entrega y el texto resultante: los completos, y debajo la lista de guías disponibles. */
export function assembleSteering(project: string, docs: Steering[], changed: string[]): { text: string; parts: SteeringPart[] } {
  const full: string[] = []
  const index: Array<{ doc: Steering; line: string }> = []
  const parts: SteeringPart[] = []
  for (const doc of docs) {
    const matched = doc.inclusion === 'fileMatch' && doc.patterns.length > 0 && globsToRegex(doc.patterns.join(',')).some((re) => changed.some((f) => re.test(f.split(sep).join('/'))))
    if (doc.inclusion === 'always' || matched) {
      const body = resolveRefs(doc.body, project)
      if (!body) continue
      full.push(body); parts.push({ doc, delivered: 'full', chars: body.length })
    } else {
      const where = relative(project, doc.file).split(sep).join('/')
      const note = doc.inclusion === 'fileMatch' ? ` [${doc.patterns.join(', ')}]` : ''
      const line = `- ${doc.name}${doc.description ? `: ${doc.description}` : ''}${note} (${where})`
      index.push({ doc, line }); parts.push({ doc, delivered: 'index', chars: line.length })
    }
  }
  const guides = index.length ? `${tm('m.ctx.guides')}\n${index.map((i) => i.line).join('\n')}` : ''
  return { text: [...full, guides].filter(Boolean).join('\n\n'), parts }
}
