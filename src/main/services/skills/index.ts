/** Importar una skill que ya tienes en otra carpeta (una con su SKILL.md) a .tutti/skills del proyecto, sin pisar nada. */
import { cpSync, existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { McpResult } from '../../../shared/types'
import { tm } from '../../utils/i18n'

const MAX_FILES = 200
const MAX_BYTES = 5 * 1024 * 1024
const SKIP = new Set(['.git', 'node_modules'])

/** Cuántos archivos y bytes tiene la carpeta (sin .git ni node_modules): una skill es pequeña, y así no se copia por error medio disco. */
function measure(dir: string): { files: number; bytes: number } {
  let files = 0, bytes = 0
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (SKIP.has(name) || files > MAX_FILES || bytes > MAX_BYTES) continue
      const p = join(d, name)
      const info = statSync(p)
      if (info.isDirectory()) walk(p)
      else { files++; bytes += info.size }
    }
  }
  walk(dir)
  return { files, bytes }
}

/** Copia la carpeta de una skill a `.tutti/skills/<nombre>`. Devuelve el SKILL.md nuevo en `message`. */
export function importSkill(project: string, source: string): McpResult {
  const src = resolve(source)
  try {
    if (!statSync(src).isDirectory()) return { ok: false, message: tm('m.skill.notDir') }
    const skillFile = readdirSync(src).find((n) => n.toLowerCase() === 'skill.md')
    if (!skillFile) return { ok: false, message: tm('m.skill.noSkillMd', { name: basename(src) }) }
    const { files, bytes } = measure(src)
    if (files > MAX_FILES || bytes > MAX_BYTES) return { ok: false, message: tm('m.skill.tooBig', { name: basename(src) }) }
    const target = join(project, '.tutti', 'skills', basename(src))
    if (resolve(target) === src || src.startsWith(resolve(project, '.tutti', 'skills') + '/')) return { ok: false, message: tm('m.skill.already') }
    if (existsSync(target)) return { ok: false, message: tm('m.fs.exists', { name: basename(src) }) }
    cpSync(src, target, { recursive: true, filter: (from) => !SKIP.has(basename(from)) })
    return { ok: true, message: join(target, skillFile) }
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) } }
}
