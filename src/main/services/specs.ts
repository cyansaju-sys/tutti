/**
 * Las specs de Tutti, en el formato de Kiro. Cada una es una carpeta de `.tutti/specs/` (o `.agents/specs/`):
 *   requirements.md   qué debe hacer (requisitos con criterios de aceptación)
 *   design.md         cómo se va a hacer
 *   tasks.md          las tareas, como casillas «- [ ]» que el agente va marcando
 * El estado se lee directamente de esas carpetas: no hace falta ningún programa externo.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { SpecsState } from '@/shared/types'
import { tuttiDir } from './context/context'

export const specsDir = (project: string): string => join(tuttiDir(project), 'specs')

const dirs = (path: string): string[] => {
  try { return readdirSync(path, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() } catch { return [] }
}
const read = (path: string): string => { try { return readFileSync(path, 'utf8') } catch { return '' } }

/** Casillas de un tasks.md: hechas y total. */
export function taskCounts(text: string): { done: number; total: number } {
  const all = text.match(/^\s*[-*]\s+\[[ xX]\]/gm) ?? []
  return { done: all.filter((l) => /\[[xX]\]/.test(l)).length, total: all.length }
}

export function specsState(project: string): SpecsState {
  const root = specsDir(project)
  return {
    dir: root,
    rel: relative(project, root).split('\\').join('/'),
    specs: dirs(root).map((name) => {
      const dir = join(root, name)
      const { done, total } = taskCounts(read(join(dir, 'tasks.md')))
      return { name, dir, done, total, hasRequirements: existsSync(join(dir, 'requirements.md')), hasDesign: existsSync(join(dir, 'design.md')), hasTasks: existsSync(join(dir, 'tasks.md')) }
    })
  }
}
