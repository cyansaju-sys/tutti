/**
 * AGENTS.md (el estándar que leen Codex, OpenCode, Cursor, Copilot y otros) apuntando a `.tutti/`: un bloque marcado que lista lo que
 * hay en la carpeta, para que cualquier agente —abierto desde Tutti o no— sepa dónde mirar. El bloque es lo único que Tutti toca; el resto
 * del archivo es del usuario. Es un puntero: no copia contenido, así que no hay nada que se desfase salvo la lista.
 */
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { AgentsPointerState, McpResult } from '../../../shared/types'
import { tm } from '../../utils/i18n'
import { roadmapFile } from '../roadmap'

export const AGENTS_START = '<!-- tutti:start -->'
export const AGENTS_END = '<!-- tutti:end -->'
const BLOCK = new RegExp(`${AGENTS_START}[\\s\\S]*?${AGENTS_END}\\n?`)
const MAX_LISTED = 8

const agentsPath = (project: string): string => join(project, 'AGENTS.md')

/** El texto sin el bloque de Tutti (lo demás es lo que el usuario escribió). */
export const stripAgentsBlock = (text: string): string => text.replace(BLOCK, '')

const ls = (dir: string): string[] => { try { return readdirSync(dir).sort() } catch { return [] } }
const isDir = (p: string): boolean => { try { return statSync(p).isDirectory() } catch { return false } }
const some = (names: string[]): string => (names.length > MAX_LISTED ? `${names.slice(0, MAX_LISTED).join(', ')}…` : names.join(', '))

/** El bloque con lo que ahora hay en el proyecto: solo lista las carpetas que existen. */
export function agentsBlock(project: string): string {
  const tutti = join(project, '.tutti')
  const steering = ls(join(tutti, 'steering')).filter((f) => f.toLowerCase().endsWith('.md'))
  const skills = ls(join(tutti, 'skills')).filter((d) => isDir(join(tutti, 'skills', d)))
  const lines = [
    tm('m.ctx.agentsHead'), '',
    tm('m.ctx.agentsLead'), '',
    ...(steering.length ? [tm('m.ctx.agentsSteering', { files: some(steering) })] : []),
    ...(existsSync(roadmapFile(project)) ? [tm('m.ctx.agentsRoadmap', { file: relative(project, roadmapFile(project)).split('\\').join('/') })] : []),
    ...(isDir(join(project, 'openspec')) ? [tm('m.ctx.agentsSpecs')] : []),
    ...(ls(join(tutti, 'docs')).length ? [tm('m.ctx.agentsDocs')] : []),
    ...(skills.length ? [tm('m.ctx.agentsSkills', { names: some(skills) })] : []),
    tm('m.ctx.agentsReadme')
  ]
  return `${AGENTS_START}\n${lines.join('\n')}\n${AGENTS_END}\n`
}

export function agentsPointerState(project: string): AgentsPointerState {
  const file = agentsPath(project)
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch { /* no existe */ }
  const exists = existsSync(file)
  const hasBlock = BLOCK.test(text)
  return { file, exists, hasBlock, upToDate: hasBlock && text.match(BLOCK)![0] === agentsBlock(project), ownContent: stripAgentsBlock(text).trim() !== '' }
}

/** Crea AGENTS.md con el bloque, o lo añade/actualiza si el archivo ya existe (sin tocar el resto). La ruta va en `message`. */
export function writeAgentsPointer(project: string): McpResult {
  const file = agentsPath(project)
  const block = agentsBlock(project)
  try {
    const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
    const next = BLOCK.test(text) ? text.replace(BLOCK, () => block) : text.trim() ? `${text.replace(/\s+$/, '')}\n\n${block}` : block
    if (next !== text) writeFileSync(file, next, 'utf8')
    return { ok: true, message: file }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

/** Quita el bloque; si el archivo se queda vacío, lo borra. */
export function removeAgentsPointer(project: string): McpResult {
  const file = agentsPath(project)
  try {
    if (!existsSync(file)) return { ok: true, message: file }
    const rest = stripAgentsBlock(readFileSync(file, 'utf8')).replace(/\s+$/, '')
    if (rest) writeFileSync(file, rest + '\n', 'utf8')
    else unlinkSync(file)
    return { ok: true, message: file }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}
