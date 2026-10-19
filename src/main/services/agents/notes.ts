/**
 * Pizarra compartida del proyecto: decisiones que afectan a varios agentes (contratos de API, nombres, convenciones).
 * Vive en `.tutti/notes.md`, una entrada por nota, y se versiona con el proyecto.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureProjectDir, tuttiDir } from '../context/context'

export const notesFile = (project: string): string => join(tuttiDir(project), 'notes.md')

const HEADER = '# Notas compartidas\n\nDecisiones que los agentes dejan para los demás (las escriben con post_note).\n\n'
const MAX_NOTE = 4000

/** Una entrada: «- fecha · autor: texto», con las líneas siguientes sangradas para que sigan siendo parte de ella. */
export function formatNote(author: string, text: string, at: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const when = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
  const body = text.trim().slice(0, MAX_NOTE).split('\n').map((l, i) => (i ? `  ${l}` : l)).join('\n')
  return `- ${when} · ${author}: ${body}\n`
}

/** Añade una nota; false si no se pudo escribir (proyecto de solo lectura). */
export function appendNote(project: string, author: string, text: string): boolean {
  try {
    ensureProjectDir(project)
    const file = notesFile(project)
    appendFileSync(file, (existsSync(file) ? '' : HEADER) + formatNote(author, text), 'utf8')
    return true
  } catch { return false }
}

/** Las últimas `limit` notas, de la más antigua a la más reciente. */
export function readNotes(project: string, limit = 30): string[] {
  let text = ''
  try { text = readFileSync(notesFile(project), 'utf8') } catch { return [] }
  const entries: string[] = []
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) entries.push(line.slice(2))
    else if (line.startsWith('  ') && entries.length) entries[entries.length - 1] += `\n${line.slice(2)}`
  }
  return entries.slice(-Math.max(1, limit))
}
