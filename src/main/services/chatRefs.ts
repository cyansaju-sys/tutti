/**
 * Las referencias «#» del chat que no son un archivo: los cambios sin confirmar, un commit, la rama, un spec, el roadmap, las guías de .tutti, el
 * contexto, los hooks, una terminal o un trozo de código. `list` ofrece las que tienen opciones y `resolve` da el texto que se adjunta al mensaje.
 */
import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve as resolvePath, sep } from 'node:path'
import type { ChatRefOption, ChatRefs } from '../../shared/types'
import { extendedPath } from '../utils/shellpath'
import { GIT_EXCLUDE, isSensitive } from './sensitive'
import { screenText, sessionList } from './agents/pty'
import { contextSources } from './context/context'
import { hooksDir } from './hooks'
import { roadmapFile } from './roadmap'
import { openspecDir } from './openspec'

export const MAX_SECTION = 60_000            // bytes de una referencia
/** Los nombres que no son rutas: `#cambios`, `#commit:abc1234`… (un archivo con uno de esos nombres se cita con `#./nombre`). */
export const SPECIAL = new Set(['cambios', 'rama', 'roadmap', 'contexto', 'hooks', 'commit', 'spec', 'steering', 'skill', 'doc', 'terminal', 'sel'])
const SAFE = /^[\w.@+-]+(?:\/[\w.@+-]+)*$/             // un nombre o una ruta relativa sin «..»

const git = (root: string, args: string[]): Promise<string> =>
  new Promise((done) => {
    execFile('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 15000, env: { ...process.env, PATH: extendedPath(), LC_ALL: 'C' } }, (err, out) => done(err ? '' : out))
  })
const read = (file: string, max = MAX_SECTION): string => { try { return readFileSync(file).subarray(0, max).toString('utf8') } catch { return '' } }
const names = (dir: string): string[] => { try { return readdirSync(dir).sort() } catch { return [] } }
const isDir = (p: string): boolean => { try { return statSync(p).isDirectory() } catch { return false } }
const cap = (text: string, max = MAX_SECTION): string => (text.length > max ? `${text.slice(0, max)}\n… (truncated)` : text)
const tutti = (project: string, ...parts: string[]): string => join(project, '.tutti', ...parts)

function markdownFiles(dir: string, rel = '', depth = 1): string[] {
  const out: string[] = []
  for (const n of names(dir)) {
    if (n.startsWith('.')) continue
    if (isDir(join(dir, n))) { if (depth < 3) out.push(...markdownFiles(join(dir, n), `${rel}${n}/`, depth + 1)) }
    else if (/\.md$/i.test(n)) out.push(`${rel}${n}`)
  }
  return out
}

/** Las opciones de cada referencia que se elige de una lista. */
export async function listRefs(project: string): Promise<ChatRefs> {
  const log = await git(project, ['log', '-n30', '--format=%h%x1f%s%x1f%an'])
  const commit: ChatRefOption[] = log.split('\n').filter(Boolean).map((l) => { const [id, subject, author] = l.split('\x1f'); return { id, label: id, hint: `${subject} · ${author}` } })
  const changes = join(openspecDir(project), 'changes')
  const spec = names(changes).filter((n) => n !== 'archive' && isDir(join(changes, n))).map((n) => ({ id: n, label: n, hint: '' }))
  const steering = names(tutti(project, 'steering')).filter((n) => /\.md$/i.test(n)).map((n) => ({ id: n, label: n, hint: '' }))
  const skill = names(tutti(project, 'skills')).filter((n) => existsSync(tutti(project, 'skills', n, 'SKILL.md'))).map((n) => ({ id: n, label: n, hint: '' }))
  const doc = markdownFiles(tutti(project, 'docs')).map((n) => ({ id: n, label: n, hint: '' }))
  const terminal = sessionList().map((s) => ({ id: s.id, label: s.name, hint: s.kind === 'agent' ? s.command : '' }))
  return { commit, spec, steering, skill, doc, terminal, roadmap: existsSync(roadmapFile(project)), hooks: names(hooksDir(project)).some((n) => n.endsWith('.json')) }
}

async function baseBranch(project: string): Promise<string> {
  for (const b of ['origin/master', 'origin/main', 'master', 'main']) if ((await git(project, ['rev-parse', '--verify', '--quiet', b])).trim()) return b
  return ''
}

/** Dentro de una carpeta del proyecto: el archivo `rel` si existe y no sale de ella. */
function inside(base: string, rel: string): string | null {
  const dir = resolvePath(base)
  const abs = resolvePath(dir, rel)
  return abs.startsWith(dir + sep) && existsSync(abs) ? abs : null
}

/** El texto que se adjunta para `#kind` o `#kind:value`, o null si no existe o no es válido. */
export async function resolve(project: string, kind: string, value: string, inline: Record<string, string> = {}): Promise<{ title: string; body: string } | null> {
  const safe = (v: string): boolean => SAFE.test(v) && !v.split('/').includes('..')
  switch (kind) {
    case 'cambios': {
      const head = await git(project, ['rev-parse', '--verify', '--quiet', 'HEAD'])
      const diff = head.trim() ? await git(project, ['diff', 'HEAD', '--', '.', ...GIT_EXCLUDE]) : (await git(project, ['diff', '--cached', '--', '.', ...GIT_EXCLUDE])) + (await git(project, ['diff', '--', '.', ...GIT_EXCLUDE]))
      const untracked = (await git(project, ['ls-files', '--others', '--exclude-standard'])).split('\n').filter((f) => f && !isSensitive(f)).join('\n')
      if (!diff.trim() && !untracked) return { title: 'uncommitted changes', body: '(no changes)' }
      return { title: 'uncommitted changes', body: cap(`${diff}${untracked ? `\nNew files (untracked):\n${untracked}` : ''}`) }
    }
    case 'commit': {
      if (!/^[0-9a-f]{7,40}$/.test(value)) return null
      const out = await git(project, ['show', '--stat', '--patch', '--no-color', value, '--', '.', ...GIT_EXCLUDE])
      return out ? { title: `commit ${value}`, body: cap(out) } : null
    }
    case 'rama': {
      const base = await baseBranch(project)
      if (!base) return null
      const mergeBase = (await git(project, ['merge-base', base, 'HEAD'])).trim()
      if (!mergeBase) return null
      const commits = await git(project, ['log', '--oneline', `${mergeBase}..HEAD`])
      const diff = await git(project, ['diff', `${mergeBase}...HEAD`, '--', '.', ...GIT_EXCLUDE])
      return { title: `branch changes since ${base}`, body: cap(`Commits:\n${commits}\n${diff}`) }
    }
    case 'spec': {
      if (!safe(value)) return null
      const dir = inside(join(openspecDir(project), 'changes'), value)
      if (!dir || !isDir(dir)) return null
      const files = ['proposal.md', 'design.md', 'tasks.md', ...markdownFiles(join(dir, 'specs')).map((f) => `specs/${f}`)].filter((f) => existsSync(join(dir, f)))
      return { title: `OpenSpec change ${value}`, body: cap(files.map((f) => `## ${f}\n${read(join(dir, f), 20_000)}`).join('\n\n')) }
    }
    case 'roadmap': { const text = read(roadmapFile(project)); return text ? { title: 'roadmap', body: cap(text) } : null }
    case 'steering': case 'doc': {
      if (!safe(value)) return null
      const file = inside(tutti(project, kind === 'steering' ? 'steering' : 'docs'), value)
      return file && statSync(file).isFile() ? { title: `${kind} ${value}`, body: cap(read(file)) } : null
    }
    case 'skill': {
      if (!safe(value) || value.includes('/')) return null
      const file = inside(tutti(project, 'skills'), `${value}/SKILL.md`)
      return file ? { title: `skill ${value}`, body: cap(read(file)) } : null
    }
    case 'contexto': {
      const parts = contextSources(project).filter((s) => s.kind !== 'global').map((s) => `## ${s.name}\n${read(s.file, 20_000)}`)
      return parts.length ? { title: 'project context', body: cap(parts.join('\n\n')) } : null
    }
    case 'hooks': {
      const files = names(hooksDir(project)).filter((n) => n.endsWith('.json'))
      return files.length ? { title: 'hooks', body: cap(files.map((f) => `## ${f}\n${read(join(hooksDir(project), f), 10_000)}`).join('\n\n')) } : null
    }
    case 'terminal': {
      const session = sessionList().find((s) => s.id === value)
      const out = session ? screenText(value, 120) : ''
      return session ? { title: `terminal ${session.name}`, body: out || '(empty)' } : null
    }
    case 'sel': {                  // sel:ruta:inicio-fin
      const m = /^(.+):(\d+)-(\d+)$/.exec(value)
      if (!m || !safe(m[1]) || isSensitive(m[1])) return null
      const file = inside(project, m[1])
      if (!file || !statSync(file).isFile()) return null
      const from = Number(m[2]), to = Math.min(Number(m[3]), from + 400)
      const typed = inline[`sel:${value}`]          // lo seleccionado tal como estaba en el editor (con lo que aún no se guardó)
      const lines = (typed ?? read(file, 2_000_000)).split('\n').slice(typed === undefined ? from - 1 : 0, typed === undefined ? to : to - from + 1)
      return { title: `${basename(m[1])} lines ${from}-${to}`, body: lines.map((l, i) => `${from + i}: ${l}`).join('\n') }
    }
    default: return null
  }
}
