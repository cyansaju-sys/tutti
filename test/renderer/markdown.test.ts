import { describe, expect, it } from 'vitest'
import { parseBlocks } from '../../src/renderer/src/components/Markdown'

describe('Markdown', () => {
  it('títulos, párrafos, listas, citas, código y separadores', () => {
    const blocks = parseBlocks('# Título\n\nUna frase\ncontinúa aquí.\n\n- uno\n- dos\n  - anidado\n\n1. primero\n2. segundo\n\n> cita\n\n```js\nconst a = 1\n\nconst b = 2\n```\n\n---\n')
    expect(blocks.map((b) => b.kind)).toEqual(['h', 'p', 'ul', 'ol', 'quote', 'code', 'hr'])
    expect(blocks[1]).toMatchObject({ text: 'Una frase continúa aquí.' })
    expect(blocks[2]).toMatchObject({ items: [{ depth: 0, text: 'uno' }, { depth: 0, text: 'dos' }, { depth: 1, text: 'anidado' }] })
    expect(blocks[5]).toMatchObject({ text: 'const a = 1\n\nconst b = 2' })      // las líneas en blanco dentro del código se conservan
  })

  it('no interpreta HTML: se queda como texto', () => {
    expect(parseBlocks('<script>alert(1)</script>')).toEqual([{ kind: 'p', text: '<script>alert(1)</script>' }])
  })
})
