import { describe, expect, it } from 'vitest'
import type { RoadmapItem, RoadmapState } from '../../../../src/shared/types'
import { phaseProgress, resumePrompt, roadmapSummary, roadmapTemplate } from '../../../../src/renderer/src/features/tutti/lib/roadmap'

const item = (patch: Partial<RoadmapItem>): RoadmapItem => ({ text: 'x', change: null, line: 1, status: 'pending', dir: null, done: 0, total: 0, ...patch })
const STATE: RoadmapState = {
  file: '/p/.tutti/roadmap.md', rel: '.tutti/roadmap.md', exists: true, current: 1, next: { phase: 1, item: 1 },
  phases: [
    { title: 'Fase 0', line: 1, items: [item({ text: 'limpiar', status: 'done' })] },
    { title: 'Fase 1', line: 3, items: [item({ text: 'init', change: 'init-db', status: 'done' }), item({ text: 'tabla', change: 'shortlinks', status: 'active', done: 2, total: 5 }), item({ text: 'Pagos', status: 'unknown' })] },
    { title: 'Fase 2', line: 8, items: [item({ text: 'admin-panel', change: 'admin-panel' })] }
  ]
}

describe('roadmap (interfaz)', () => {
  it('cuenta lo hecho de una fase', () => {
    expect(phaseProgress(STATE.phases[1].items)).toEqual({ done: 1, total: 3 })
  })

  it('el resumen marca la fase actual y lo siguiente, y omite lo hecho', () => {
    expect(roadmapSummary('es', STATE)).toBe([
      'Fase 0 (1/1)',
      '▶ Fase 1 (1/3)',
      '  - `shortlinks` tabla [en marcha 2/5] ← siguiente',
      '  - Pagos [sin verificar]',
      'Fase 2 (0/1)',
      '  - `admin-panel` [sin spec]'
    ].join('\n'))
  })

  it('la prompt pide verificar y esperar aprobación, en los dos idiomas', () => {
    const es = resumePrompt('es', STATE)
    expect(es).toContain('.tutti/roadmap.md')
    expect(es).toContain('git log --oneline -20')
    expect(es).toContain('NO escribas código')
    expect(resumePrompt('en', STATE)).toContain('wait for my approval')
  })

  it('la plantilla tiene fases y cambios vinculados', () => {
    expect(roadmapTemplate('es')).toMatch(/^## Fase 1/m)
    expect(roadmapTemplate('en')).toContain('- [ ] `first-change`')
  })
})
