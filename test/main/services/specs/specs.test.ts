import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { specsState, taskCounts } from '@/main/services/specs'

let project = ''
beforeEach(() => { project = mkdtempSync(join(tmpdir(), 'tutti-specs-')) })
afterEach(() => rmSync(project, { recursive: true, force: true }))
const put = (rel: string, text = ''): void => { const f = join(project, rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, text) }

describe('specs', () => {
  it('cuenta las casillas hechas y el total', () => {
    expect(taskCounts('## 1. A\n\n- [x] 1.1 a\n- [ ] 1.2 b\n  - [X] 1.3 c\nsin casilla\n')).toEqual({ done: 2, total: 3 })
    expect(taskCounts('nada')).toEqual({ done: 0, total: 0 })
  })

  it('sin carpeta de specs no hay ninguna', () => {
    expect(specsState(project).specs).toEqual([])
  })

  it('lee las specs de .tutti/specs desde el disco', () => {
    put('.tutti/specs/add-cart/requirements.md', '# Req\n')
    put('.tutti/specs/add-cart/tasks.md', '- [x] 1.1 a\n- [ ] 1.2 b\n')
    const s = specsState(project)
    expect(s.rel).toBe('.tutti/specs')
    expect(s.specs).toEqual([expect.objectContaining({ name: 'add-cart', done: 1, total: 2, hasRequirements: true, hasDesign: false, hasTasks: true })])
  })
})
