/**
 * Lector de TOML para los config.toml de Codex: tablas y claves con puntos o comillas, cadenas (también de varias líneas), números,
 * booleanos, arrays (también en varias líneas, con comentarios) y tablas en línea (`env = { K = "v" }`). Las listas de tablas
 * (`[[...]]`) se saltan y las fechas quedan como texto. No valida: lo que no entiende lo deja como texto o se lo salta.
 */
export type Table = Record<string, unknown>
const isTable = (v: unknown): v is Table => typeof v === 'object' && v !== null && !Array.isArray(v)

const ESCAPES: Record<string, string> = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', e: '\x1b', '"': '"', '\\': '\\' }
const BARE = /[A-Za-z0-9_-]+/y
const SCALAR = /[^,\]}\r\n#]*/y

export function parseToml(text: string): Table {
  const root: Table = {}
  let current: Table | null = root
  let i = 0
  const n = text.length

  const blank = (): void => { while (i < n && (text[i] === ' ' || text[i] === '\t')) i++ }
  /** Espacios, saltos de línea y comentarios. */
  const gap = (): void => {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++
      if (text[i] !== '#') return
      while (i < n && text[i] !== '\n') i++
    }
  }
  const skipLine = (): void => { while (i < n && text[i] !== '\n') i++ }

  const string = (): string => {
    const q = text[i]
    const multi = text.startsWith(q + q + q, i)
    i += multi ? 3 : 1
    if (multi && text[i] === '\r') i++
    if (multi && text[i] === '\n') i++                              // el salto justo tras las comillas no cuenta
    let raw = ''
    while (i < n) {
      if (multi ? text.startsWith(q + q + q, i) : text[i] === q) { i += multi ? 3 : 1; break }
      if (!multi && text[i] === '\n') break
      if (q === '"' && text[i] === '\\') { raw += text.slice(i, i + 2); i += 2; continue }
      raw += text[i++]
    }
    if (q === "'") return raw
    return raw.replace(/\\(u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|\r?\n\s*|.)/g, (_, e: string) =>
      e[0] === 'u' || e[0] === 'U' ? String.fromCodePoint(parseInt(e.slice(1), 16)) : e[0] === '\n' || e[0] === '\r' ? '' : ESCAPES[e] ?? e)
  }

  const key = (): string[] => {
    const parts: string[] = []
    for (;;) {
      blank()
      if (text[i] === '"' || text[i] === "'") parts.push(string())
      else {
        BARE.lastIndex = i
        const m = BARE.exec(text)
        if (!m) break
        parts.push(m[0])
        i += m[0].length
      }
      blank()
      if (text[i] !== '.') break
      i++
    }
    return parts
  }

  const tableAt = (from: Table, path: string[]): Table => {
    let at = from
    for (const p of path) {
      if (!isTable(at[p])) at[p] = {}
      at = at[p] as Table
    }
    return at
  }
  const assign = (t: Table, path: string[], v: unknown): void => { tableAt(t, path.slice(0, -1))[path[path.length - 1]] = v }

  const value = (): unknown => {
    blank()
    const c = text[i]
    if (c === '"' || c === "'") return string()
    if (c === '[') {
      i++
      const out: unknown[] = []
      for (;;) {
        gap()
        if (i >= n || text[i] === ']') { i++; return out }
        const start = i
        out.push(value())
        gap()
        if (text[i] === ',') i++
        else if (i === start) i++                                     // algo que no se entiende: se salta
      }
    }
    if (c === '{') {
      i++
      const t: Table = {}
      for (;;) {
        gap()
        if (i >= n || text[i] === '}') { i++; return t }
        const start = i
        const k = key()
        blank()
        if (k.length && text[i] === '=') { i++; assign(t, k, value()) }
        gap()
        if (text[i] === ',') i++
        else if (i === start) i++
      }
    }
    SCALAR.lastIndex = i
    const raw = SCALAR.exec(text)![0]
    i += raw.length
    const v = raw.trim()
    if (v === 'true' || v === 'false') return v === 'true'
    if (/^[+-]?\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?$/.test(v)) return Number(v.replace(/_/g, ''))
    return v
  }

  while (i < n) {
    gap()
    if (i >= n) break
    if (text[i] === '[') {
      if (text[i + 1] === '[') { current = null; skipLine(); continue }
      i++
      const path = key()
      current = path.length ? tableAt(root, path) : null
      skipLine()
      continue
    }
    const k = key()
    blank()
    if (k.length && text[i] === '=') {
      i++
      const v = value()
      if (current) assign(current, k, v)
    }
    skipLine()
  }
  return root
}
