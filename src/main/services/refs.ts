/** «#archivo» y «#carpeta» en el chat: se listan los del proyecto para elegirlos y, al enviar, se adjunta al mensaje su contenido (o su lista). */
import { execFile } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import type { ChatRefPreview, ProjectRef } from '../../shared/types'
import { extendedPath } from '../utils/shellpath'
import { resolve as resolveSpecial, SPECIAL } from './chatRefs'
import { isSensitive } from './sensitive'

const SKIP = new Set(['node_modules', 'dist', 'out', 'build', 'target', 'release', 'coverage', '__pycache__', 'venv', 'vendor'])
const MAX_REFS = 20000
const MAX_FILE = 40_000                // bytes de un archivo que se adjuntan
const MAX_TOTAL = 120_000              // bytes de todo lo adjunto a un mensaje
const MAX_LISTED = 150

const gitFiles = (root: string): Promise<string[] | null> =>
  new Promise((done) => {
    execFile('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 15000, env: { ...process.env, PATH: extendedPath() } },
      (err, out) => done(err ? null : out.split('\0').filter(Boolean)))
  })

function walkFiles(root: string): string[] {
  const out: string[] = []
  const visit = (dir: string, rel: string): void => {
    let names: string[] = []
    try { names = readdirSync(dir).sort() } catch { return }
    for (const n of names) {
      if (out.length >= MAX_REFS || n.startsWith('.') || SKIP.has(n)) continue
      let isDir = false
      try { isDir = statSync(join(dir, n)).isDirectory() } catch { continue }
      if (isDir) visit(join(dir, n), `${rel}${n}/`); else out.push(`${rel}${n}`)
    }
  }
  visit(root, '')
  return out
}

/** Los archivos del proyecto (sin lo del .gitignore) y las carpetas que los contienen; las carpetas acaban en «/». */
export async function listRefs(root: string): Promise<ProjectRef[]> {
  const files = ((await gitFiles(root)) ?? walkFiles(root)).filter((f) => !isSensitive(f)).slice(0, MAX_REFS)
  const dirs = new Set<string>()
  for (const f of files) {
    const parts = f.split('/')
    for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join('/')}/`)
  }
  return [...[...dirs].sort().map((path) => ({ path, isDir: true })), ...files.sort().map((path) => ({ path, isDir: false }))]
}

function listDir(dir: string, rel: string, depth: number, out: string[]): void {
  let names: string[] = []
  try { names = readdirSync(dir).sort() } catch { return }
  for (const n of names) {
    if (out.length >= MAX_LISTED) return
    if (n.startsWith('.') || SKIP.has(n)) continue
    let isDir = false
    try { isDir = statSync(join(dir, n)).isDirectory() } catch { continue }
    out.push(`${rel}${n}${isDir ? '/' : ''}`)
    if (isDir && depth < 2) listDir(join(dir, n), `${rel}${n}/`, depth + 1, out)
  }
}

interface Section { token: string; title: string; body: string; note: ChatRefPreview['note'] }

/** Cada «#algo» del texto resuelto: su contenido y cómo quedó (completo, recortado, bloqueado…). */
async function sections(root: string, text: string, inline: Record<string, string>): Promise<Section[]> {
  const base = resolve(root)
  const seen = new Set<string>()
  const out: Section[] = []
  let total = 0
  for (const m of text.matchAll(/(?:^|\s)#([^\s#]+)/g)) {
    const rel = m[1].replace(/[.,;:!?)\]]+$/, '').replace(/\/+$/, '')
    if (!rel || seen.has(rel)) continue
    seen.add(rel)
    const colon = rel.indexOf(':')
    const kind = colon < 0 ? rel : rel.slice(0, colon)
    if (SPECIAL.has(kind)) {            // «#cambios», «#commit:abc1234»…: no son rutas
      const found = await resolveSpecial(root, kind, colon < 0 ? '' : rel.slice(colon + 1), inline)
      if (found) out.push({ token: rel, title: found.title, body: found.body, note: found.body.endsWith('(truncated)') ? 'truncated' : 'ok' })
      continue
    }
    const abs = resolve(base, rel.replace(/^\.\//, ''))
    if (abs === base || !abs.startsWith(base + sep)) continue            // solo lo que está dentro del proyecto
    let stat
    try { stat = statSync(abs) } catch { continue }
    if (stat.isDirectory()) {
      const names: string[] = []
      listDir(abs, '', 1, names)
      const partial = names.length >= MAX_LISTED
      out.push({ token: `${rel}/`, title: `folder${partial ? ' (partial list)' : ''}`, body: names.join('\n'), note: partial ? 'partial' : 'ok' })
    } else if (stat.isFile()) {
      if (isSensitive(rel)) { out.push({ token: rel, title: 'not attached: it looks like it holds secrets', body: '', note: 'blocked' }); continue }
      let content = ''
      try { content = readFileSync(abs).subarray(0, Math.min(MAX_FILE, Math.max(0, MAX_TOTAL - total))).toString('utf8') } catch { continue }
      if (content.includes('\0')) out.push({ token: rel, title: 'binary file, not attached', body: '', note: 'binary' })
      else { total += content.length; const cut = stat.size > content.length; out.push({ token: rel, title: `file${cut ? ', truncated' : ''}`, body: content, note: cut ? 'truncated' : 'ok' }) }
    }
  }
  return out
}

/** Solo lo que se adjunta (el bloque que va tras el mensaje), o '' si no cita nada. */
export async function collectRefs(root: string, text: string, inline: Record<string, string> = {}): Promise<string> {
  const found = await sections(root, text, inline)
  return found.length ? `\n\nReferenced from the project:\n\n${found.map((x) => `--- #${x.token} (${x.title}) ---${x.body ? `\n${x.body}` : ''}`).join('\n\n')}` : ''
}

/** Lo que adjuntaría cada referencia del texto (tamaño y estado), sin devolver el contenido. */
export async function previewRefs(root: string, text: string, inline: Record<string, string> = {}): Promise<ChatRefPreview[]> {
  return (await sections(root, text, inline)).map((x) => ({ token: x.token, chars: x.body.length, note: x.note }))
}

/** El mensaje con lo que cita adjunto tras él. */
export const attachRefs = async (root: string, text: string): Promise<string> => text + await collectRefs(root, text)
