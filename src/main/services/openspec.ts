/**
 * OpenSpec (openspec.dev): las specs de Tutti. El proyecto guarda su carpeta `openspec/`:
 *   config.yaml          el schema, el contexto y las reglas del proyecto
 *   specs/<capacidad>/spec.md     lo que el sistema hace hoy
 *   changes/<cambio>/    un cambio en marcha: proposal.md, design.md, tasks.md y specs/ con lo que cambia (deltas)
 *   changes/archive/     los cambios terminados
 * El estado se lee directamente de esas carpetas (así se ve aunque el CLI no esté instalado); iniciar, validar y archivar los hace el CLI `openspec`.
 */
import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { McpResult, OpenSpecState } from '../../shared/types'
import { tm } from '../utils/i18n'
import { extendedPath, which } from '../utils/shellpath'

const DIR = 'openspec'
export const openspecDir = (project: string): string => join(project, DIR)
const safeName = (name: string): boolean => /^[\w.-]+$/.test(name)

const dirs = (path: string): string[] => {
  try { return readdirSync(path, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() } catch { return [] }
}
const read = (path: string): string => { try { return readFileSync(path, 'utf8') } catch { return '' } }

/** Casillas de un tasks.md: hechas y total. */
export function taskCounts(text: string): { done: number; total: number } {
  const all = text.match(/^\s*[-*]\s+\[[ xX]\]/gm) ?? []
  return { done: all.filter((l) => /\[[xX]\]/.test(l)).length, total: all.length }
}

/** Cuántos «### Requirement:» tiene una spec. */
export const requirementCount = (text: string): number => (text.match(/^###\s+Requirement:/gm) ?? []).length

/** El schema que declara config.yaml (`schema: spec-driven`), o '' si no lo dice. */
export const schemaOf = (config: string): string => /^schema:\s*['"]?([\w.-]+)/m.exec(config)?.[1] ?? ''

export function openspecState(project: string): OpenSpecState {
  const root = openspecDir(project)
  const configFile = join(root, 'config.yaml')
  const initialized = existsSync(root)
  const changesDir = join(root, 'changes')
  return {
    installed: !!process.env.TUTTI_CAPTURE || which('openspec') !== null,          // en las capturas se da por instalado, para no fotografiar el aviso
    initialized,
    configFile,
    schema: schemaOf(read(configFile)),
    changes: dirs(changesDir).filter((n) => n !== 'archive').map((name) => {
      const dir = join(changesDir, name)
      const { done, total } = taskCounts(read(join(dir, 'tasks.md')))
      return { name, dir, done, total, hasProposal: existsSync(join(dir, 'proposal.md')), hasDesign: existsSync(join(dir, 'design.md')), hasTasks: existsSync(join(dir, 'tasks.md')) }
    }),
    archived: dirs(join(changesDir, 'archive')).length,
    specs: dirs(join(root, 'specs')).map((name) => ({ name, file: join(root, 'specs', name, 'spec.md'), requirements: requirementCount(read(join(root, 'specs', name, 'spec.md'))) }))
  }
}

/** Ejecuta el CLI en la raíz del proyecto. `message` lleva su salida (o su error). */
function run(project: string, args: string[]): Promise<McpResult> {
  const bin = which('openspec')
  if (!bin) return Promise.resolve({ ok: false, message: tm('m.os.missing') })
  return new Promise((resolve) => {
    execFile(bin, args, { cwd: project, timeout: 60_000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', env: { ...process.env, PATH: extendedPath(), NO_COLOR: '1', CI: '1' } }, (err, out, stderr) => {
      const text = `${out ?? ''}${stderr ? `\n${stderr}` : ''}`.trim()
      resolve(err ? { ok: false, message: text || err.message } : { ok: true, message: text })
    })
  })
}

/** Crea `openspec/` sin instalar skills de ningún agente: Tutti le pasa el trabajo al agente abierto con sus propios prompts. */
export const initOpenspec = (project: string): Promise<McpResult> => run(project, ['init', '--tools', 'none', '--no-animation'])
export const validateOpenspec = (project: string, change?: string): Promise<McpResult> =>
  change && !safeName(change) ? Promise.resolve({ ok: false, message: tm('m.fs.badName') }) : run(project, change ? ['validate', change, '--strict'] : ['validate', '--all'])
export const archiveOpenspec = (project: string, change: string): Promise<McpResult> =>
  safeName(change) ? run(project, ['archive', change, '--yes']) : Promise.resolve({ ok: false, message: tm('m.fs.badName') })
