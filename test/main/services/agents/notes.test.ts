import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { appendNote, formatNote, notesFile, readNotes } from '../../../../src/main/services/agents/notes'

const dirs: string[] = []
const project = (): string => { const d = mkdtempSync(join(tmpdir(), 'tutti-notes-')); dirs.push(d); return d }
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })

describe('pizarra compartida', () => {
  it('una nota lleva fecha, autor y las líneas siguientes sangradas', () => {
    expect(formatNote('Codex (a2, rol api)', 'rutas en /v1\nsin barra final', new Date(2026, 9, 19, 9, 5))).toBe('- 2026-10-19 09:05 · Codex (a2, rol api): rutas en /v1\n  sin barra final\n')
  })
  it('se guardan en .tutti/notes.md y se leen en orden, con las de varias líneas enteras', () => {
    const p = project()
    expect(readNotes(p)).toEqual([])
    expect(appendNote(p, 'A', 'uno')).toBe(true)
    expect(appendNote(p, 'B', 'dos\ntres')).toBe(true)
    expect(readFileSync(notesFile(p), 'utf8')).toMatch(/^# Notas compartidas/)
    const notes = readNotes(p)
    expect(notes).toHaveLength(2)
    expect(notes[0]).toMatch(/· A: uno$/)
    expect(notes[1]).toMatch(/· B: dos\ntres$/)
  })
  it('readNotes devuelve solo las últimas', () => {
    const p = project()
    for (const n of ['1', '2', '3']) appendNote(p, 'A', n)
    expect(readNotes(p, 2).map((n) => n.slice(-1))).toEqual(['2', '3'])
  })
})
