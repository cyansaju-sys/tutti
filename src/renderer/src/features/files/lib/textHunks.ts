export interface TextHunk {
  beforeStart: number
  beforeLines: string[]
  afterStart: number
  afterLines: string[]
}

const lines = (text: string): string[] => text.split('\n')

/** Tramos contiguos que cambiaron entre dos textos, con posiciones 0-based. */
export function textHunks(before: string, after: string): TextHunk[] {
  const a = lines(before), b = lines(after)
  if (a.length * b.length > 4_000_000) return [{ beforeStart: 0, beforeLines: a, afterStart: 0, afterLines: b }]
  const table = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const hunks: TextHunk[] = []
  let i = 0, j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; continue }
    const beforeStart = i, afterStart = j
    const old: string[] = [], next: string[] = []
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) break
      if (j >= b.length || (i < a.length && table[i + 1][j] >= table[i][j + 1])) old.push(a[i++])
      else next.push(b[j++])
    }
    hunks.push({ beforeStart, beforeLines: old, afterStart, afterLines: next })
  }
  return hunks
}

/** Aplica solo los tramos aceptados sobre el texto original. */
export function applyHunks(before: string, hunks: TextHunk[], accepted: ReadonlySet<number>): string {
  const source = lines(before), out: string[] = []
  let cursor = 0
  hunks.forEach((hunk, i) => {
    out.push(...source.slice(cursor, hunk.beforeStart))
    out.push(...(accepted.has(i) ? hunk.afterLines : hunk.beforeLines))
    cursor = hunk.beforeStart + hunk.beforeLines.length
  })
  out.push(...source.slice(cursor))
  return out.join('\n')
}
