import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openspecState, requirementCount, schemaOf, taskCounts } from '../../../../src/main/services/openspec'

let project = ''
beforeEach(() => { project = mkdtempSync(join(tmpdir(), 'tutti-os-')) })
afterEach(() => rmSync(project, { recursive: true, force: true }))
const put = (rel: string, text = ''): void => { const f = join(project, rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, text) }

describe('OpenSpec', () => {
  it('cuenta las casillas hechas y el total', () => {
    expect(taskCounts('## 1. A\n\n- [x] 1.1 a\n- [ ] 1.2 b\n  - [X] 1.3 c\nsin casilla\n')).toEqual({ done: 2, total: 3 })
    expect(taskCounts('nada')).toEqual({ done: 0, total: 0 })
  })

  it('cuenta los requisitos y lee el schema', () => {
    expect(requirementCount('## ADDED Requirements\n\n### Requirement: A\n\n### Requirement: B\n#### Scenario: x\n')).toBe(2)
    expect(schemaOf('schema: spec-driven\ncontext: |\n  x\n')).toBe('spec-driven')
    expect(schemaOf('context: x')).toBe('')
  })

  it('sin carpeta openspec/ no está iniciado', () => {
    expect(openspecState(project)).toMatchObject({ initialized: false, changes: [], specs: [], archived: 0 })
  })

  it('lee los cambios en marcha, las specs y los archivados desde el disco', () => {
    put('openspec/config.yaml', 'schema: spec-driven\n')
    put('openspec/changes/add-cart/proposal.md', '## Why\n')
    put('openspec/changes/add-cart/tasks.md', '- [x] 1.1 a\n- [ ] 1.2 b\n')
    put('openspec/changes/archive/2026-01-01-old/proposal.md', '')
    put('openspec/specs/cart/spec.md', '### Requirement: A\n')
    const s = openspecState(project)
    expect(s).toMatchObject({ initialized: true, schema: 'spec-driven', archived: 1 })
    expect(s.changes).toEqual([expect.objectContaining({ name: 'add-cart', done: 1, total: 2, hasProposal: true, hasDesign: false, hasTasks: true })])
    expect(s.specs).toEqual([expect.objectContaining({ name: 'cart', requirements: 1 })])
  })
})
