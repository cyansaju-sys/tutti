import { describe, expect, it } from 'vitest'
import { assembleSteering, MAX_FULL_CHARS, type Steering } from '@/backend/services/context/steering'

const doc = (base: string, body: string, inclusion: Steering['inclusion'] = 'always'): Steering =>
  ({ file: `/p/.tutti/steering/${base}.md`, base, name: base, inclusion, patterns: [], description: '', body, scope: 'project' })

describe('tope del steering «always»', () => {
  it('entrega completo lo que cabe y pasa a la lista lo que lo supera', () => {
    const big = 'x'.repeat(MAX_FULL_CHARS - 100)
    const { text, parts } = assembleSteering('/p', [doc('a', big), doc('b', 'y'.repeat(500)), doc('c', 'corto')], [])
    expect(parts.find((x) => x.doc.base === 'a')?.delivered).toBe('full')
    expect(parts.find((x) => x.doc.base === 'b')?.delivered).toBe('index')       // no cabe: se lista con su ruta
    expect(parts.find((x) => x.doc.base === 'c')?.delivered).toBe('full')        // uno pequeño posterior sí cabe
    expect(text).toContain('.tutti/steering/b.md')
    expect(text).not.toContain('y'.repeat(500))
  })
  it('un steering «always» tiene prioridad sobre los demás aunque vaya después', () => {
    const { parts } = assembleSteering('/p', [doc('m', 'z', 'manual'), doc('a', 'x'.repeat(MAX_FULL_CHARS))], [])
    expect(parts.find((x) => x.doc.base === 'a')?.delivered).toBe('full')
  })
})
