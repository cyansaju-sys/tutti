import type { ReactNode } from 'react'

/**
 * Vista de Markdown sin dependencias: títulos, listas, citas, código, énfasis y enlaces. Genera elementos de React (nunca HTML en crudo),
 * así que lo que haya en el texto no puede ejecutar nada; los enlaces solo se aceptan si son http(s).
 */
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0
    if (i > last) out.push(text.slice(last, i))
    const t = m[0]
    const key = `i${n++}`
    if (t.startsWith('`')) out.push(<code key={key} className="rounded bg-ov/[0.08] px-1 py-px font-mono text-[0.9em] text-accent">{t.slice(1, -1)}</code>)
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
  | { kind: 'ul' | 'ol'; items: Array<{ depth: number; text: string }> }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'hr' }

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
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (h) { flush(); blocks.push({ kind: 'h', level: h[1].length, text: h[2].trim() }) }
    else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); blocks.push({ kind: 'hr' }) }
    else if (li) {
      flush()
      const kind = /\d/.test(li[2]) ? 'ol' : 'ul'
      const item = { depth: Math.min(3, Math.floor(li[1].replace(/\t/g, '  ').length / 2)), text: li[3] }
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

export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-text/90">
      {parseBlocks(text).map((b, i) => {
        switch (b.kind) {
          case 'h': return <div key={i} role="heading" aria-level={b.level} className={HEADING[b.level]}>{inline(b.text)}</div>
          case 'p': return <p key={i} className="m-0">{inline(b.text)}</p>
          case 'quote': return <blockquote key={i} className="m-0 border-l-2 border-accent/50 pl-3 text-muted">{inline(b.text)}</blockquote>
          case 'code': return <pre key={i} className="m-0 overflow-x-auto rounded-md bg-ov/[0.06] p-2.5 font-mono text-[11.5px] leading-snug">{b.text}</pre>
          case 'hr': return <hr key={i} className="my-1 border-line" />
          default: {
            const Tag = b.kind
            return (
              <Tag key={i} className={`m-0 list-outside ${b.kind === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 marker:text-accent`}>
                {b.items.map((it, j) => <li key={j} style={{ marginLeft: it.depth * 16 }}>{inline(it.text)}</li>)}
              </Tag>
            )
          }
        }
      })}
    </div>
  )
}
