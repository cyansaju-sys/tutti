import { describe, expect, it } from 'vitest'
import { MAX_SNIPPET_LINES, selectionMessage, selectionRef } from '../../src/renderer/src/lib/selectionRef'

describe('enviar la selección al agente', () => {
  it('la referencia lleva el rango de líneas y la @ solo donde se entiende', () => {
    expect(selectionRef('claude', 'src/a.ts', 12, 30)).toBe('@src/a.ts:12-30')
    expect(selectionRef('codex', 'src/a.ts', 7, 7)).toBe('@src/a.ts:7')
    expect(selectionRef('aider', 'src/a.ts', 1, 2)).toBe('src/a.ts:1-2')
    expect(selectionRef('claude', 'mi carpeta/a.ts', 1, 2)).toBe('@"mi carpeta/a.ts":1-2')
  })

  it('el código va en un bloque con el lenguaje de la extensión', () => {
    expect(selectionMessage('claude', 'src/a.ts', 12, 13, 'const a = 1\nconst b = 2\n')).toBe('@src/a.ts:12-13\n```ts\nconst a = 1\nconst b = 2\n```\n')
    expect(selectionMessage('claude', 'Makefile', 1, 1, 'all:')).toBe('@Makefile:1\n```\nall:\n```\n')
  })

  it('si es muy largo o está vacío, solo la referencia', () => {
    const long = Array.from({ length: MAX_SNIPPET_LINES + 1 }, (_, i) => `l${i}`).join('\n')
    expect(selectionMessage('claude', 'a.ts', 1, MAX_SNIPPET_LINES + 1, long)).toBe(`@a.ts:1-${MAX_SNIPPET_LINES + 1} `)
    expect(selectionMessage('claude', 'a.ts', 3, 3, '  \n')).toBe('@a.ts:3 ')
  })
})
