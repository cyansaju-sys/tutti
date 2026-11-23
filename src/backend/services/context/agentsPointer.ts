/**
 * AGENTS.md (el estándar que leen Codex, OpenCode, Cursor, Copilot y otros) apuntando a la carpeta de configuración (`.tutti` o `.agents`): un bloque
 * marcado que solo la nombra y remite a su README, para que cualquier agente sepa dónde mirar. El bloque es lo único que Tutti toca; el resto
 * del archivo es del usuario. Es un puntero: no copia ni lista contenido, así que no hay nada que se desfase.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentsPointerState, McpResult } from '@/shared/types'
import { tuttiDirName } from './context'
import { tm } from '@/backend/utils/i18n'

export const AGENTS_START = '<!-- tutti:start -->'
export const AGENTS_END = '<!-- tutti:end -->'
const BLOCK = new RegExp(`${AGENTS_START}[\\s\\S]*?${AGENTS_END}\\n?`)

const agentsPath = (project: string): string => join(project, 'AGENTS.md')

/** El texto sin el bloque de Tutti (lo demás es lo que el usuario escribió). */
export const stripAgentsBlock = (text: string): string => text.replace(BLOCK, '')

/** El bloque: solo apunta a la carpeta de configuración (`.tutti` o `.agents`, la que use el proyecto) y a su README, sin listar lo que hay dentro. */
export function agentsBlock(project: string): string {
  const dir = tuttiDirName(project)
  const lines = [
    tm('m.ctx.agentsHead'), '',
    tm('m.ctx.agentsLead', { dir }),
    '', tm('m.ctx.agentsReadme', { dir })
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
