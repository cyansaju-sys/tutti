import type { ReactNode } from 'react'

/**
 * Vista de Markdown sin dependencias: títulos, listas, citas, código, énfasis y enlaces. Genera elementos de React (nunca HTML en crudo),
 * así que lo que haya en el texto no puede ejecutar nada; los enlaces solo se aceptan si son http(s).
 * Acepta además el HTML habitual de los README: `<div|p|center align="...">` (con Markdown dentro), `<br>`, `<img>` y `<a href>`.
 */
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))|(<br\s*\/?>)|(<img\s[^>]*>)|(<a\s[^>]*>.*?<\/a>)/gi

/** Valor de un atributo de una etiqueta HTML («align="center"»); vacío si no está. */
const attr = (tag: string, name: string): string => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find((v) => v !== undefined) ?? ''
const size = (v: string): number | undefined => (/^\d{1,4}$/.test(v) ? Number(v) : undefined)

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0
    if (i > last) out.push(text.slice(last, i))
    const t = m[0]
    const key = `i${n++}`
    if (/^<br/i.test(t)) out.push(<br key={key} />)
    else if (/^<img/i.test(t)) {
      const src = attr(t, 'src')
      if (/^https?:\/\//i.test(src)) out.push(<img key={key} src={src} alt={attr(t, 'alt')} width={size(attr(t, 'width'))} height={size(attr(t, 'height'))} className="inline-block max-w-full align-middle" />)
      else out.push(t)
    } else if (/^<a\s/i.test(t)) {
      const url = attr(t, 'href')
      const label = t.replace(/^<a\s[^>]*>/i, '').replace(/<\/a>$/i, '')
      if (/^https?:\/\//i.test(url)) out.push(<a key={key} href={url} onClick={(e) => { e.preventDefault(); window.open(url, '_blank') }} className="text-accent underline decoration-accent/40 hover:decoration-accent">{inline(label)}</a>)
      else out.push(...inline(label))
    } else if (t.startsWith('`')) out.push(<code key={key} className="rounded bg-ov/[0.08] px-1 py-px font-mono text-[0.9em] text-accent">{t.slice(1, -1)}</code>)
    else if (t.startsWith('**') || t.startsWith('__')) out.push(<strong key={key} className="font-semibold text-text">{inline(t.slice(2, -2))}</strong>)
    else if (t.startsWith('[')) {
      const [, label, url] = /^\[([^\]]+)\]\((.+)\)$/.exec(t) ?? []
      out.push(<a key={key} href={url} onClick={(e) => { e.preventDefault(); window.open(url, '_blank') }} className="text-accent underline decoration-accent/40 hover:decoration-accent">{label}</a>)
    } else out.push(<em key={key}>{inline(t.slice(1, -1))}</em>)
    last = i + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: Array<{ depth: number; text: string; done?: boolean }> }      // done: casilla «- [ ]» / «- [x]»
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'hr' }
  | { kind: 'box'; align: 'left' | 'center' | 'right' | ''; blocks: Block[] }                     // `<div align="center">…</div>` con Markdown dentro
  | { kind: 'table'; head: string[]; align: Array<'left' | 'center' | 'right'>; rows: string[][] }

const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

/** Celdas de una fila «| a | b |»; respeta `\|` y los `|` dentro de `código`. */
function cells(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let code = false
  const s = line.trim()
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++ }
    else if (c === '`') { code = !code; cur += c }
    else if (c === '|' && !code) { out.push(cur.trim()); cur = '' }
    else cur += c
  }
  out.push(cur.trim())
  if (s.startsWith('|')) out.shift()
  if (s.endsWith('|') && !s.endsWith('\\|')) out.pop()
  return out
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r/g, '').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  const flush = (): void => { if (para.length) { blocks.push({ kind: 'p', text: para.join(' ') }); para = [] } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {                                   // bloque de código hasta la valla de cierre
      flush()
      const code: string[] = []
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i])
      blocks.push({ kind: 'code', text: code.join('\n') })
      continue
    }
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('-') && TABLE_SEP.test(lines[i + 1])) {   // tabla: cabecera + separador + filas
      flush()
      const head = cells(line)
      const align = cells(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left') as 'left' | 'center' | 'right')
      const rows: string[][] = []
      for (i += 2; i < lines.length && lines[i].trim() && lines[i].includes('|'); i++) rows.push(cells(lines[i]))
      i--
      blocks.push({ kind: 'table', head, align, rows })
      continue
    }
    const box = /^\s*<(div|p|center)\b([^>]*)>(.*)$/i.exec(line)
    if (box) {                                                    // contenedor HTML: se busca su cierre (con anidados) y se lee su interior como Markdown
      const tag = box[1].toLowerCase()
      const tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
      const inner: string[] = []
      let depth = 1
      let end = -1
      for (let j = i; j < lines.length && end < 0; j++) {
        const chunk = j === i ? box[3] : lines[j]
        let cut = chunk.length
        for (const m of chunk.matchAll(tags)) {
          depth += m[1] ? -1 : 1
          if (depth === 0) { cut = m.index ?? 0; end = j; break }
        }
        inner.push(chunk.slice(0, cut))
      }
      if (end >= 0) {
        flush()
        const a = attr(box[2], 'align').toLowerCase()
        blocks.push({ kind: 'box', align: tag === 'center' ? 'center' : a === 'center' || a === 'right' || a === 'left' ? a : '', blocks: parseBlocks(inner.join('\n')) })
        i = end
        continue
      }
    }
    const h = /^ {0,3}(#{1,4})\s+(.*)$/.exec(line)
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (h) { flush(); blocks.push({ kind: 'h', level: h[1].length, text: h[2].trim() }) }
    else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); blocks.push({ kind: 'hr' }) }
    else if (li) {
      flush()
      const kind = /\d/.test(li[2]) ? 'ol' : 'ul'
      const task = /^\[( |x|X)\]\s+(.*)$/.exec(li[3])
      const item: { depth: number; text: string; done?: boolean } = { depth: Math.min(3, Math.floor(li[1].replace(/\t/g, '  ').length / 2)), text: task ? task[2] : li[3] }
      if (task) item.done = task[1] !== ' '
      const prev = blocks[blocks.length - 1]
      if (prev && prev.kind === kind) prev.items.push(item)
      else blocks.push({ kind, items: [item] })
    } else if (/^>\s?/.test(line)) {
      flush()
      const text = line.replace(/^>\s?/, '')
      const prev = blocks[blocks.length - 1]
      if (prev && prev.kind === 'quote') prev.text += ` ${text}`
      else blocks.push({ kind: 'quote', text })
    } else if (!line.trim()) flush()
    else para.push(line.trim())
  }
  flush()
  return blocks
}

const HEADING = ['', 'text-[17px] font-semibold mt-1', 'text-[14px] font-semibold mt-4 text-text', 'text-[13px] font-semibold mt-3', 'text-[12px] font-semibold mt-3 text-muted']

function renderBlocks(blocks: Block[]): ReactNode[] {
  return blocks.map((b, i) => {
        switch (b.kind) {
          case 'box': return <div key={i} style={{ textAlign: b.align || undefined }} className="flex flex-col gap-2">{renderBlocks(b.blocks)}</div>
          case 'h': return <div key={i} role="heading" aria-level={b.level} className={HEADING[b.level]}>{inline(b.text)}</div>
          case 'p': return <p key={i} className="m-0">{inline(b.text)}</p>
          case 'quote': return <blockquote key={i} className="m-0 border-l-2 border-accent/50 pl-3 text-muted">{inline(b.text)}</blockquote>
          case 'code': return <pre key={i} className="m-0 overflow-x-auto rounded-md bg-ov/[0.06] p-2.5 font-mono text-[11.5px] leading-snug">{b.text}</pre>
          case 'hr': return <hr key={i} className="my-1 border-line" />
          case 'table': return (
            <div key={i} className="overflow-x-auto">
              <table className="border-collapse text-[12px]">
                <thead>
                  <tr>{b.head.map((c, j) => <th key={j} style={{ textAlign: b.align[j] }} className="whitespace-nowrap border border-line bg-ov/[0.06] px-1.5 py-2 font-semibold text-text">{inline(c)}</th>)}</tr>
                </thead>
                <tbody>
                  {b.rows.map((r, k) => (
                    <tr key={k}>{b.head.map((_, j) => <td key={j} style={{ textAlign: b.align[j] }} className="whitespace-nowrap border border-line px-1.5 py-2 align-top">{inline(r[j] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
          default: {
            const Tag = b.kind
            return (
              <Tag key={i} className={`m-0 list-outside ${b.kind === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 marker:text-accent`}>
                {b.items.map((it, j) => it.done === undefined
                  ? <li key={j} style={{ marginLeft: it.depth * 16 }}>{inline(it.text)}</li>
                  : (
                    <li key={j} style={{ marginLeft: it.depth * 16 }} className="-ml-5 flex list-none items-start gap-2">
                      <span aria-hidden className={`mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-[3px] border text-[10px] leading-none ${it.done ? 'border-accent bg-accent text-bg' : 'border-line'}`}>{it.done ? '✓' : ''}</span>
                      <span className={it.done ? 'text-muted line-through' : undefined}>{inline(it.text)}</span>
                    </li>
                  ))}
              </Tag>
            )
          }
        }
  })
}

export function Markdown({ text }: { text: string }) {
  return <div className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-text/90">{renderBlocks(parseBlocks(text))}</div>
}

/** Separa la cabecera (--- clave: valor ---) de un archivo, como la de los steering de .tutti; devuelve sus pares y el resto del texto. */
export function splitFrontMatter(text: string): { meta: Array<[string, string]>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { meta: [], body: text }
  const meta: Array<[string, string]> = []
  for (const line of m[1].split('\n')) { const kv = /^([\w-]+):\s*(.*)$/.exec(line.trim()); if (kv) meta.push([kv[1], kv[2]]) }
  return { meta, body: text.slice(m[0].length) }
}
