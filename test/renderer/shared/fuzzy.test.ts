import { describe, expect, it } from 'vitest'
import { fuzzyScore } from '../../../src/renderer/src/shared/lib/fuzzy'

describe('búsqueda difusa de rutas', () => {
  it('ordena: nombre que empieza, nombre que contiene, ruta, letras sueltas', () => {
    const rank = (q: string, paths: string[]): string[] => paths.map((p) => [p, fuzzyScore(q, p)] as const).filter(([, s]) => s !== null).sort((a, b) => a[1]! - b[1]!).map(([p]) => p)
    expect(rank('chat', ['src/main/chat.ts', 'docs/chat/notes.md', 'src/x/mychat.ts', 'src/main/c/h/a/t.ts'])).toEqual(['src/main/chat.ts', 'src/x/mychat.ts', 'docs/chat/notes.md', 'src/main/c/h/a/t.ts'])
  })
  it('sin coincidencia da null y una consulta vacía lo acepta todo', () => {
    expect(fuzzyScore('zzz', 'src/a.ts')).toBeNull()
    expect(fuzzyScore('', 'src/a.ts')).toBe(0)
    expect(fuzzyScore('cpl', 'src/ChatPanel.tsx')).not.toBeNull()
  })
})
