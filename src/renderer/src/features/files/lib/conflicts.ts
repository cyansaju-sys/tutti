/** Un conflicto de git dentro de un archivo: las líneas entre `<<<<<<<` y `>>>>>>>`, con las dos versiones. */
export interface Conflict { start: number; mid: number; end: number; current: string[]; incoming: string[]; currentLabel: string; incomingLabel: string }
export type Choice = 'current' | 'incoming' | 'both'

/** Busca los bloques de conflicto (también con la sección `|||||||` del ancestro, que se ignora). */
export function findConflicts(text: string): Conflict[] {
  if (!text.includes('<<<<<<<')) return []
  const lines = text.split('\n')
  const out: Conflict[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!/^<<<<<<<( |$)/.test(lines[i])) continue
    const c: Conflict = { start: i, mid: -1, end: -1, current: [], incoming: [], currentLabel: lines[i].slice(8).trim(), incomingLabel: '' }
    let part: 'current' | 'base' | 'incoming' = 'current'
    let j = i + 1
    for (; j < lines.length; j++) {
      const l = lines[j].replace(/\r$/, '')
      if (/^\|\|\|\|\|\|\|( |$)/.test(l)) { part = 'base'; continue }
      if (/^={7}$/.test(l)) { part = 'incoming'; c.mid = j; continue }
      if (/^>>>>>>>( |$)/.test(l)) { c.end = j; c.incomingLabel = l.slice(8).trim(); break }
      if (part === 'current') c.current.push(lines[j])
      else if (part === 'incoming') c.incoming.push(lines[j])
    }
    if (c.end < 0 || c.mid < 0) break
    out.push(c)
    i = c.end
  }
  return out
}

/** El texto con ese conflicto resuelto como se elija. */
export function resolveConflict(text: string, conflict: Conflict, choice: Choice): string {
  const lines = text.split('\n')
  const keep = choice === 'current' ? conflict.current : choice === 'incoming' ? conflict.incoming : [...conflict.current, ...conflict.incoming]
  lines.splice(conflict.start, conflict.end - conflict.start + 1, ...keep)
  return lines.join('\n')
}
